"""Trading Service — Reusable business logic extracted from route handlers.

Keeps route files thin by centralising price fetching, account validation,
margin calculations, and position P&L computation.
"""
import json
import logging
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from .models import (
    Instrument, Order, OrderSide, OrderStatus,
    Position, PositionStatus, TradingAccount,
)
from .redis_client import redis_client, price_redis, PriceChannel, is_tick_stale

logger = logging.getLogger("trading_service")


class TradingServiceError(Exception):
    """Raised when a trading operation cannot proceed."""

    def __init__(self, detail: str, status_code: int = 400):
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


# ─── Price ────────────────────────────────────────────────────────────────

async def get_current_price(symbol: str) -> tuple[Decimal, Decimal]:
    """Fetch the latest bid/ask from Redis. Raises TradingServiceError if unavailable."""
    tick_data = await redis_client.get(PriceChannel.tick_key(symbol))
    if not tick_data:
        raise TradingServiceError(f"No price available for {symbol}")
    tick = json.loads(tick_data)
    # A stale quote (dead upstream feed being republished by the refresher)
    # must never EXECUTE anything — opening or closing at a price the market
    # left minutes ago fills users at fantasy levels (observed: a buy filled
    # ~38 points under the live market during a feed outage). Same guard the
    # SL/TP engine and pending-order matcher already apply.
    if is_tick_stale(tick):
        raise TradingServiceError(
            f"No live price for {symbol} — the price feed is offline, so trading on it is paused until it recovers."
        )
    return Decimal(str(tick["bid"])), Decimal(str(tick["ask"]))


async def quote_to_account_rate(quote_currency: str, account_currency: str = "USD") -> Decimal | None:
    """Live conversion factor F such that value_in_quote × F = value_in_account.

    Used to convert cross-pair P&L (e.g. GBPJPY → JPY value) to the account
    currency. Tries the `{account}{quote}` pair first (USDJPY → F = 1/bid),
    then `{quote}{account}` (e.g. EURUSD-style → F = bid). Returns None when
    no live rate exists — callers fall back to the raw quote value (the old
    behaviour) rather than failing.
    """
    q = (quote_currency or "").upper()
    a = (account_currency or "USD").upper()
    if not q or q == a:
        return Decimal("1")
    # A conversion rate only scales an amount, so the durable last price is
    # an acceptable fallback when the live tick has expired (weekend, feed
    # gap). Reads go to db 0 from every service (see price_redis).
    for symbol, invert in ((f"{a}{q}", True), (f"{q}{a}", False)):
        for key in (PriceChannel.tick_key(symbol), PriceChannel.last_price_key(symbol)):
            try:
                raw = await price_redis.get(key)
                if not raw:
                    continue
                data = json.loads(raw)
                bid = Decimal(str(data["bid"] if isinstance(data, dict) else data))
                if bid > 0:
                    return (Decimal("1") / bid) if invert else bid
            except Exception:  # malformed value — try the next key / pair
                continue
    return None


# ─── Account ──────────────────────────────────────────────────────────────

async def validate_account(
    account_id: UUID,
    user_id: UUID,
    db: AsyncSession,
    *,
    load_group: bool = True,
) -> TradingAccount:
    """Load and validate a trading account belongs to the user and is active."""
    query = select(TradingAccount).where(
        TradingAccount.id == account_id,
        TradingAccount.user_id == user_id,
    )
    if load_group:
        query = query.options(selectinload(TradingAccount.account_group))

    result = await db.execute(query)
    account = result.scalar_one_or_none()
    if not account:
        raise TradingServiceError("Account not found", 404)
    if not account.is_active:
        raise TradingServiceError("Account is not active", 403)
    return account


# ─── Instrument ───────────────────────────────────────────────────────────

async def get_instrument(symbol: str, db: AsyncSession) -> Instrument:
    """Load an active instrument by symbol."""
    result = await db.execute(
        select(Instrument).where(
            Instrument.symbol == symbol.upper(),
            Instrument.is_active == True,
        )
    )
    instrument = result.scalar_one_or_none()
    if not instrument:
        raise TradingServiceError(f"Instrument {symbol} not found", 404)
    return instrument


# ─── Margin ───────────────────────────────────────────────────────────────

def calc_margin(
    lots: Decimal,
    price: Decimal,
    contract_size: Decimal,
    leverage: int,
) -> Decimal:
    """Calculate required margin for a position."""
    return (lots * contract_size * price) / Decimal(str(leverage))


