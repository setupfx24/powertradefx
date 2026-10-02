"""Trading Service — Order placement, position management, margin calculations."""
import asyncio
import json
import logging
from decimal import Decimal
from uuid import UUID
from datetime import datetime, timezone

from fastapi import HTTPException, Request
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from packages.common.src.models import (
    Order, OrderType, OrderSide, OrderStatus, Position, PositionStatus,
    TradingAccount, Instrument, InstrumentConfig,
    TradeHistory, Transaction, CopyTrade, UserAuditLog, User,
)
from packages.common.src.instrument_pricing import resolve_commission, resolve_user_quote, symmetric_quote_from_mid
from packages.common.src.row_locks import lock_account, lock_position, lock_user
from packages.common.src.config import get_settings as _get_settings
from . import wallet_service
from packages.common.src.database import AsyncSessionLocal
from packages.common.src.redis_client import redis_client, PriceChannel, is_tick_stale, publish_instrument_config_reload
from packages.common.src.pending_orders import (
    PendingOrderError,
    validate_pending_price,
)
from packages.common.src.price_cache import price_cache
from packages.common.src.kafka_client import produce_event, KafkaTopics
from packages.common.src.notify import create_notification
from packages.common.src.market_hours import is_market_open
from packages.common.src import corecen_trade_client

from packages.common.src.email_branding import apply_email_brand
logger = logging.getLogger("trading_service")


# ─── Shared helpers ───────────────────────────────────────────────────────

def check_sltp_levels(is_buy: bool, stop_loss, take_profit, ref: Decimal, ref_label: str) -> None:
    """Validate SL/TP against a SINGLE reference price for the side. Shared by
    order placement and position modify so the two rules can never drift (§4).

      BUY : SL must be below ref, TP above ref.
      SELL: SL must be above ref, TP below ref.

    `ref` is the FILL price at placement (ask for buy, bid for sell) or the
    CURRENT close price at modify (bid for buy, ask for sell — the same quote
    the SL/TP engine triggers on). Validating modify against the close price is
    what lets break-even (SL≈entry once price has moved) and profit-locking
    stops through; validating against the OPEN price wrongly blocks them.
    The only rejection reason is "this level would trigger the instant it is set"
    (plus a non-positive level, which is never a real price — QA stored SL -1).
    """
    for _label, _lvl in (("stop-loss", stop_loss), ("take-profit", take_profit)):
        if _lvl is not None and Decimal(str(_lvl)) <= 0:
            raise HTTPException(status_code=400, detail=f"{_label.capitalize()} must be a positive price")
    if stop_loss is not None:
        sl = Decimal(str(stop_loss))
        if is_buy and sl >= ref:
            raise HTTPException(status_code=400, detail=f"BUY stop-loss must be below the {ref_label} ({ref})")
        if not is_buy and sl <= ref:
            raise HTTPException(status_code=400, detail=f"SELL stop-loss must be above the {ref_label} ({ref})")
    if take_profit is not None:
        tp = Decimal(str(take_profit))
        if is_buy and tp <= ref:
            raise HTTPException(status_code=400, detail=f"BUY take-profit must be above the {ref_label} ({ref})")
        if not is_buy and tp >= ref:
            raise HTTPException(status_code=400, detail=f"SELL take-profit must be below the {ref_label} ({ref})")


async def get_current_price(symbol: str) -> tuple[Decimal, Decimal]:
    tick_data = await price_cache.get(symbol)
    if not tick_data:
        raise HTTPException(status_code=400, detail=f"No price available for {symbol}")
    tick = json.loads(tick_data)
    # Stale quote (dead upstream feed) → refuse to execute at a price the
    # market left minutes ago. Mirrors the SL/TP engine and b-book matcher,
    # which already skip stale ticks; without this, market opens/closes were
    # the one path that still filled at frozen prices during a feed outage.
    if is_tick_stale(tick):
        raise HTTPException(
            status_code=400,
            detail=f"No live price for {symbol} — the price feed is offline, so trading on it is paused until it recovers.",
        )
    return Decimal(str(tick["bid"])), Decimal(str(tick["ask"]))


