"""Margin, percentage commission and swap must be valued in the ACCOUNT
currency, and swap must follow a fixed daily rollover.

Regression guards for the 2026-09-28 audit:
  * lots x contract x price is in the QUOTE currency. USDJPY/EURJPY notionals
    are in yen, so treating them as dollars overstated margin, swap and
    percentage commission about 150x.
  * swap was charged 24h after each trade opened, ignored the triple-swap
    day, charged weekends on session markets, never credited, and read the
    admin's "% per year, negative = charge" numbers as a daily fraction.

No Postgres or Redis: prices come from a patched rate lookup and the swap
engine runs against a small fake session.
"""
import asyncio
import unittest
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from types import SimpleNamespace
from uuid import uuid4

from packages.common.src import trading_service as cts
from packages.common.src import instrument_pricing as ip
from services.gateway.src.engines import overnight_fee_engine as ofe


def _inst(symbol, base, quote, cs="100000", segment=None):
    return SimpleNamespace(
        id=uuid4(), symbol=symbol, base_currency=base, quote_currency=quote,
        contract_size=Decimal(cs), segment=SimpleNamespace(name=segment) if segment else None,
    )


USDJPY = _inst("USDJPY", "USD", "JPY")
EURJPY = _inst("EURJPY", "EUR", "JPY")
EURUSD = _inst("EURUSD", "EUR", "USD")
GER40 = _inst("GER40", "GER40", "EUR", cs="1")
BTCUSD = _inst("BTCUSD", "BTC", "USD", cs="1", segment="crypto")

RATES = {"JPY": Decimal("1") / Decimal("150"), "EUR": Decimal("1.08")}


def run(coro):
    return asyncio.new_event_loop().run_until_complete(coro)


class ConversionTests(unittest.TestCase):
    def setUp(self):
        self._orig = cts.quote_to_account_rate

        async def fake_rate(quote, acct="USD"):
            return Decimal("1") if quote == acct else RATES.get(quote)

        cts.quote_to_account_rate = fake_rate

    def tearDown(self):
        cts.quote_to_account_rate = self._orig

    def test_usd_quoted_notional_unchanged(self):
        n = run(cts.notional_in_account(Decimal("1"), Decimal("1.08"), EURUSD))
        self.assertEqual(n, Decimal("108000.00"))

    def test_usd_base_pair_is_lots_times_contract(self):
        # 1 lot USDJPY = $100,000 whatever the price, not 15,000,000.
        n = run(cts.notional_in_account(Decimal("1"), Decimal("150"), USDJPY))
        self.assertEqual(n, Decimal("100000"))

    def test_jpy_cross_uses_live_rate(self):
        # 1 lot EURJPY at 162 = 16,200,000 JPY = $108,000 at 150 JPY/USD.
        n = run(cts.notional_in_account(Decimal("1"), Decimal("162"), EURJPY))
        self.assertAlmostEqual(float(n), 108000.0, places=2)

    def test_eur_index_converted(self):
        n = run(cts.notional_in_account(Decimal("1"), Decimal("20000"), GER40))
        self.assertEqual(n, Decimal("21600.00"))

    def test_missing_rate_returns_none(self):
        n = run(cts.notional_in_account(Decimal("1"), Decimal("1"), _inst("EURCHF", "EUR", "CHF")))
        self.assertIsNone(n)

    def test_margin_usdjpy_is_not_150x(self):
        # 0.01 lot at 1:100 needs $10, the old formula reserved $1,500.
        m = run(cts.margin_for(Decimal("0.01"), Decimal("150"), USDJPY, 100))
        self.assertEqual(m, Decimal("10"))

    def test_margin_falls_back_to_raw_when_rate_missing(self):
        inst = _inst("EURCHF", "EUR", "CHF")
        m = run(cts.margin_for(Decimal("1"), Decimal("0.95"), inst, 100))
        self.assertEqual(m, Decimal("950.00"))  # never understates

    def test_percentage_commission_converted(self):
        # 0.05% of 1 lot USDJPY = $50, not $7,500.
        cfg = SimpleNamespace(value=Decimal("0.05"), charge_type="percentage")
        notional = run(cts.notional_in_account(Decimal("1"), Decimal("150"), USDJPY))
        self.assertEqual(ip._commission_from_config(cfg, Decimal("1"), notional), Decimal("50.0000"))


class RolloverScheduleTests(unittest.TestCase):
    def test_rollovers_are_at_fixed_hour(self):
        after = datetime(2026, 9, 28, 10, 0, tzinfo=timezone.utc)   # Monday 10:00
        until = datetime(2026, 9, 30, 22, 0, tzinfo=timezone.utc)   # Wednesday 22:00
        rolls = ofe.rollovers_between(after, until)
        self.assertEqual([r.day for r in rolls], [28, 29, 30])
        self.assertTrue(all(r.hour == ofe.ROLLOVER_HOUR_UTC for r in rolls))

    def test_trade_closed_before_rollover_books_nothing(self):
        after = datetime(2026, 9, 28, 10, 0, tzinfo=timezone.utc)
        until = datetime(2026, 9, 28, 20, 59, tzinfo=timezone.utc)
        self.assertEqual(ofe.rollovers_between(after, until), [])

    def test_week_books_seven_days_for_session_markets(self):
        start = datetime(2026, 9, 27, 22, 0, tzinfo=timezone.utc)   # Sunday night
        end = start + timedelta(days=7)
        days = sum(ofe.swap_days_for(r, 2, False) for r in ofe.rollovers_between(start, end))
        self.assertEqual(days, 7)  # Mon, Tue, Wed x3, Thu, Fri; no Sat/Sun

    def test_wednesday_is_triple_and_weekend_is_zero(self):
        wed = datetime(2026, 9, 30, 21, 0, tzinfo=timezone.utc)
        sat = datetime(2026, 10, 3, 21, 0, tzinfo=timezone.utc)
        self.assertEqual(ofe.swap_days_for(wed, 2, False), 3)
        self.assertEqual(ofe.swap_days_for(sat, 2, False), 0)

    def test_crypto_rolls_every_day_without_triple(self):
        wed = datetime(2026, 9, 30, 21, 0, tzinfo=timezone.utc)
        sat = datetime(2026, 10, 3, 21, 0, tzinfo=timezone.utc)
        self.assertEqual(ofe.swap_days_for(wed, 2, True), 1)
        self.assertEqual(ofe.swap_days_for(sat, 2, True), 1)