def _instrument_currencies(instrument) -> tuple[str, str]:
    base = (getattr(instrument, "base_currency", None) or "").upper()
    quote = (getattr(instrument, "quote_currency", None) or "").upper()
    if not base or not quote:
        fb_base, fb_quote = _derive_currencies(getattr(instrument, "symbol", None))
        base = base or (fb_base or "")
        quote = quote or (fb_quote or "")
    return base, quote


async def quote_value_to_account(
    value: Decimal,
    instrument,
    ref_price: Decimal,
    account_currency: str = "USD",
) -> Decimal | None:
    """Convert an amount in the instrument's QUOTE currency to the account
    currency. USDJPY notional is in JPY, GER40 in EUR, and so on; treating
    those amounts as dollars overstated margin, swap and percentage
    commission by the exchange rate (about 150x on JPY pairs).

    Returns None when a needed live rate is unavailable, so each caller can
    choose a safe fallback instead of silently using the wrong currency."""
    value = Decimal(str(value))
    if value == 0:
        return value
    base, quote = _instrument_currencies(instrument)
    acct = (account_currency or "USD").upper()
    if not quote or quote == acct:
        return value
    if base == acct:
        ref = Decimal(str(ref_price or 0))
        return value / ref if ref > 0 else None
    rate = await quote_to_account_rate(quote, acct)
    return value * rate if rate else None


async def notional_in_account(
    lots: Decimal,
    price: Decimal,
    instrument,
    account_currency: str = "USD",
) -> Decimal | None:
    """Position notional (lots x contract size x price) in account currency,
    or None when the conversion rate is unavailable."""
    cs = Decimal(str(getattr(instrument, "contract_size", None) or "100000"))
    raw = Decimal(str(lots)) * cs * Decimal(str(price))
    return await quote_value_to_account(raw, instrument, price, account_currency)


async def margin_for(
    lots: Decimal,
    price: Decimal,
    instrument,
    leverage,
    account_currency: str = "USD",
) -> Decimal:
    """Required margin in account currency: converted notional / leverage.

    The ONE margin formula for placement, pending fills, copy trades, admin
    trades and every margin release, so what is reserved at open is exactly
    what is released at close. If a conversion rate is missing the raw
    quote-currency notional is used: that can only OVERSTATE margin (never
    lets an account over-leverage) and self-corrects once the rate is back."""
    lev = Decimal(str(leverage or 1))
    if lev <= 0:
        lev = Decimal("1")
    notional = await notional_in_account(lots, price, instrument, account_currency)
    if notional is None:
        cs = Decimal(str(getattr(instrument, "contract_size", None) or "100000"))
        notional = Decimal(str(lots)) * cs * Decimal(str(price))
        logger.warning(
            "margin_for: no %s conversion rate for %s; using unconverted notional",
            account_currency, getattr(instrument, "symbol", "?"),
        )
    return notional / lev


async def recompute_account_margin(db: AsyncSession, account: TradingAccount) -> Decimal:
    """Set account.margin_used to the margin of its OPEN positions (recomputed
    with margin_for) and refresh free_margin from balance + credit.

    Call after ANY open/close/modify that changes what an account holds, from
    every path (user, SL/TP, stop-out, admin, copy). Subtracting a per-close
    "release" amount drifts when exchange rates move between open and close
    and leaves margin stuck on a flat account; recomputing cannot drift.
    The caller must hold the account row lock."""
    rows = (await db.execute(
        select(Position)
        .options(selectinload(Position.instrument))
        .where(Position.account_id == account.id, Position.status == PositionStatus.OPEN)
    )).scalars().all()
    total = Decimal("0")
    for p in rows:
        total += await margin_for(p.lots, p.open_price, p.instrument, account.leverage)
    account.margin_used = total
    account.equity = Decimal(str(account.balance or 0)) + Decimal(str(account.credit or 0))
    account.free_margin = account.equity - total
    return total


# ─── P&L ──────────────────────────────────────────────────────────────────

def _derive_currencies(symbol: str | None) -> tuple[str | None, str | None]:
    """Derive base/quote currencies from a standard symbol like USDJPY, XAUUSD.

    Standard forex (6-char) and metals/crypto follow BASE(3)+QUOTE(3) convention.
    Returns (None, None) for indices or non-standard symbols.
    """
    if not symbol or len(symbol) < 6:
        return None, None
    return symbol[:3].upper(), symbol[3:6].upper()


