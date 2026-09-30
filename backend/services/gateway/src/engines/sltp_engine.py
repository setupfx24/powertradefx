"""SL/TP Monitoring Engine — Auto-closes positions when Stop Loss or Take Profit is hit.

Subscribes to the Redis price channel and checks all open positions with SL/TP
against every incoming tick. Closes positions at the SL/TP price (not market price)
to match MT5 behavior.
"""
import asyncio
import json
import logging
from datetime import datetime
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.redis_client import redis_client, PriceChannel, is_tick_stale
from packages.common.src.models import (
    Position, TradingAccount, Transaction, TradeHistory, Instrument, User,
)
from packages.common.src.notify import create_notification
from packages.common.src import corecen_trade_client
from packages.common.src.engine_lock import engine_lock
from packages.common.src.row_locks import lock_account, lock_position
from packages.common.src.trading_service import margin_for, recompute_account_margin
from ..services import wallet_service

logger = logging.getLogger("gateway.sltp")

CHECK_INTERVAL = 1.0


def _side_val(side) -> str:
    return side.value if hasattr(side, 'value') else str(side)


class SLTPEngine:
    def __init__(self):
        self._running = False
        self._task = None
        self._prices: dict[str, dict] = {}

    async def start(self):
        self._running = True
        self._task = asyncio.create_task(self._run())
        logger.info("SL/TP engine started")

    async def stop(self):
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("SL/TP engine stopped")

    async def _run(self):
        while self._running:
            try:
                await self._load_prices()
                await self._check_positions()
                await asyncio.sleep(CHECK_INTERVAL)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error("SL/TP engine error: %s", e)
                await asyncio.sleep(3)

    async def _load_prices(self):
        """Load latest prices directly from Redis keys instead of pubsub."""
        try:
            # Phase 3: SCAN, not KEYS. KEYS is O(N) over the entire keyspace and
            # blocks the single-threaded Redis for every SL/TP tick; scan_iter
            # walks the keyspace in small cursored batches without blocking.
            keys = [k async for k in redis_client.scan_iter(match="tick:*", count=500)]
            if not keys:
                return
            values = await redis_client.mget(keys)
            for val in values:
                if val:
                    try:
                        data = json.loads(val)
                        self._prices[data["symbol"]] = data
                    except (json.JSONDecodeError, KeyError):
                        pass
        except Exception as e:
            logger.warning("Failed to load prices: %s", e)

    async def _check_positions(self):
        if not self._prices:
            return

        # Leader-election: only one gateway worker runs this tick.
        # See packages.common.src.engine_lock for the why.
        async with engine_lock("sltp", ttl_seconds=10) as is_leader:
            if not is_leader:
                return
            await self._check_positions_locked()

    def _side_quote(self, tick, spread_override, spread_override_type, pip_size, digits):
        """(bid, ask) this position trades at: the broadcast quote, re-centred
        on the per-trade admin spread override when one is set (the same quote
        the trader sees and a manual close uses)."""
        bid = Decimal(str(tick["bid"]))
        ask = Decimal(str(tick["ask"]))
        if spread_override is not None:
            from packages.common.src.instrument_pricing import symmetric_quote_from_mid
            mid = (bid + ask) / Decimal("2")
            bid, ask = symmetric_quote_from_mid(
                mid, Decimal(str(spread_override)), (spread_override_type or "pips"),
                Decimal(str(pip_size or "0.0001")), int(digits or 5), Decimal("0"),
            )
        return bid, ask

    @staticmethod
    def _trigger(side, sl, tp, bid, ask):
        """(reason, close_price) or (None, None).

        TRIGGER on the MID: an artificial spread (e.g. an admin widening it
        while the market never moved) must never fire a trader's SL/TP — a
        client complaint this rule exists for. FILL: at the level when the
        level is inside the current quote (the market really traded there);
        through a GAP (the whole quote jumped past the level) at the side's
        real market price — bid for a buy, ask for a sell — so the broker
        does not absorb the gap (QA 2026-09-29) and a gap in the trader's
        favour on a TP is honoured at the better price."""
        mid = (bid + ask) / Decimal("2")
        market = bid if side == "buy" else ask

        def fill(level):
            return level if bid <= level <= ask else market

        if sl is not None:
            sl = Decimal(str(sl))
            if (side == "buy" and mid <= sl) or (side == "sell" and mid >= sl):
                return "sl", fill(sl)
        if tp is not None:
            tp = Decimal(str(tp))
            if (side == "buy" and mid >= tp) or (side == "sell" and mid <= tp):
                return "tp", fill(tp)
        return None, None

    async def _check_positions_locked(self):
        """Read open SL/TP positions WITHOUT locks, evaluate triggers, then
        close each triggered position in its OWN transaction (lock account ->
        lock position -> re-check on fresh values). One failing close never
        rolls back the others, and no row locks are held across the pass."""
        async with AsyncSessionLocal() as db:
            rows = (await db.execute(
                select(
                    Position.id, Position.account_id, Position.side,
                    Position.stop_loss, Position.take_profit,
                    Position.spread_override, Position.spread_override_type,
                    Instrument.symbol, Instrument.pip_size, Instrument.digits,
                )
                .join(Instrument, Instrument.id == Position.instrument_id)
                .where(Position.status == "open")
                .where((Position.stop_loss.isnot(None)) | (Position.take_profit.isnot(None)))
            )).all()

        for (pid, acct_id, side_raw, sl, tp, ovr, ovr_type, symbol, pip, digits) in rows:
            tick = self._prices.get(symbol)
            if not tick or is_tick_stale(tick):
                continue  # a dead feed never triggers an SL/TP
            try:
                bid, ask = self._side_quote(tick, ovr, ovr_type, pip, digits)
                reason, _px = self._trigger(_side_val(side_raw), sl, tp, bid, ask)
                if reason:
                    await self._close_one(pid, acct_id)
            except Exception as e:
                logger.error("SL/TP close failed for position %s: %s", pid, e, exc_info=True)

    async def _close_one(self, position_id, account_id):
        async with AsyncSessionLocal() as db:
            try:
                account = await lock_account(db, account_id)
                pos = await lock_position(db, position_id)
                if pos is None or account is None:
                    await db.rollback()
                    return
                st = pos.status.value if hasattr(pos.status, "value") else str(pos.status)
                if st != "open" or not pos.instrument:
                    await db.rollback()
                    return  # closed meanwhile by the user / admin / stop-out
                tick = self._prices.get(pos.instrument.symbol)
                if not tick or is_tick_stale(tick):
                    await db.rollback()
                    return
                bid, ask = self._side_quote(
                    tick, pos.spread_override, pos.spread_override_type,
                    pos.instrument.pip_size, pos.instrument.digits,
                )
                # Re-evaluate on the fresh row: SL/TP may have been edited.
                reason, close_px = self._trigger(_side_val(pos.side), pos.stop_loss, pos.take_profit, bid, ask)
                if not reason:
                    await db.rollback()
                    return
                await self._close_position(db, pos, close_px, reason, account=account)
                await db.commit()
            except Exception:
                await db.rollback()
                raise

    async def _close_position(
        self, db: AsyncSession, pos: Position, close_price: Decimal, reason: str,
        account=None,
    ):
        """Book the close. Caller holds the account lock and the position lock
        (lock_account -> lock_position) and has re-checked the position is open."""

        side = _side_val(pos.side)
        contract_size = pos.instrument.contract_size if pos.instrument else Decimal("100000")

        if side == "buy":
            profit = (close_price - pos.open_price) * pos.lots * contract_size
        else:
            profit = (pos.open_price - close_price) * pos.lots * contract_size
        from ..services.trading_service import quote_to_account_pnl
        from packages.common.src.trading_service import cross_rate_for
        profit = quote_to_account_pnl(
            profit,
            getattr(pos.instrument, "base_currency", None),
            getattr(pos.instrument, "quote_currency", None),
            close_price,
            symbol=getattr(pos.instrument, "symbol", None),
            cross_rate=await cross_rate_for(pos.instrument),
        )

        pos.status = "closed"
        pos.close_price = close_price
        pos.profit = profit
        pos.closed_at = datetime.utcnow()
        pos.comment = f"Auto-closed by {reason.upper()}"

        # Lock the account row (FOR UPDATE) before mutating balance — otherwise a
        # concurrent close on the same account (manual close, another SL/TP, or a
        # stop-out) can lose-update the balance. Position is already locked above.
        if account is None:
            account = await lock_account(db, pos.account_id)
        if account:
            account.balance += profit
            await db.flush()
            await recompute_account_margin(db, account)

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
            profit=profit,
            close_reason=reason,
            opened_at=pos.created_at,
            closed_at=datetime.utcnow(),
        )
        db.add(history)

        tx = Transaction(
            user_id=account.user_id if account else pos.account_id,
            account_id=pos.account_id,
            type="profit" if profit >= 0 else "loss",
            amount=profit,
            balance_after=account.balance if account else None,
            reference_id=pos.id,
            description=f"{reason.upper()} hit: {pos.instrument.symbol if pos.instrument else ''} {side} {pos.lots} lots @ {close_price}",
        )
        db.add(tx)

        # Bonus wagering — feed the auto-closed lots into the FIFO release
        # queue. Skips demo accounts (function-internal). Errors swallowed
        # so a release bug can never block an SL/TP trigger.
        if account and account.user_id:
            try:
                await wallet_service.release_bonuses_after_trade(
                    user_id=account.user_id,
                    traded_lots=Decimal(str(pos.lots)),
                    is_demo_account=bool(account.is_demo),
                    db=db,
                )
            except Exception as _bonus_exc:
                logger.debug("bonus release after SL/TP close failed: %s", _bonus_exc)

        try:
            await redis_client.publish(f"account:{pos.account_id}", json.dumps({
                "type": "position_closed",
                "position_id": str(pos.id),
                "reason": reason,
                "profit": str(profit),
                "close_price": str(close_price),
            }))
        except Exception:
            pass

        symbol = pos.instrument.symbol if pos.instrument else "?"
        pnl_str = f"+${float(profit):.2f}" if profit >= 0 else f"-${abs(float(profit)):.2f}"
        reason_label = "Stop Loss" if reason == "sl" else "Take Profit"

        if account:
            await create_notification(
                db, account.user_id,
                title=f"{reason_label} Hit — {symbol}",
                message=f"{side.upper()} {pos.lots} lots closed @ {close_price} | P&L: {pnl_str}",
                notif_type="trade",
                action_url="/trading",
                commit=False,
            )

        logger.info(
            "%s triggered: %s %s %s lots @ %s → P&L: %s",
            reason.upper(), symbol, side, pos.lots, close_price, profit
        )

        # ── A-Book: forward SL/TP close to Corecen LP ────────────────────
        _pos_id = str(pos.id)
        _cp = float(close_price)
        _pnl = float(profit)
        _reason_upper = reason.upper()
        _user_id = account.user_id if account else None
        _is_demo = bool(account.is_demo) if account else True

        async def _forward_sltp_close():
            try:
                if not _user_id or _is_demo:
                    return
                async with AsyncSessionLocal() as bg_db:
                    u = (await bg_db.execute(select(User).where(User.id == _user_id))).scalar_one_or_none()
                    if u and (u.book_type or "B") == "A":
                        await corecen_trade_client.forward_trade_close(
                            position_id=_pos_id,
                            close_price=_cp,
                            pnl=_pnl,
                            closed_by=_reason_upper,
                        )
            except Exception as exc:
                logger.error("[A-BOOK] SL/TP close forward failed: %s", exc)

        asyncio.create_task(_forward_sltp_close())


sltp_engine = SLTPEngine()