class _Res:
    def __init__(self, items=None, scalar=None):
        self._items, self._scalar = items or [], scalar

    def scalars(self):
        return self

    def all(self):
        return self._items

    def scalar_one_or_none(self):
        return self._scalar


class _DB:
    def __init__(self, positions):
        self._positions = positions
        self.added = []

    async def execute(self, stmt, *a, **k):
        # first call loads positions; later calls are the is_islamic lookup
        if self._positions is not None:
            p, self._positions = self._positions, None
            return _Res(items=p)
        return _Res(scalar=False)

    def add(self, obj):
        self.added.append(obj)

    async def commit(self):
        return None

    async def rollback(self):
        return None


class SwapEngineTests(unittest.TestCase):
    def setUp(self):
        self._orig = (ofe.resolve_swap_terms, ofe.lock_account, cts.quote_to_account_rate)

        async def fake_rate(quote, acct="USD"):
            return Decimal("1") if quote == acct else RATES.get(quote)

        cts.quote_to_account_rate = fake_rate

    def tearDown(self):
        ofe.resolve_swap_terms, ofe.lock_account, cts.quote_to_account_rate = self._orig

    def _pos(self, inst, opened, side="buy", lots="1", price="150", leverage=100):
        account = SimpleNamespace(
            id=uuid4(), user_id=uuid4(), account_group_id=uuid4(), leverage=leverage,
            account_group=SimpleNamespace(swap_free=False),
            balance=Decimal("10000"), credit=Decimal("0"), margin_used=Decimal("0"),
        )
        pos = SimpleNamespace(
            id=uuid4(), side=side, lots=Decimal(lots), open_price=Decimal(price),
            instrument=inst, account=account, created_at=opened, last_swap_at=None,
            swap=Decimal("0"), is_fully_funded=False,
        )

        async def lock(db, account_id):
            return account

        ofe.lock_account = lock
        return pos, account

    def _terms(self, pct, triple=2):
        async def fake_terms(*a, **k):
            return ip.SwapTerms(Decimal(pct), False, triple)
        ofe.resolve_swap_terms = fake_terms

    def test_usdjpy_charge_in_dollars_once_per_rollover(self):
        opened = datetime(2026, 9, 28, 10, 0, tzinfo=timezone.utc)   # Monday
        now = datetime(2026, 9, 28, 21, 5, tzinfo=timezone.utc)
        pos, acct = self._pos(USDJPY, opened)
        self._terms("-3.6")
        n = run(ofe.charge_due_positions(_DB([pos]), now=now))
        self.assertEqual(n, 1)
        # $100,000 x 0.99 x 3.6% / 360 = $9.90 (the old code charged ~$1,485)
        self.assertEqual(pos.swap, Decimal("-9.90000000"))
        self.assertEqual(acct.balance, Decimal("9990.10000000"))
        # booking again at the same time must not double charge
        self.assertEqual(run(ofe.charge_due_positions(_DB([pos]), now=now)), 0)

    def test_positive_rate_credits_the_trader(self):
        opened = datetime(2026, 9, 28, 10, 0, tzinfo=timezone.utc)
        now = datetime(2026, 9, 28, 21, 5, tzinfo=timezone.utc)
        pos, acct = self._pos(EURUSD, opened, price="1.08")
        self._terms("2")
        run(ofe.charge_due_positions(_DB([pos]), now=now))
        self.assertGreater(pos.swap, 0)
        self.assertGreater(acct.balance, Decimal("10000"))

    def test_wednesday_books_three_days(self):
        opened = datetime(2026, 9, 30, 10, 0, tzinfo=timezone.utc)   # Wednesday
        now = datetime(2026, 9, 30, 21, 5, tzinfo=timezone.utc)
        pos, _ = self._pos(USDJPY, opened)
        self._terms("-3.6")
        run(ofe.charge_due_positions(_DB([pos]), now=now))
        self.assertEqual(pos.swap, Decimal("-29.70000000"))

    def test_islamic_group_is_never_charged(self):
        opened = datetime(2026, 9, 28, 10, 0, tzinfo=timezone.utc)
        now = datetime(2026, 9, 28, 21, 5, tzinfo=timezone.utc)
        pos, acct = self._pos(USDJPY, opened)
        acct.account_group.swap_free = True
        self._terms("-3.6")
        self.assertEqual(run(ofe.charge_due_positions(_DB([pos]), now=now)), 0)
        self.assertEqual(pos.swap, Decimal("0"))
        self.assertIsNotNone(pos.last_swap_at)

    def test_missing_rate_retries_instead_of_charging_raw(self):
        opened = datetime(2026, 9, 28, 10, 0, tzinfo=timezone.utc)
        now = datetime(2026, 9, 28, 21, 5, tzinfo=timezone.utc)
        pos, _ = self._pos(_inst("EURCHF", "EUR", "CHF"), opened, price="0.95")
        self._terms("-3.6")
        self.assertEqual(run(ofe.charge_due_positions(_DB([pos]), now=now)), 0)
        self.assertIsNone(pos.last_swap_at)


if __name__ == "__main__":
    unittest.main()