def quote_to_account_pnl(
    quote_pnl: Decimal,
    base_currency: str | None,
    quote_currency: str | None,
    ref_price: Decimal,
    account_currency: str = "USD",
    symbol: str | None = None,
    cross_rate: Decimal | None = None,
) -> Decimal:
    """Convert a P&L value expressed in the instrument's quote currency to
    the account currency (default USD).

    Forex P&L formula (price_diff * lots * contract_size) yields a value in
    the QUOTE currency, not USD. For USD-base pairs (USDJPY, USDCAD, USDCHF)
    that must be divided by the current rate to express in USD; otherwise
    e.g. a 17 JPY profit is shown as $17. Crypto / metals / indices already
    quote in USD so the helper short-circuits.

    If base/quote currencies are unknown (NULL in DB), attempt to derive them
    from the *symbol* name (e.g. USDJPY → USD / JPY).

    Cross pairs (base≠acct AND quote≠acct, e.g. GBPJPY) need a live
    quote→account `cross_rate` (see quote_to_account_rate); async callers
    resolve it and pass it in. Without one we fall back to the raw quote
    value — the historical behaviour — rather than guessing.
    """
    if quote_pnl == 0:
        return quote_pnl
    base = (base_currency or "").upper()
    quote = (quote_currency or "").upper()
    if not base or not quote:
        fb_base, fb_quote = _derive_currencies(symbol)
        base = base or (fb_base or "")
        quote = quote or (fb_quote or "")
    acct = (account_currency or "USD").upper()
    if quote == acct or not quote:
        return quote_pnl
    if base == acct:
        if ref_price and ref_price != 0:
            return quote_pnl / ref_price
        return quote_pnl
    # Cross pair: convert with the live quote→account rate when provided.
    if cross_rate is not None and cross_rate > 0:
        return quote_pnl * cross_rate
    return quote_pnl


def _needs_cross_rate(instrument, account_currency: str = "USD") -> str | None:
    """Return the quote currency when converting this instrument's P&L to the
    account currency requires a live cross rate (base≠acct AND quote≠acct),
    else None."""
    base = (getattr(instrument, "base_currency", None) or "").upper()
    quote = (getattr(instrument, "quote_currency", None) or "").upper()
    if not base or not quote:
        fb_base, fb_quote = _derive_currencies(getattr(instrument, "symbol", None))
        base = base or (fb_base or "")
        quote = quote or (fb_quote or "")
    acct = (account_currency or "USD").upper()
    if quote and quote != acct and base != acct:
        return quote
    return None


def calc_position_pnl(
    side: OrderSide,
    open_price: Decimal,
    current_price: Decimal,
    lots: Decimal,
    contract_size: Decimal,
    instrument=None,
    account_currency: str = "USD",
    cross_rate: Decimal | None = None,
) -> Decimal:
    """Calculate unrealised P&L for a single position. When ``instrument``
    is supplied the result is converted from quote currency to the account
    currency; otherwise the raw quote-currency value is returned."""
    if side == OrderSide.BUY:
        raw = (current_price - open_price) * lots * contract_size
    else:
        raw = (open_price - current_price) * lots * contract_size
    if instrument is None:
        return raw
    return quote_to_account_pnl(
        raw,
        getattr(instrument, "base_currency", None),
        getattr(instrument, "quote_currency", None),
        current_price,
        account_currency,
        symbol=getattr(instrument, "symbol", None),
        cross_rate=cross_rate,
    )


async def cross_rate_for(instrument, account_currency: str = "USD") -> Decimal | None:
    """Resolve the live quote→account cross rate for an instrument, or None
    when the instrument doesn't need one (USD-quoted / USD-base) or no live
    rate is available. The single lookup every async P&L call site uses so
    cross-pair (e.g. GBPJPY) P&L is expressed in the account currency
    everywhere — positions API, equity, close bookings, engines."""
    quote = _needs_cross_rate(instrument, account_currency)
    if not quote:
        return None
    return await quote_to_account_rate(quote, account_currency)


async def calc_account_equity(
    account: TradingAccount,
    db: AsyncSession,
) -> tuple[Decimal, Decimal]:
    """Return (equity, unrealised_pnl) for an account based on live prices."""
    result = await db.execute(
        select(Position)
        .options(selectinload(Position.instrument))
        .where(
            Position.account_id == account.id,
            Position.status == PositionStatus.OPEN,
        )
    )
    positions = result.scalars().all()

    unrealised = Decimal("0")
    for pos in positions:
        try:
            bid, ask = await get_current_price(pos.instrument.symbol)
            price = bid if pos.side == OrderSide.BUY else ask
            unrealised += calc_position_pnl(
                pos.side, pos.open_price, price,
                pos.lots, pos.instrument.contract_size,
                instrument=pos.instrument,
                cross_rate=await cross_rate_for(pos.instrument),
            )
        except TradingServiceError:
            continue

    equity = account.balance + account.credit + unrealised
    return equity, unrealised
