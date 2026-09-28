"""Daily swap (overnight financing) engine.

Swap is booked at a fixed daily ROLLOVER (21:00 UTC by default, the usual
New York 5 pm close), not 24 hours after each trade opened, so every trader
held over the same night pays or earns the same swap.

For each rollover a position was open through:
  days     = 1 on Monday-Friday rollovers,
             3 on the triple-swap weekday (covers Saturday and Sunday),
             0 on Saturday/Sunday rollovers for session markets.
           24/7 markets (crypto) book 1 day on every rollover, weekends
           included, and have no triple day.
  amount   = notional in account currency x borrowed part x (% per year / 100 / 360) x days
  borrowed part = (L - 1) / L  (a fully funded 1:1 trade has none).

The % per year is signed (negative = trader pays, positive = trader
receives) and resolved per user, account type, instrument, segment and
default rule (see resolve_swap_terms). With no rule the platform default
of -3.6% a year (0.01% a day) applies.

Skipped: swap-free rules, swap-free (Islamic) account types, Islamic users,
fully funded positions and leverage <= 1.

Idempotency: positions.last_swap_at stores the last rollover booked. A
missed night (deploy, outage) is caught up on the next check, and a rollover
is never booked twice. If an exchange rate needed to value the position is
missing, the position is retried on the next check instead of being charged
in the wrong currency.
"""
import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.engine_lock import engine_lock
from packages.common.src.row_locks import lock_account
from packages.common.src.models import (
    AccountGroup, Position, PositionStatus,
    TradingAccount, Transaction, User,
)
from packages.common.src.instrument_pricing import resolve_swap_terms, SWAP_DAYS_PER_YEAR
from packages.common.src.market_hours import trades_24_7
from packages.common.src.trading_service import notional_in_account

logger = logging.getLogger("overnight-fee-engine")

ROLLOVER_HOUR_UTC = int(os.getenv("SWAP_ROLLOVER_HOUR_UTC", "21"))
# Check every 5 minutes so swap is booked shortly after the rollover.
TICK_INTERVAL = 300


def last_rollover_at_or_before(now: datetime) -> datetime:
    r = now.replace(hour=ROLLOVER_HOUR_UTC, minute=0, second=0, microsecond=0)
    return r if r <= now else r - timedelta(days=1)


def rollovers_between(after: datetime, until: datetime) -> list[datetime]:
    """Every rollover instant r with after < r <= until."""
    r = after.replace(hour=ROLLOVER_HOUR_UTC, minute=0, second=0, microsecond=0)
    if r <= after:
        r += timedelta(days=1)
    out: list[datetime] = []
    while r <= until:
        out.append(r)
        r += timedelta(days=1)
    return out


def swap_days_for(rollover: datetime, triple_day: int, is_24_7: bool) -> int:
    """Days of swap one rollover books (see module docstring)."""
    if is_24_7:
        return 1
    wd = rollover.weekday()  # 0 = Monday
    if wd >= 5:
        return 0
    return 3 if wd == triple_day else 1


def _utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


class OvernightFeeEngine:
    def __init__(self):
        self._running = False

    async def start(self):
        self._running = True
        logger.info("Swap engine started (rollover %02d:00 UTC, check every %ds)", ROLLOVER_HOUR_UTC, TICK_INTERVAL)
        asyncio.create_task(self._run())

    async def stop(self):
        self._running = False

    async def _run(self):
        while self._running:
            try:
                # Leader-election: with `--workers N` only one gateway
                # process should charge the daily swap, otherwise every
                # eligible position gets debited N times per night. TTL
                # is generous (5 min) because each tick can touch a
                # large set of positions.
                async with engine_lock("overnight_fee", ttl_seconds=300) as is_leader:
                    if is_leader:
                        async with AsyncSessionLocal() as db:
                            n = await charge_due_positions(db)
                            # Commit even when nothing was booked: exempt and
                            # zero-rate positions still advance last_swap_at.
                            await db.commit()
                            if n:
                                logger.info("Swap: booked rollover swap on %d positions", n)
            except Exception as e:
                logger.error("Overnight fee engine error: %s", e, exc_info=True)
            await asyncio.sleep(TICK_INTERVAL)