async def validate_account(account_id: UUID, user_id: UUID, db: AsyncSession) -> TradingAccount:
    result = await db.execute(
        select(TradingAccount)
        .options(selectinload(TradingAccount.account_group))
        .where(
            TradingAccount.id == account_id,
            TradingAccount.user_id == user_id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if not account.is_active:
        raise HTTPException(status_code=403, detail="Account is not active")
    return account


async def get_instrument(symbol: str, db: AsyncSession) -> Instrument:
    result = await db.execute(
        select(Instrument).where(Instrument.symbol == symbol.upper(), Instrument.is_active == True)
    )
    instrument = result.scalar_one_or_none()
    if not instrument:
        raise HTTPException(status_code=404, detail=f"Instrument {symbol} not found")
    return instrument


def calc_margin(lots: Decimal, price: Decimal, contract_size: Decimal, leverage: int) -> Decimal:
    return (lots * contract_size * price) / Decimal(str(leverage))


def side_val(side) -> str:
    return side.value if hasattr(side, 'value') else str(side)


from packages.common.src.trading_service import quote_to_account_pnl, cross_rate_for, margin_for


def calc_pnl(
    side,
    open_price: Decimal,
    close_price: Decimal,
    lots: Decimal,
    contract_size: Decimal,
    instrument=None,
    account_currency: str = "USD",
    cross_rate: Decimal | None = None,
) -> Decimal:
    sv = side_val(side)
    if sv == "buy":
        raw = (close_price - open_price) * lots * contract_size
    else:
        raw = (open_price - close_price) * lots * contract_size
    if instrument is None:
        return raw
    return quote_to_account_pnl(
        raw,
        getattr(instrument, "base_currency", None),
        getattr(instrument, "quote_currency", None),
        close_price,
        account_currency,
        symbol=getattr(instrument, "symbol", None),
        cross_rate=cross_rate,
    )


async def calc_pnl_live(
    side,
    open_price: Decimal,
    close_price: Decimal,
    lots: Decimal,
    contract_size: Decimal,
    instrument=None,
    account_currency: str = "USD",
) -> Decimal:
    """calc_pnl with the live cross rate resolved automatically — use from
    async code so cross pairs (GBPJPY…) convert to the account currency
    instead of silently reporting quote-currency values (JPY) as USD."""
    rate = await cross_rate_for(instrument, account_currency) if instrument is not None else None
    return calc_pnl(
        side, open_price, close_price, lots, contract_size,
        instrument=instrument, account_currency=account_currency, cross_rate=rate,
    )


async def fire_event(topic, key, data):
    try:
        await asyncio.wait_for(produce_event(topic, key, data), timeout=1.0)
    except Exception:
        pass


async def assert_trading_allowed(db: AsyncSession, user_id: UUID) -> None:
    """Reject new exposure for a user the admin blocked (Block trading / Kill
    switch set users.trading_blocked_until) or banned. QA: both admin actions
    returned 200 but orders kept filling because nothing read the field.
    Closing existing positions stays allowed — callers only use this on paths
    that ADD exposure."""
    row = (await db.execute(
        select(User.trading_blocked_until, User.status).where(User.id == user_id)
    )).first()
    if row is None:
        raise HTTPException(status_code=404, detail="User not found")
    blocked_until, status = row[0], row[1]
    if str(status or "").lower() in ("banned", "suspended"):
        raise HTTPException(status_code=403, detail="Trading is disabled for this account. Contact support.")
    if blocked_until is not None:
        # Admin writes a naive utcnow()-based value; the column is timestamptz.
        if blocked_until.tzinfo is None:
            blocked_until = blocked_until.replace(tzinfo=timezone.utc)
        if blocked_until > datetime.now(timezone.utc):
            raise HTTPException(status_code=403, detail="Trading is blocked for this account. Contact support.")


async def lot_limits(db: AsyncSession, instrument):
    """(min_lot, max_lot, lot_step, instrument_config) — admin InstrumentConfig
    overrides the instrument's own min/max; the step lives on the instrument."""
    ic = (await db.execute(
        select(InstrumentConfig).where(InstrumentConfig.instrument_id == instrument.id)
    )).scalar_one_or_none()
    min_lot = ic.min_lot_size if ic and ic.min_lot_size is not None else instrument.min_lot
    max_lot = ic.max_lot_size if ic and ic.max_lot_size is not None else instrument.max_lot
    step = getattr(instrument, "lot_step", None) or Decimal("0.01")
    return Decimal(str(min_lot)), Decimal(str(max_lot)), Decimal(str(step)), ic


def check_lot_step(lots, step, label: str = "Lot size") -> None:
    """Volumes must be a multiple of the instrument's lot step (MT5 rule).
    QA filled 0.015 lots on a 0.01-step symbol and left 0.004-lot dust."""
    lots = Decimal(str(lots))
    step = Decimal(str(step or 0))
    if step <= 0:
        return
    if (lots / step) != (lots / step).to_integral_value():
        raise HTTPException(status_code=400, detail=f"{label} must be a multiple of {step.normalize()}")


# Display-only cache of resolved spread rules: (user, account, instrument) ->
# (monotonic time, (value, type, impact)). Admin rule changes show on the
# positions list within _SPREAD_RULE_TTL seconds; fills are never cached.
_SPREAD_RULE_CACHE: dict = {}
_SPREAD_RULE_TTL = 15.0


async def user_quote_for_position(
    db: AsyncSession, pos, bid: Decimal, ask: Decimal, *,
    user_id: UUID, account, _cache: dict | None = None, fresh: bool = False,
) -> tuple[Decimal, Decimal]:
    """The bid/ask THIS position closes at: a per-trade spread_override first,
    else the user's resolved spread (when USER_SPREAD_AT_EXECUTION), else the
    broadcast quote. One function for close and for the displayed P&L, so what
    the positions list shows is exactly what a close realises (QA: shown -2.0,
    realised -3.0 with a 3-pip user rule)."""
    inst = getattr(pos, "instrument", None)
    if getattr(pos, "spread_override", None) is not None and inst is not None:
        mid = (bid + ask) / Decimal("2")
        pip = Decimal(str(inst.pip_size or "0.0001"))
        digits = int(inst.digits or 5)
        return symmetric_quote_from_mid(
            mid, Decimal(str(pos.spread_override)),
            (pos.spread_override_type or "pips"), pip, digits, Decimal("0"),
        )
    if fresh and _get_settings().USER_SPREAD_AT_EXECUTION and inst is not None:
        # EXECUTION path (close): always the live rule, never cached.
        try:
            return await resolve_user_quote(
                db, inst, bid, ask,
                user_id=user_id, account_group_id=account.account_group_id,
                trading_account_id=account.id,
            )
        except Exception as _uq_exc:
            logger.warning("user quote (close) failed for %s, using broadcast: %s", inst.symbol, _uq_exc)
            return bid, ask
    if _get_settings().USER_SPREAD_AT_EXECUTION and inst is not None:
        # DISPLAY path (positions list / open P&L): the user's resolved spread
        # RULE is cached for a few seconds per (user, account, instrument).
        # Resolving the rule chain costs up to ~10 queries per instrument and
        # dominated the capacity test. Fills and closes never use this cache:
        # they call resolve_user_quote directly and always see the live rule.
        import time as _t
        from packages.common.src.instrument_pricing import resolve_spread_config
        key = (str(user_id), str(account.id), str(getattr(inst, "id", inst.symbol)))
        hit = _SPREAD_RULE_CACHE.get(key)
        if hit is not None and _t.monotonic() - hit[0] < _SPREAD_RULE_TTL:
            sv, st, pimp = hit[1]
        else:
            try:
                sv, st, pimp = await resolve_spread_config(
                    db, inst, user_id=user_id, account_group_id=account.account_group_id,
                    trading_account_id=account.id,
                )
            except Exception as _uq_exc:
                logger.warning("user quote failed for %s, using broadcast: %s", inst.symbol, _uq_exc)
                return bid, ask
            if len(_SPREAD_RULE_CACHE) > 50_000:
                _SPREAD_RULE_CACHE.clear()
            _SPREAD_RULE_CACHE[key] = (_t.monotonic(), (sv, st, pimp))
        mid = (bid + ask) / Decimal("2")
        pip = Decimal(str(getattr(inst, "pip_size", None) or "0.0001"))
        digits = int(getattr(inst, "digits", None) or 5)
        return symmetric_quote_from_mid(mid, sv, st, pip, digits, pimp)
    return bid, ask


async def _settle_follower_fee_if_copy(db: AsyncSession, pos, gross_profit, account, *, final: bool) -> None:
    """A follower closing a COPIED position himself pays the same high-water-
    mark performance fee as when the master's close is mirrored (QA
    2026-09-29: closing the copy yourself skipped the fee entirely). On the
    final close the CopyTrade is marked closed so the engine won't touch it."""
    copy = (await db.execute(
        select(CopyTrade).where(CopyTrade.investor_position_id == pos.id, CopyTrade.status == "open")
    )).scalar_one_or_none()
    if copy is None:
        return
    from packages.common.src.models import InvestorAllocation, MasterAccount
    from ..engines.copy_engine import settle_copy_fee
    alloc = await db.get(InvestorAllocation, copy.investor_allocation_id) if copy.investor_allocation_id else None
    master = await db.get(MasterAccount, alloc.master_id) if alloc is not None else None
    await settle_copy_fee(
        db, master=master, alloc=alloc, gross_profit=Decimal(str(gross_profit)),
        investor_account=account, reference_id=pos.id,
    )
    if final:
        copy.status = "closed"


# ─── Orders ───────────────────────────────────────────────────────────────

async def place_order(
    req,
    request: Request,
    user_id: UUID,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    from packages.common.src.settings_store import get_bool_setting, get_int_setting, get_float_setting
    from packages.common.src.ib_commission import accrue_ib_commission_safe

    # --- Parallel: settings from Redis (no DB session needed) ---
    # Global platform caps sit on top of per-instrument limits (InstrumentConfig).
    maintenance, max_trades, max_pending, global_max_lot, global_min_lot = await asyncio.gather(
        get_bool_setting("maintenance_mode", False),
        get_int_setting("max_open_trades", 200),
        get_int_setting("max_pending_orders", 100),
        get_float_setting("max_lot_size", 100.0),
        get_float_setting("min_lot_size", 0.01),
    )
    if maintenance:
        raise HTTPException(status_code=503, detail="Platform is under maintenance. Trading is temporarily disabled.")

    # Admin Block trading / Kill switch — checked before any lock is taken.
    await assert_trading_allowed(db, user_id)

    # --- Sequential DB queries (AsyncSession doesn't support concurrent queries) ---
    # Lock the account row FIRST (canonical order user -> account -> position;
    # this path never needs the user row) and read it FRESH. The previous code
    # loaded the account unlocked and then ran FOR UPDATE, which handed back the
    # same stale identity-map object: concurrent orders each wrote
    # stale_balance - own_commission and QA lost 7 of 9 commission debits.
    # lock_account uses populate_existing, so balance/margin below are current.
    account = await lock_account(db, req.account_id, user_id=user_id)
    if account is None:
        raise HTTPException(status_code=404, detail="Account not found")
    if not account.is_active:
        raise HTTPException(status_code=403, detail="Account is not active")

    # NOTE: the account-group minimum_deposit is an ACCOUNT-OPENING
    # requirement only. It is deliberately NOT re-checked here — once the
    # account exists, the user may trade with whatever balance remains
    # (margin checks below are the only funding gate). A previous version
    # blocked trading when balance dipped under the tier minimum, which
    # locked users out of their own funded accounts.

    instrument = await get_instrument(req.symbol, db)

    open_count_q = await db.execute(
        select(func.count(Position.id)).where(
            Position.account_id == account.id,
            Position.status == "open",
        )
    )
    if (open_count_q.scalar() or 0) >= max_trades:
        raise HTTPException(status_code=400, detail=f"Maximum open trades ({max_trades}) reached")

    # Global pending-order cap (in addition to open-trade cap above).
    if req.order_type != "market":
        pending_count_q = await db.execute(
            select(func.count(Order.id)).where(
                Order.account_id == account.id,
                Order.status == "pending",
            )
        )
        if (pending_count_q.scalar() or 0) >= max_pending:
            raise HTTPException(
                status_code=400,
                detail=f"Maximum pending orders ({max_pending}) reached",
            )

    # Global lot-size caps (platform-wide floor/ceiling on top of per-instrument limits).
    lots_f = float(req.lots)
    if lots_f > global_max_lot:
        raise HTTPException(
            status_code=400,
            detail=f"Lot size exceeds platform maximum ({global_max_lot})",
        )
    if lots_f < global_min_lot:
        raise HTTPException(
            status_code=400,
            detail=f"Lot size below platform minimum ({global_min_lot})",
        )

    if req.order_type == "market":
        segment_name = instrument.segment.name if instrument.segment else ""
        market_open, closed_reason = is_market_open(
            instrument.symbol, segment_name, instrument.trading_hours
        )
        if not market_open:
            raise HTTPException(
                status_code=400,
                detail=closed_reason or f"Market is closed for {instrument.symbol}. "
                       "You can still place pending (limit/stop) orders.",
            )

    ic_row = await db.execute(
        select(InstrumentConfig).where(InstrumentConfig.instrument_id == instrument.id)
    )
    ic = ic_row.scalar_one_or_none()
    min_lot = ic.min_lot_size if ic and ic.min_lot_size is not None else instrument.min_lot
    max_lot = ic.max_lot_size if ic and ic.max_lot_size is not None else instrument.max_lot
    if ic and ic.is_enabled is False:
        raise HTTPException(status_code=400, detail=f"Trading disabled for {instrument.symbol}")

    if req.lots < min_lot or req.lots > max_lot:
        raise HTTPException(status_code=400, detail=f"Lot size must be between {min_lot} and {max_lot}")
    check_lot_step(req.lots, getattr(instrument, "lot_step", None) or Decimal("0.01"))

    bid, ask = await get_current_price(instrument.symbol)

    # Per-user execution spread (opt-in). Re-derive THIS user's bid/ask from the
    # broadcast mid so the fill reflects their resolved (per-user / per-tier)
    # spread. Off by default → bid/ask stay the global broadcast quote.
    if _get_settings().USER_SPREAD_AT_EXECUTION:
        try:
            bid, ask = await resolve_user_quote(
                db, instrument, bid, ask,
                user_id=user_id, account_group_id=account.account_group_id,
                trading_account_id=account.id,
            )
        except Exception as _uq_exc:
            logger.warning("user quote (open) failed for %s, using broadcast: %s",
                           instrument.symbol, _uq_exc)

    order = Order(
        account_id=account.id,
        instrument_id=instrument.id,
        order_type=req.order_type,
        side=req.side,
        lots=req.lots,
        price=req.price,
        stop_loss=req.stop_loss,
        take_profit=req.take_profit,
        stop_limit_price=getattr(req, 'stop_limit_price', None),
        comment=req.comment,
        magic_number=getattr(req, 'magic_number', None),
    )

    if req.order_type == "market":
        fill_price = ask if req.side == "buy" else bid

        # Placement validates against the expected FILL price (§4); modify
        # validates against the current close price. Same shared helper.
        check_sltp_levels(req.side == "buy", req.stop_loss, req.take_profit, fill_price, "fill price")

        # Pass account_group_id so the commission_pct on the user's account
        # tier (Micro/Standard/Pro/Elite) acts as the fallback rack rate when
        # no admin ChargeConfig matches. XP discount also applies.
        commission = await resolve_commission(
            db, instrument, req.lots, fill_price,
            user_id=user_id,
            account_group_id=account.account_group_id,
        )

        required_margin = await margin_for(req.lots, fill_price, instrument, account.leverage)

        unrealized_pnl = Decimal("0")
        # Margin actually in use = sum of OPEN positions' margin, RECOMPUTED here
        # (never trust the stored account.margin_used — a close that didn't
        # release correctly leaves it stuck/inflated, which wrongly rejected new
        # orders with "Insufficient margin" even on a nearly-empty account).
        open_margin = Decimal("0")
        open_pos_result = await db.execute(
            select(Position).where(
                Position.account_id == account.id,
                Position.status == "open",
            )
        )
        open_positions = open_pos_result.scalars().all()

        # Reads come from the in-memory PriceCache (~µs each). The
        # legacy mget batched Redis I/O to amortise round-trips, but
        # the in-process cache makes per-symbol lookups effectively
        # free, so we just iterate.
        if open_positions:
            pos_symbols = list({
                pos.instrument.symbol for pos in open_positions
                if pos.instrument
            })
            price_map: dict[str, tuple[Decimal, Decimal]] = {}
            for sym in pos_symbols:
                val = await price_cache.get(sym)
                if val:
                    try:
                        d = json.loads(val)
                        price_map[sym] = (Decimal(str(d["bid"])), Decimal(str(d["ask"])))
                    except (json.JSONDecodeError, KeyError):
                        pass

            for pos in open_positions:
                cs = pos.instrument.contract_size if pos.instrument else Decimal("100000")
                # Count this open position's margin toward the (recomputed) total.
                open_margin += await margin_for(pos.lots, pos.open_price, pos.instrument, account.leverage)
                sym = pos.instrument.symbol if pos.instrument else None
                if not sym or sym not in price_map:
                    continue
                p_bid, p_ask = price_map[sym]
                pos_side = pos.side.value if hasattr(pos.side, 'value') else str(pos.side)
                cp = p_bid if pos_side == "buy" else p_ask
                if pos_side == "buy":
                    pos_pnl = (cp - pos.open_price) * pos.lots * cs
                else:
                    pos_pnl = (pos.open_price - cp) * pos.lots * cs
                # Convert quote-currency P&L into the account currency like every
                # other P&L site (risk engine, close path, SL/TP). Without this,
                # a JPY-quoted position inflated/deflated equity ~150× in the
                # margin-sufficiency check below.
                unrealized_pnl += quote_to_account_pnl(
                    pos_pnl,
                    getattr(pos.instrument, "base_currency", None),
                    getattr(pos.instrument, "quote_currency", None),
                    cp,
                    symbol=sym,
                    cross_rate=await cross_rate_for(pos.instrument),
                )
        real_equity = (account.balance or Decimal("0")) + (account.credit or Decimal("0")) + unrealized_pnl
        # Use the RECOMPUTED open-position margin, not the (possibly stuck) stored
        # account.margin_used — this both fixes the check AND self-heals the
        # stored value on the next order.
        real_free_margin = real_equity - open_margin

        account.equity = real_equity
        account.free_margin = real_free_margin

        if required_margin > real_free_margin:
            raise HTTPException(status_code=400, detail="Insufficient margin")

        order.status = "filled"
        order.filled_price = fill_price
        order.filled_at = datetime.utcnow()
        order.commission = commission

        # Flush the order FIRST so order.id exists: the id is generated at
        # flush, and building the Position before it stored order_id=NULL on
        # every market position (QA 2026-09-29). IB settlement joins
        # Position.order_id to the accrual, so those accruals never released.
        db.add(order)
        await db.flush()

        position = Position(
            account_id=account.id,
            instrument_id=instrument.id,
            order_id=order.id,
            side=req.side,
            lots=req.lots,
            open_price=fill_price,
            stop_loss=req.stop_loss,
            take_profit=req.take_profit,
            status="open",
            commission=commission,
        )
        db.add(position)

        # Recomputed total = existing open-position margin + this new one (never
        # increment the stored value, which can drift/stick over many trades).
        account.margin_used = open_margin + required_margin
        account.balance -= commission
        account.equity = (account.balance or Decimal("0")) + (account.credit or Decimal("0")) + unrealized_pnl
        account.free_margin = account.equity - account.margin_used
        # Every balance change has a ledger row (QA: commission at open had
        # none, so balances could not be reconciled from transactions).
        if commission and Decimal(str(commission)) != 0:
            db.add(Transaction(
                user_id=user_id,
                account_id=account.id,
                type="commission",
                amount=-Decimal(str(commission)),
                balance_after=account.balance,
                reference_id=order.id,
                description=f"Commission {instrument.symbol} {req.side} {req.lots} lots",
            ))
        # IB accrual in THIS transaction, inside a savepoint: it can never
        # break the fill, a duplicate call is a no-op, and it is not lost if a
        # background task dies (it used to run fire-and-forget).
        await accrue_ib_commission_safe(db, user_id, order.id, Decimal(str(req.lots)), instrument.symbol)

    else:
        px = Decimal(str(req.price)) if req.price is not None else None
        slp_raw = getattr(req, "stop_limit_price", None)
        slp = Decimal(str(slp_raw)) if slp_raw is not None else None
        try:
            validate_pending_price(req.order_type, req.side, px, slp, bid, ask)
        except PendingOrderError as exc:
            raise HTTPException(status_code=400, detail=str(exc))
        # SL/TP must make sense against the price the order will FILL at (the
        # limit for limit / stop-limit, the stop for stop). Without this a buy
        # limit far below the market could carry an SL above its own entry and
        # be closed by the SL engine the instant it filled.
        entry_ref = slp if (str(req.order_type) == "stop_limit" and slp is not None) else px
        check_sltp_levels(str(req.side).lower() == "buy", req.stop_loss, req.take_profit, entry_ref, "order price")

        order.status = "pending"

    db.add(order)
    ua_hdr = (request.headers.get("user-agent") or "").strip()
    db.add(
        UserAuditLog(
            user_id=user_id,
            action_type="ORDER_PLACED",
            ip_address=ip_address,
            device_info=ua_hdr[:2048] if ua_hdr else None,
        )
    )
    await db.commit()

    # Fire-and-forget: email the user that a trade was placed. Captures
    # only what we need from the request-scoped objects so the background
    # task doesn't depend on the soon-to-be-closed DB session. Skips
    # demo accounts and wallet-placeholder addresses so the inbox doesn't
    # get spammed during testing/onboarding.
    _email_payload = {
        "user_id": user_id,
        "is_demo": bool(account.is_demo),
        "symbol": instrument.symbol,
        "side": str(req.side),
        "lots": float(req.lots),
        "order_type": str(req.order_type),
        "status": str(order.status),
        "price": float(req.price) if req.price else None,
        "filled_price": float(order.filled_price) if order.filled_price else None,
        "stop_loss": float(req.stop_loss) if req.stop_loss else None,
        "take_profit": float(req.take_profit) if req.take_profit else None,
    }

    async def _send_trade_placed_email():
        if _email_payload["is_demo"]:
            return
        try:
            from packages.common.src.smtp_mail import send_email, smtp_configured
            if not smtp_configured():
                return
            from packages.common.src.email_templates import render_trade_placed
            from packages.common.src.config import get_settings
            from datetime import datetime, timezone
            async with AsyncSessionLocal() as bg_db:
                u = (await bg_db.execute(
                    select(User).where(User.id == _email_payload["user_id"])
                )).scalar_one_or_none()
                await apply_email_brand(bg_db, u)
            if not u or not u.email:
                return
            if u.email.lower().endswith("@wallet.powertradefx.local"):
                return
            st = get_settings()
            subject, html, text = render_trade_placed(
                first_name=u.first_name,
                symbol=_email_payload["symbol"],
                side=_email_payload["side"],
                lots=_email_payload["lots"],
                order_type=_email_payload["order_type"],
                status=_email_payload["status"],
                price=_email_payload["price"],
                filled_price=_email_payload["filled_price"],
                stop_loss=_email_payload["stop_loss"],
                take_profit=_email_payload["take_profit"],
                when_utc=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
                trader_app_url=st.TRADER_APP_URL or "https://powertradefx.com",
            )
            await send_email(u.email, subject, html, text=text)
        except Exception as e:
            logger.warning("trade-placed email send failed: %s", e)

    asyncio.create_task(_send_trade_placed_email())

    # Fire-and-forget: notification + IB commission run in background (don't block response)
    if req.order_type == "market":
        # ── A-Book: forward trade to Corecen LP ──────────────────────────
        _pos_id_for_lp = str(position.id)
        _user_id_str = str(user_id)
        _symbol = instrument.symbol
        _side = req.side
        _lots = float(req.lots)
        _fill_price = float(fill_price)
        _sl = float(req.stop_loss) if req.stop_loss else None
        _tp = float(req.take_profit) if req.take_profit else None
        _leverage = account.leverage
        _contract_size = float(instrument.contract_size or 100000)
        _acct_id_str = str(account.id)
        _is_demo = bool(account.is_demo)

        async def _maybe_forward_to_corecen():
            # Demo account trades are always B-book — never forward to LP,
            # regardless of the user's A/B book_type flag.
            if _is_demo:
                return
            try:
                async with AsyncSessionLocal() as bg_db:
                    u = (await bg_db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
                    if u and (u.book_type or "B") == "A":
                        user_name = " ".join(filter(None, [u.first_name, u.last_name])) or ""
                        await corecen_trade_client.forward_trade_open(
                            position_id=_pos_id_for_lp,
                            user_id=_user_id_str,
                            user_email=u.email,
                            user_name=user_name,
                            symbol=_symbol,
                            side=_side,
                            volume=_lots,
                            open_price=_fill_price,
                            sl=_sl,
                            tp=_tp,
                            leverage=_leverage,
                            contract_size=_contract_size,
                            trading_account_id=_acct_id_str,
                        )
            except Exception as e:
                logger.error("[A-BOOK] Failed to forward trade open to Corecen: %s", e)

        asyncio.create_task(_maybe_forward_to_corecen())

        async def _post_order_tasks():
            async with AsyncSessionLocal() as bg_db:
                try:
                    await create_notification(
                        bg_db, user_id,
                        title=f"Order Filled — {instrument.symbol}",
                        message=f"{req.side.upper()} {req.lots} lots @ {order.filled_price}",
                        notif_type="trade", action_url="/trading",
                    )
                except Exception as e:
                    logger.warning("Post-order notification error: %s", e)
                # IB accrual now happens inside the order transaction.
                await bg_db.commit()
        asyncio.create_task(_post_order_tasks())

    asyncio.create_task(fire_event(KafkaTopics.ORDERS, str(order.id), {
        "event": "order_placed",
        "order_id": str(order.id),
        "symbol": instrument.symbol,
        "side": req.side,
        "lots": str(req.lots),
        "status": str(order.status),
    }))

    try:
        await redis_client.publish(f"account:{account.id}", json.dumps({
            "type": "order_update",
            "order_id": str(order.id),
            "status": str(order.status),
        }))
    except Exception:
        pass

    sv = order.side.value if hasattr(order.side, 'value') else str(order.side)
    otype_val = order.order_type.value if hasattr(order.order_type, 'value') else str(order.order_type)
    status_val = order.status.value if hasattr(order.status, 'value') else str(order.status)

    return {
        "id": str(order.id),
        "position_id": str(position.id) if req.order_type == "market" else None,
        "account_id": str(order.account_id),
        "symbol": instrument.symbol,
        "order_type": otype_val,
        "side": sv,
        "status": status_val,
        "lots": float(order.lots),
        "price": float(order.price) if order.price else None,
        "stop_loss": float(order.stop_loss) if order.stop_loss else None,
        "take_profit": float(order.take_profit) if order.take_profit else None,
        "filled_price": float(order.filled_price) if order.filled_price else None,
        "commission": float(order.commission or 0),
        "swap": float(order.swap or 0),
        "comment": order.comment,
        "created_at": order.created_at.isoformat() if order.created_at else None,
    }


async def list_orders(account_id: UUID, user_id: UUID, status: str | None, db: AsyncSession) -> list[dict]:
    await validate_account(account_id, user_id, db)

    query = select(Order).where(Order.account_id == account_id)
    if status:
        query = query.where(Order.status == status)
    query = query.order_by(Order.created_at.desc()).limit(100)

    result = await db.execute(query)
    orders = result.scalars().all()

    items = []
    for o in orders:
        sv = o.side.value if hasattr(o.side, 'value') else str(o.side)
        otype_val = o.order_type.value if hasattr(o.order_type, 'value') else str(o.order_type)
        status_val = o.status.value if hasattr(o.status, 'value') else str(o.status)
        items.append({
            "id": str(o.id),
            "account_id": str(o.account_id),
            "symbol": o.instrument.symbol if o.instrument else "",
            "order_type": otype_val,
            "side": sv,
            "status": status_val,
            "lots": float(o.lots),
            "price": float(o.price) if o.price else None,
            "stop_loss": float(o.stop_loss) if o.stop_loss else None,
            "take_profit": float(o.take_profit) if o.take_profit else None,
            "filled_price": float(o.filled_price) if o.filled_price else None,
            "commission": float(o.commission or 0),
            "swap": float(o.swap or 0),
            "comment": o.comment,
            "created_at": o.created_at.isoformat() if o.created_at else None,
        })
    return items


async def _reject_if_maintenance():
    from packages.common.src.settings_store import get_bool_setting
    if await get_bool_setting("maintenance_mode", False):
        raise HTTPException(
            status_code=503,
            detail="Platform is under maintenance. Trading is temporarily disabled.",
        )


async def modify_order(order_id: UUID, req, user_id: UUID, db: AsyncSession) -> dict:
    await _reject_if_maintenance()
    # Lock the order (fresh) so a modify can't race the engine filling it.
    result = await db.execute(
        select(Order).where(Order.id == order_id).with_for_update().execution_options(populate_existing=True)
    )
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    await validate_account(order.account_id, user_id, db)

    status_val = order.status.value if hasattr(order.status, 'value') else str(order.status)
    if status_val != "pending":
        raise HTTPException(status_code=400, detail="Can only modify pending orders")

    # Modify is validated EXACTLY like placement. QA 2026-09-28: without this
    # a resting buy limit could be edited to a price above the ask and the
    # engine filled it at market within 150 ms — a back door around the
    # "use a market order" rule and the market-order checks.
    instrument = await db.get(Instrument, order.instrument_id)
    if not instrument:
        raise HTTPException(status_code=400, detail="Instrument not found")
    bid, ask = await get_current_price(instrument.symbol)

    new_price = Decimal(str(req.price)) if req.price is not None else (
        Decimal(str(order.price)) if order.price is not None else None
    )
    slp = Decimal(str(order.stop_limit_price)) if order.stop_limit_price is not None else None
    try:
        validate_pending_price(order.order_type, order.side, new_price, slp, bid, ask)
    except PendingOrderError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if req.lots is not None:
        lots = Decimal(str(req.lots))
        ic_row = await db.execute(
            select(InstrumentConfig).where(InstrumentConfig.instrument_id == instrument.id)
        )
        ic = ic_row.scalar_one_or_none()
        min_lot = ic.min_lot_size if ic and ic.min_lot_size is not None else instrument.min_lot
        max_lot = ic.max_lot_size if ic and ic.max_lot_size is not None else instrument.max_lot
        if lots <= 0 or lots < min_lot or lots > max_lot:
            raise HTTPException(status_code=400, detail=f"Lot size must be between {min_lot} and {max_lot}")
        check_lot_step(lots, getattr(instrument, "lot_step", None) or Decimal("0.01"))
        order.lots = lots

    new_sl = req.stop_loss if req.stop_loss is not None else order.stop_loss
    new_tp = req.take_profit if req.take_profit is not None else order.take_profit
    otype = order.order_type.value if hasattr(order.order_type, 'value') else str(order.order_type)
    entry_ref = slp if (otype == "stop_limit" and slp is not None) else new_price
    is_buy = (order.side.value if hasattr(order.side, 'value') else str(order.side)).lower() == "buy"
    check_sltp_levels(is_buy, new_sl, new_tp, entry_ref, "order price")

    if req.stop_loss is not None:
        order.stop_loss = req.stop_loss
    if req.take_profit is not None:
        order.take_profit = req.take_profit
    if req.price is not None:
        order.price = new_price

    await db.commit()
    return {"message": "Order modified"}


async def cancel_order(order_id: UUID, user_id: UUID, db: AsyncSession) -> dict:
    await _reject_if_maintenance()
    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    await validate_account(order.account_id, user_id, db)

    status_val = order.status.value if hasattr(order.status, 'value') else str(order.status)
    if status_val != "pending":
        raise HTTPException(status_code=400, detail="Can only cancel pending orders")

    # Atomic: only a still-pending order can be cancelled. The pending-order
    # engine fills with the same WHERE status='pending' guard, so exactly one
    # of cancel / fill wins. QA: cancel answered "Order cancelled" while the
    # engine opened the position and charged commission.
    res = await db.execute(
        update(Order)
        .where(Order.id == order_id, Order.status == "pending")
        .values(status="cancelled")
        .execution_options(synchronize_session=False)
    )
    if res.rowcount != 1:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Order was already filled or cancelled")
    await db.commit()

    try:
        await redis_client.publish(f"account:{order.account_id}", json.dumps({
            "type": "order_update", "order_id": str(order_id), "status": "cancelled",
        }))
    except Exception:
        pass
    return {"message": "Order cancelled"}


# ─── Positions ────────────────────────────────────────────────────────────

async def list_positions(account_id: UUID, user_id: UUID, status: str, db: AsyncSession) -> list[dict]:
    result = await db.execute(
        select(TradingAccount).where(
            TradingAccount.id == account_id,
            TradingAccount.user_id == user_id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    query = select(Position).where(Position.account_id == account_id)
    if status == "open":
        query = query.where(Position.status == "open")
    elif status == "closed":
        query = query.where(Position.status == "closed")

    result = await db.execute(query.order_by(Position.created_at.desc()))
    positions = result.scalars().all()

    # One query for the copy markers instead of one per position.
    copy_ids = set()
    if positions:
        copy_ids = set((await db.execute(
            select(CopyTrade.investor_position_id).where(
                CopyTrade.investor_position_id.in_([p.id for p in positions])
            )
        )).scalars().all())
    quote_cache: dict = {}

    response = []
    for pos in positions:
        current_price = None
        profit = float(pos.profit or 0)
        sv = side_val(pos.side)
        contract_size = pos.instrument.contract_size if pos.instrument else Decimal("100000")

        tick_data = await price_cache.get(pos.instrument.symbol)
        pos_status = pos.status.value if hasattr(pos.status, 'value') else str(pos.status)

        if tick_data and pos_status == "open":
            tick = json.loads(tick_data)
            # Value open P&L at the quote a close would realise (per-trade
            # override / user spread), not the broadcast quote.
            q_bid, q_ask = await user_quote_for_position(
                db, pos, Decimal(str(tick["bid"])), Decimal(str(tick["ask"])),
                user_id=user_id, account=account, _cache=quote_cache,
            )
            current_price = float(q_bid) if sv == "buy" else float(q_ask)
            profit = float(await calc_pnl_live(pos.side, pos.open_price, Decimal(str(current_price)), pos.lots, contract_size, instrument=pos.instrument))

        trade_type = "copy_trade" if pos.id in copy_ids else "self_trade"

        pos_status_val = pos.status.value if hasattr(pos.status, 'value') else str(pos.status)
        response.append({
            "id": str(pos.id),
            "account_id": str(pos.account_id),
            "symbol": pos.instrument.symbol if pos.instrument else "",
            "side": sv,
            "lots": float(pos.lots),
            "open_price": float(pos.open_price),
            "current_price": current_price,
            "stop_loss": float(pos.stop_loss) if pos.stop_loss else None,
            "take_profit": float(pos.take_profit) if pos.take_profit else None,
            "swap": float(pos.swap or 0),
            "commission": float(pos.commission or 0),
            "profit": profit,
            "status": pos_status_val,
            "contract_size": float(contract_size),
            "trade_type": trade_type,
            # Whatever opened the position wrote this. A bot reconciling its
            # own book needs it to tell its positions from the ones the trader
            # opened by hand on the same account.
            "comment": pos.comment or "",
            "created_at": pos.created_at.isoformat() if pos.created_at else None,
            "closed_at": pos.closed_at.isoformat() if getattr(pos, 'closed_at', None) else None,
        })

    return response


async def modify_position(position_id: UUID, req, user_id: UUID, db: AsyncSession) -> dict:
    result = await db.execute(select(Position).where(Position.id == position_id))
    pos = result.scalar_one_or_none()
    if not pos:
        raise HTTPException(status_code=404, detail="Position not found")

    acct_result = await db.execute(
        select(TradingAccount).where(
            TradingAccount.id == pos.account_id,
            TradingAccount.user_id == user_id,
        )
    )
    acct_row = acct_result.scalar_one_or_none()
    if not acct_row:
        raise HTTPException(status_code=403, detail="Not your position")

    # Lock order account -> position, fresh values: an SL/TP edit must never
    # land on a position closed a moment earlier.
    acct_row = await lock_account(db, pos.account_id, user_id=user_id) or acct_row
    pos = await lock_position(db, position_id)
    if pos is None:
        raise HTTPException(status_code=404, detail="Position not found")
    pos_status = pos.status.value if hasattr(pos.status, 'value') else str(pos.status)
    if pos_status != "open":
        raise HTTPException(status_code=400, detail="Position is not open")

    # MAM / copy: a follower's mirrored position is driven by the master's
    # strategy, so its SL/TP is NOT the follower's to edit. Reject bracket edits
    # on copied positions (the follower can still CLOSE the position). A copied
    # position is one that appears as a CopyTrade.investor_position_id — the same
    # marker list_positions uses to tag trade_type='copy_trade'.
    is_copy_child = (await db.execute(
        select(CopyTrade.id).where(CopyTrade.investor_position_id == position_id).limit(1)
    )).scalar_one_or_none() is not None
    if is_copy_child:
        raise HTTPException(
            status_code=400,
            detail="This is a copied position — its SL/TP is set by the master strategy and can't be edited here.",
        )

    sv = side_val(pos.side)
    is_buy = sv == "buy"

    # Validate against the price the position would CLOSE at RIGHT NOW — BUY at
    # bid, SELL at ask — the same quote the SL/TP engine triggers on. This is
    # what allows break-even and profit-locking stops (validating against the
    # OPEN price wrongly blocks them). If the feed is dead (missing or stale
    # tick) fall back to the conservative open-price rule rather than accepting
    # blindly, so a level that would instantly trigger is still refused.
    ref = pos.open_price
    ref_label = "open price"
    try:
        tick_raw = await price_cache.get(pos.instrument.symbol) if pos.instrument else None
        if tick_raw:
            tick = json.loads(tick_raw)
            if not is_tick_stale(tick):
                ref = Decimal(str(tick["bid"])) if is_buy else Decimal(str(tick["ask"]))
                ref_label = "current price"
    except Exception as _q_exc:
        logger.debug("modify SL/TP quote lookup failed for %s: %s",
                     getattr(pos.instrument, "symbol", "?"), _q_exc)

    check_sltp_levels(is_buy, req.stop_loss, req.take_profit, Decimal(str(ref)), ref_label)

    # Distinguish "field omitted" from "field explicitly null". Pydantic's
    # model_fields_set holds only the keys the client actually sent, so:
    #   - chart drag sends ONE key   → only that bracket changes
    #   - positions-panel Save sends BOTH keys → each is set, or REMOVED when
    #     the client sends null (an empty SL/TP field = "clear this bracket")
    # A plain `is not None` check made removal impossible — clearing a field
    # left the old level in place, so the chart line never disappeared.
    fields_set = req.model_fields_set
    updated = False
    if "stop_loss" in fields_set:
        pos.stop_loss = req.stop_loss  # None clears it
        updated = True
    if "take_profit" in fields_set:
        pos.take_profit = req.take_profit  # None clears it
        updated = True

    mirrored_accounts: list = []
    if updated:
        # A master's SL/TP change applies to every open copy of this position
        # (QA 2026-09-29: copies kept the SL/TP from the moment they opened,
        # and followers can't edit them). Only the brackets actually sent are
        # copied; null clears them, as on the master.
        copies = (await db.execute(
            select(CopyTrade).where(CopyTrade.master_position_id == position_id, CopyTrade.status == "open")
        )).scalars().all()
        for c in copies:
            fp = await lock_position(db, c.investor_position_id) if c.investor_position_id else None
            if fp is None:
                continue
            fst = fp.status.value if hasattr(fp.status, "value") else str(fp.status)
            if fst != "open":
                continue
            if "stop_loss" in fields_set:
                fp.stop_loss = req.stop_loss
            if "take_profit" in fields_set:
                fp.take_profit = req.take_profit
            mirrored_accounts.append((fp.account_id, fp.id, fp.stop_loss, fp.take_profit))

    if updated:
        await db.commit()
        for _acc, _pid, _sl, _tp in mirrored_accounts:
            try:
                await redis_client.publish(f"account:{_acc}", json.dumps({
                    "type": "position_updated", "position_id": str(_pid),
                    "stop_loss": float(_sl) if _sl else None,
                    "take_profit": float(_tp) if _tp else None,
                }))
            except Exception:
                pass

        # Push a position_updated event so every client on this account (chart
        # lines, positions table, mobile) reflects the new SL/TP live via WS.
        try:
            await redis_client.publish(
                f"account:{acct_row.id}",
                json.dumps({
                    "type": "position_updated",
                    "position_id": str(position_id),
                    "stop_loss": float(pos.stop_loss) if pos.stop_loss else None,
                    "take_profit": float(pos.take_profit) if pos.take_profit else None,
                }),
            )
        except Exception as _pub_exc:
            logger.debug("position_updated publish failed: %s", _pub_exc)

        # ── A-Book: forward SL/TP update to Corecen LP ──────────────────
        _pos_id_str = str(position_id)
        _new_sl = float(pos.stop_loss) if pos.stop_loss else None
        _new_tp = float(pos.take_profit) if pos.take_profit else None
        _is_demo = bool(acct_row.is_demo)

        async def _maybe_forward_update_to_corecen():
            if _is_demo:
                return
            try:
                async with AsyncSessionLocal() as bg_db:
                    u = (await bg_db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
                    if u and (u.book_type or "B") == "A":
                        await corecen_trade_client.forward_trade_update(
                            position_id=_pos_id_str,
                            sl=_new_sl,
                            tp=_new_tp,
                        )
            except Exception as e:
                logger.error("[A-BOOK] Failed to forward SL/TP update to Corecen: %s", e)

        asyncio.create_task(_maybe_forward_update_to_corecen())

    return {
        "message": "Position modified",
        "stop_loss": float(pos.stop_loss) if pos.stop_loss else None,
        "take_profit": float(pos.take_profit) if pos.take_profit else None,
    }


async def close_position(
    position_id: UUID, req, user_id: UUID, db: AsyncSession,
    close_reason_override: str | None = None,
) -> dict:
    result = await db.execute(select(Position).where(Position.id == position_id))
    pos = result.scalar_one_or_none()
    if not pos:
        raise HTTPException(status_code=404, detail="Position not found")

    acct_result = await db.execute(
        select(TradingAccount).where(
            TradingAccount.id == pos.account_id,
            TradingAccount.user_id == user_id,
        )
    )
    account = acct_result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=403, detail="Not your position")

    pos_status = pos.status.value if hasattr(pos.status, 'value') else str(pos.status)
    if pos_status != "open":
        raise HTTPException(status_code=400, detail="Position is not open")

    # Race-safe close. Canonical lock order everywhere: account -> position
    # (place_order locks the account; SL/TP, stop-out, admin and copy closes
    # follow the same order), so closers on one account serialise without
    # deadlocking. Both locks re-read FRESH values (populate_existing): the
    # previous code refreshed only `status`, so two partial closes each saw
    # the original lot count and together closed 16 lots of a 10-lot
    # position, and a stale balance overwrote a concurrent credit.
    account = await lock_account(db, pos.account_id, user_id=user_id)
    if account is None:
        raise HTTPException(status_code=403, detail="Not your position")
    pos = await lock_position(db, position_id)
    if pos is None:
        raise HTTPException(status_code=404, detail="Position not found")
    locked_status = pos.status.value if hasattr(pos.status, "value") else str(pos.status)
    if locked_status != "open":
        raise HTTPException(status_code=409, detail="Position is already closed")

    # MAM gives followers independent control of their own allocated account:
    # a follower CAN close their mirrored position (it lives on the follower's
    # account). If the master later closes the original, the copy engine looks
    # this position up, finds it already closed, and skips it — no divergence
    # error. (Previously this raised 403 and only the master could close.)

    tick_data = await price_cache.get(pos.instrument.symbol)
    if not tick_data:
        raise HTTPException(status_code=400, detail="No price available")

    tick = json.loads(tick_data)
    # C-TRADE-5: refuse to settle a close against a stale quote (market closed
    # or feed frozen). get_current_price() and modify_position() already guard
    # this; close_position read the cache directly and could realise P&L at an
    # old price. Same is_tick_stale() check keeps every execution path aligned.
    if is_tick_stale(tick):
        raise HTTPException(status_code=400, detail="Price feed is stale; try again shortly")
    sv = side_val(pos.side)
    c_bid = Decimal(str(tick["bid"]))
    c_ask = Decimal(str(tick["ask"]))
    had_spread_override = pos.spread_override is not None
    # One function decides the quote a position closes at (per-trade override
    # > user's execution spread > broadcast). The positions list values open
    # P&L with the same function, so shown P&L == realised P&L.
    c_bid, c_ask = await user_quote_for_position(db, pos, c_bid, c_ask, user_id=user_id, account=account, fresh=True)
    close_price = c_bid if sv == "buy" else c_ask
    contract_size = pos.instrument.contract_size if pos.instrument else Decimal("100000")

    # C-TRADE-2: the schema bounds lots to 0 < lots <= 100; reject an explicit
    # request to close MORE than the open size (previously silently clamped,
    # which masked client bugs). None = close the whole position.
    if req.lots is not None and Decimal(str(req.lots)) > pos.lots:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot close {req.lots} lots; position holds {pos.lots}.",
        )
    close_lots = Decimal(str(req.lots)) if req.lots and Decimal(str(req.lots)) < pos.lots else pos.lots
    is_partial = close_lots < pos.lots
    if is_partial and pos.instrument is not None:
        # Partial volumes follow the lot step, and must not leave dust below the
        # minimum lot open (QA left a 0.004-lot remainder no one could close).
        _min_lot, _max_lot, _step, _ic = await lot_limits(db, pos.instrument)
        check_lot_step(close_lots, _step, "Close volume")
        if pos.lots - close_lots < _min_lot:
            raise HTTPException(
                status_code=400,
                detail=f"Closing {close_lots} would leave {pos.lots - close_lots} lots, below the minimum {_min_lot}. Close the whole position instead.",
            )

    full_profit = await calc_pnl_live(pos.side, pos.open_price, close_price, pos.lots, contract_size, instrument=pos.instrument)

    # If the market price has already crossed the position's SL/TP level, label
    # this close as SL/TP in trade history instead of "manual" — covers the case
    # where the SL/TP engine was racing and the user's close request landed first.
    detected_reason = "manual"
    if pos.stop_loss:
        sl = Decimal(str(pos.stop_loss))
        if sv == "buy" and close_price <= sl:
            detected_reason = "sl"
        elif sv == "sell" and close_price >= sl:
            detected_reason = "sl"
    if detected_reason == "manual" and pos.take_profit:
        tp = Decimal(str(pos.take_profit))
        if sv == "buy" and close_price >= tp:
            detected_reason = "tp"
        elif sv == "sell" and close_price <= tp:
            detected_reason = "tp"
    # Caller-supplied audit label (e.g. "algo_close") — only replaces the
    # default "manual"; a detected SL/TP crossing always wins.
    if close_reason_override and detected_reason == "manual":
        detected_reason = close_reason_override

    if is_partial:
        ratio = close_lots / pos.lots
        partial_profit = full_profit * ratio
        partial_commission = (pos.commission or Decimal("0")) * ratio
        partial_swap = (pos.swap or Decimal("0")) * ratio

        pos.lots -= close_lots
        # The closed part takes its share of the charges with it; the part
        # still open keeps only the rest. Otherwise the final close books the
        # full commission and swap again and the history overstates them.
        pos.commission = (pos.commission or Decimal("0")) - partial_commission
        pos.swap = (pos.swap or Decimal("0")) - partial_swap

        history = TradeHistory(
            position_id=pos.id,
            account_id=pos.account_id,
            instrument_id=pos.instrument_id,
            side=pos.side,
            lots=close_lots,
            open_price=pos.open_price,
            close_price=close_price,
            swap=partial_swap,
            commission=partial_commission,
            profit=partial_profit,
            close_reason=detected_reason,
            opened_at=pos.created_at,
            closed_at=datetime.utcnow(),
        )
        db.add(history)

        account.balance += partial_profit
        await _settle_follower_fee_if_copy(db, pos, partial_profit, account, final=False)
        partial_margin = await margin_for(close_lots, pos.open_price, pos.instrument, account.leverage)
        account.margin_used = max(Decimal("0"), (account.margin_used or Decimal("0")) - partial_margin)

        result_msg = f"Partial close: {close_lots} lots"
        result_profit = partial_profit
    else:
        pos.status = "closed"
        pos.close_price = close_price
        pos.profit = full_profit
        pos.closed_at = datetime.utcnow()

        history = TradeHistory(
            position_id=pos.id,
            account_id=pos.account_id,
            instrument_id=pos.instrument_id,
            side=pos.side,
            lots=pos.lots,
            open_price=pos.open_price,
            close_price=close_price,
            swap=pos.swap or Decimal("0"),
            commission=pos.commission or Decimal("0"),
            profit=full_profit,
            close_reason=detected_reason,
            opened_at=pos.created_at,
            closed_at=datetime.utcnow(),
        )
        db.add(history)

        account.balance += full_profit
        await _settle_follower_fee_if_copy(db, pos, full_profit, account, final=True)
        margin_release = await margin_for(pos.lots, pos.open_price, pos.instrument, account.leverage)
        account.margin_used = max(Decimal("0"), (account.margin_used or Decimal("0")) - margin_release)

        result_msg = "Position closed"
        result_profit = full_profit

    # Recompute margin_used from the REMAINING open positions instead of trusting
    # the incremental subtraction above — over many trades the running value can
    # drift/stick, which then wrongly blocks new orders with "Insufficient
    # margin" on an account that actually has plenty free. This self-heals it.
    _rem = await db.execute(
        select(Position).options(selectinload(Position.instrument)).where(
            Position.account_id == account.id, Position.status == "open",
        )
    )
    _om = Decimal("0")
    for _p in _rem.scalars().all():
        _om += await margin_for(_p.lots, _p.open_price, _p.instrument, account.leverage)
    account.margin_used = _om
    account.equity = account.balance + (account.credit or Decimal("0"))
    account.free_margin = account.equity - (account.margin_used or Decimal("0"))

    tx = Transaction(
        user_id=user_id,
        account_id=account.id,
        type="profit" if result_profit >= 0 else "loss",
        amount=result_profit,
        balance_after=account.balance,
        reference_id=pos.id,
        description=f"{'Partial ' if is_partial else ''}Close {pos.instrument.symbol} {sv} {close_lots} lots @ {close_price}",
    )
    db.add(tx)

    # Bonus wagering — feed this trade's lots into the FIFO release queue.
    # Demo accounts skipped inside the function so users can't farm demo
    # volume to release real bonus money. Errors swallowed so a bonus
    # release bug can never block a close.
    try:
        await wallet_service.release_bonuses_after_trade(
            user_id=user_id,
            traded_lots=Decimal(str(close_lots)),
            is_demo_account=bool(account.is_demo),
            db=db,
        )
    except Exception as _bonus_exc:
        logger.debug("bonus release after close failed: %s", _bonus_exc)

    await db.commit()

    # A fully-closed trade that carried a per-trade spread override no longer
    # drives the owner's live quote — revert it instantly (the override is
    # keyed on OPEN positions). A partial close keeps the position open, so its
    # override stays in force and we must NOT revert.
    if had_spread_override and not is_partial:
        try:
            await publish_instrument_config_reload()
        except Exception:
            pass

    # Fire-and-forget: notification, Kafka event, Redis publish — don't block response
    _pos_symbol = pos.instrument.symbol if pos.instrument else ""
    _pos_id = str(pos.id)
    _acct_id = str(account.id)
    _profit_str = str(result_profit)
    pnl_str = f"+${float(result_profit):.2f}" if result_profit >= 0 else f"-${abs(float(result_profit)):.2f}"

    async def _post_close_tasks():
        async with AsyncSessionLocal() as bg_db:
            try:
                await create_notification(
                    bg_db, user_id,
                    title=f"{'Partial Close' if is_partial else 'Position Closed'} — {_pos_symbol}",
                    message=f"{sv.upper()} {close_lots} lots @ {close_price} | P&L: {pnl_str}",
                    notif_type="trade", action_url="/trading",
                )
            except Exception:
                pass
        try:
            await redis_client.publish(f"account:{_acct_id}", json.dumps({
                "type": "position_closed",
                "position_id": _pos_id,
                "profit": _profit_str,
            }))
        except Exception:
            pass

    asyncio.create_task(_post_close_tasks())
    asyncio.create_task(fire_event(KafkaTopics.TRADES, _pos_id, {
        "event": "position_closed",
        "position_id": _pos_id,
        "symbol": _pos_symbol,
        "profit": _profit_str,
        "partial": is_partial,
    }))

    # ── A-Book: forward close to Corecen LP ──────────────────────────
    _close_price_f = float(close_price)
    _result_profit_f = float(result_profit)
    _close_reason = detected_reason.upper() if detected_reason != "manual" else "USER"
    _is_demo = bool(account.is_demo)

    async def _maybe_forward_close_to_corecen():
        if _is_demo:
            return
        try:
            async with AsyncSessionLocal() as bg_db:
                u = (await bg_db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
                if u and (u.book_type or "B") == "A":
                    await corecen_trade_client.forward_trade_close(
                        position_id=_pos_id,
                        close_price=_close_price_f,
                        pnl=_result_profit_f,
                        closed_by=_close_reason,
                    )
        except Exception as e:
            logger.error("[A-BOOK] Failed to forward trade close to Corecen: %s", e)

    asyncio.create_task(_maybe_forward_close_to_corecen())

    return {
        "message": result_msg,
        "close_price": float(close_price),
        "profit": float(result_profit),
        "lots_closed": float(close_lots),
        "remaining_lots": float(pos.lots) if is_partial else 0,
        "balance": float(account.balance),
    }