async def charge_due_positions(db: AsyncSession, now: Optional[datetime] = None) -> int:
    """Book swap on every open position for each rollover it was open
    through since its last booking. Returns the number of positions booked."""
    now = _utc(now) or datetime.now(timezone.utc)
    latest = last_rollover_at_or_before(now)

    rows = (await db.execute(
        select(Position)
        .options(
            selectinload(Position.instrument),
            selectinload(Position.account).selectinload(TradingAccount.account_group),
        )
        .where(
            Position.status == PositionStatus.OPEN,
            func.coalesce(Position.last_swap_at, Position.created_at) < latest,
        )
    )).scalars().all()

    booked = 0
    for pos in rows:
        anchor = _utc(pos.last_swap_at) or _utc(pos.created_at)
        if anchor is None:
            continue
        rolls = rollovers_between(anchor, now)
        if not rolls:
            continue
        last_roll = rolls[-1]

        account = pos.account
        instrument = pos.instrument
        if account is None or instrument is None:
            continue

        # Exemptions: mark the rollovers as handled so they are not re-walked.
        ag: AccountGroup | None = account.account_group
        exempt = bool(ag is not None and ag.swap_free) or bool(getattr(pos, "is_fully_funded", False))
        if not exempt and account.user_id is not None:
            exempt = bool((await db.execute(
                select(User.is_islamic).where(User.id == account.user_id)
            )).scalar_one_or_none())
        leverage = int(account.leverage or 1)
        if exempt or leverage <= 1:
            pos.last_swap_at = last_roll
            continue

        side = (pos.side.value if hasattr(pos.side, "value") else str(pos.side or "buy")).lower()
        terms = await resolve_swap_terms(
            db, instrument, "long" if side in ("buy", "long") else "short",
            user_id=account.user_id, account_group_id=account.account_group_id,
        )
        segment_name = getattr(getattr(instrument, "segment", None), "name", None)
        is_24_7 = trades_24_7(instrument.symbol, segment_name)
        days = sum(swap_days_for(r, terms.triple_day, is_24_7) for r in rolls)
        if terms.swap_free or terms.pct_per_year == 0 or days == 0:
            pos.last_swap_at = last_roll
            continue

        notional = await notional_in_account(pos.lots or 0, pos.open_price or 0, instrument)
        if notional is None:
            logger.warning(
                "Swap: no conversion rate for %s yet; position %s retried next check",
                instrument.symbol, pos.id,
            )
            continue
        if notional <= 0:
            pos.last_swap_at = last_roll
            continue

        borrowed = Decimal(leverage - 1) / Decimal(leverage)
        amount = (
            notional * borrowed * terms.pct_per_year / Decimal("100") / SWAP_DAYS_PER_YEAR * days
        ).quantize(Decimal("0.00000001"))
        if amount == 0:
            pos.last_swap_at = last_roll
            continue

        # Lock the account row before touching the balance so swap can't race
        # a close / transfer / withdrawal on the same account.
        locked = await lock_account(db, account.id)
        if locked is None:
            continue
        locked.balance = Decimal(str(locked.balance or 0)) + amount
        locked.equity = locked.balance + Decimal(str(locked.credit or 0))
        locked.free_margin = locked.equity - Decimal(str(locked.margin_used or 0))
        pos.swap = Decimal(str(pos.swap or 0)) + amount   # negative = charged
        pos.last_swap_at = last_roll

        db.add(Transaction(
            user_id=locked.user_id,
            account_id=locked.id,
            type="swap",
            amount=amount,
            balance_after=locked.balance,
            reference_id=pos.id,
            description=(
                f"Swap {instrument.symbol}: {days} day(s) at {terms.pct_per_year}% per year"
                f" on {notional:.2f} (borrowed {borrowed:.4f})"
            ),
        ))
        booked += 1

    return booked


overnight_fee_engine = OvernightFeeEngine()
