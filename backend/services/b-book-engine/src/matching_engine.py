"""B-Book Matching Engine — All orders execute against the house book.

This is the core execution engine. In a B-Book model:
- Market orders fill immediately at current bid/ask
- Pending orders (limit, stop, stop-limit) are monitored and triggered when price conditions are met
- No external liquidity — the admin/house is the counterparty to every trade
- Executable bid/ask in Redis already include platform spread (market-data service)
"""
import asyncio
import json
import logging
from decimal import Decimal
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import (
    Order, OrderType, OrderSide, OrderStatus,
    Position, PositionStatus, TradingAccount, Instrument, Transaction,
)
from packages.common.src.redis_client import redis_client, PriceChannel, is_tick_stale
from packages.common.src.instrument_pricing import resolve_commission
from packages.common.src.ib_commission import accrue_ib_commission_safe, settle_ib_commissions
from packages.common.src.row_locks import lock_account
from packages.common.src.pending_orders import evaluate_trigger
from packages.common.src.market_hours import is_market_open
from packages.common.src.settings_store import get_bool_setting
from packages.common.src.trading_service import quote_to_account_pnl, cross_rate_for, margin_for

logger = logging.getLogger("b-book-engine")


class MatchingEngine:
    """Fills pending (limit/stop/stop-limit) orders against live ticks.

    SL/TP monitoring deliberately does NOT live here. The gateway's
    sltp_engine is the single SL/TP authority: it locks rows
    (FOR UPDATE SKIP LOCKED), closes at the exact SL/TP price (MT5
    semantics) and writes TradeHistory + Transaction rows. A second
    monitor in this service used to race it with none of those
    guarantees — phantom closes at market price with no history rows.
    """

    def __init__(self):
        self._running = False

    async def start(self):
        self._running = True
        logger.info("B-Book Matching Engine started")
        await asyncio.gather(self._monitor_pending_orders(), self._settle_ib_loop())

    async def _settle_ib_loop(self) -> None:
        """Release IB accruals whose source trade has closed (every 10 s).

        Lives here rather than on every close path (manual, SL/TP, stop-out,
        copy, algo) so ONE loop is the single place an accrual becomes a
        payable commission, whatever closed the trade. Money still only
        moves when an admin approves the payout (business_service)."""
        while self._running:
            try:
                async with AsyncSessionLocal() as db:
                    n = await settle_ib_commissions(db)
                    await db.commit()
                    if n:
                        logger.info("IB settlement: %d commission(s) released to pending payout", n)
            except Exception as e:
                logger.error(f"IB settlement error: {e}")
            await asyncio.sleep(10.0)

    async def stop(self):
        self._running = False

    async def _get_price(self, symbol: str) -> Optional[tuple[Decimal, Decimal]]:
        tick_data = await redis_client.get(PriceChannel.tick_key(symbol))
        if not tick_data:
            return None
        tick = json.loads(tick_data)
        # A stale quote (dead feed / refresher republish) must never trigger
        # a pending-order fill — same rule every enforcement path follows.
        if is_tick_stale(tick):
            return None
        return Decimal(str(tick["bid"])), Decimal(str(tick["ask"]))

    async def _monitor_pending_orders(self):
        """Monitor pending orders and fill / convert / expire them.

        Each pass READS the pending book without locks and evaluates triggers
        against live ticks. Every order that needs action is then handled in
        its OWN short transaction (lock account -> lock order FOR UPDATE SKIP
        LOCKED -> re-check it is still pending -> act -> commit). QA
        2026-09-29: the whole pass used to be one transaction, so a single
        failing fill (e.g. an IB accrual error) rolled back or froze every
        pending fill platform-wide, and row locks were held for the whole pass.
        """
        logger.info("Pending order monitor started")
        while self._running:
            try:
                async with AsyncSessionLocal() as db:
                    rows = (await db.execute(
                        select(
                            Order.id, Order.account_id, Order.order_type, Order.side,
                            Order.price, Order.stop_limit_price, Order.expires_at,
                            Instrument.symbol,
                        )
                        .join(Instrument, Instrument.id == Order.instrument_id)
                        .where(Order.status == OrderStatus.PENDING)
                    )).all()
                now = datetime.now(timezone.utc)
                prices: dict = {}
                for (oid, acct_id, otype, side, price, slp, expires_at, symbol) in rows:
                    try:
                        if expires_at is not None:
                            exp = expires_at if expires_at.tzinfo else expires_at.replace(tzinfo=timezone.utc)
                            if now > exp:
                                await self._expire_order(oid)
                                continue
                        if symbol not in prices:
                            prices[symbol] = await self._get_price(symbol)
                        price_data = prices[symbol]
                        if not price_data:
                            continue
                        bid, ask = price_data
                        decision = evaluate_trigger(otype, side, price, slp, bid, ask)
                        if decision.convert_to_limit is not None:
                            await self._convert_stop_limit(oid, decision.convert_to_limit)
                        elif decision.triggered:
                            await self._fill_one(oid, acct_id, decision.fill_price)
                    except Exception as e:  # one bad order never blocks the rest
                        logger.error("Pending order %s failed this pass: %s", oid, e, exc_info=True)
            except Exception as e:
                logger.error(f"Pending order monitor error: {e}")

            await asyncio.sleep(0.1)

    async def _expire_order(self, order_id) -> None:
        async with AsyncSessionLocal() as db:
            await db.execute(
                update(Order).where(Order.id == order_id, Order.status == OrderStatus.PENDING)
                .values(status=OrderStatus.EXPIRED)
            )
            await db.commit()

    async def _convert_stop_limit(self, order_id, limit_price) -> None:
        """Stop leg of a stop-limit hit: it now rests as a plain limit at the
        limit price (MT5 semantics). stop_limit_price stays on the row for audit."""
        async with AsyncSessionLocal() as db:
            res = await db.execute(
                update(Order)
                .where(Order.id == order_id, Order.status == OrderStatus.PENDING,
                       Order.order_type == OrderType.STOP_LIMIT)
                .values(order_type=OrderType.LIMIT, price=limit_price)
            )
            await db.commit()
            if res.rowcount:
                logger.info("Stop-limit %s triggered: now a limit @ %s", order_id, limit_price)

    async def _fill_one(self, order_id, account_id, fill_price) -> None:
        """Fill one triggered order in its own transaction."""
        async with AsyncSessionLocal() as db:
            try:
                # Canonical lock order: account -> order. The gateway's
                # place_order / cancel take the account / conditional-update
                # the order the same way, so they serialise, never deadlock.
                account = await lock_account(db, account_id)
                order = (await db.execute(
                    select(Order).where(Order.id == order_id)
                    .with_for_update(skip_locked=True)
                    .execution_options(populate_existing=True)
                )).scalar_one_or_none()
                if order is None or order.status != OrderStatus.PENDING:
                    await db.rollback()  # cancelled / filled / held elsewhere
                    return
                await self._execute_pending_order(order, fill_price, db, account=account)
                await db.commit()
            except Exception:
                await db.rollback()
                raise

    async def _execute_pending_order(self, order: Order, fill_price: Decimal, db: AsyncSession, account=None):
        """Open the position for a triggered pending order at fill_price
        (limit price for limits, market for stops — see pending_orders)."""
        # Maintenance mode blocks pending fills exactly like it blocks
        # market orders in the gateway. The order stays pending and will
        # fill on the first tick after maintenance ends (if still valid).
        if await get_bool_setting("maintenance_mode", False):
            return

        # H-TRADE-9: re-check status before filling. The row is held under the
        # monitor's SKIP LOCKED lock, but this guards against a status change
        # applied earlier in the same batch (expiry) or a stale in-memory copy.
        if order.status != OrderStatus.PENDING:
            return

        # Lock the account row: a pending fill races concurrent gateway
        # market orders on the same account, and both paths read + rewrite
        # margin_used/balance. The gateway's place_order takes the same
        # FOR UPDATE lock, so the two serialize instead of double-spending
        # the margin pool. Released at the outer loop's commit.
        if account is None:
            account = await lock_account(db, order.account_id)
        if not account or not account.is_active:
            order.status = OrderStatus.REJECTED
            return

        instrument = await db.get(Instrument, order.instrument_id)

        # Never fill into a closed market (mirrors the gateway's market-order
        # check). Ticks shouldn't arrive while closed, but the stale-quote
        # refresher and crypto side-feeds make this worth an explicit guard.
        segment_name = instrument.segment.name if instrument.segment else ""
        market_open, _closed_reason = is_market_open(
            instrument.symbol, segment_name, instrument.trading_hours
        )
        if not market_open:
            return

        fill_price = Decimal(str(fill_price))
        margin = await margin_for(order.lots, fill_price, instrument, account.leverage)

        # Margin check against RECOMPUTED values, not the stored
        # account.free_margin — the exact figure the gateway's place_order
        # deliberately distrusts (it drifts/sticks over many trades). Same
        # recipe: open margin re-summed from open positions, unrealized P&L
        # from live ticks with cross-rate conversion.
        open_pos_q = await db.execute(
            select(Position).where(
                Position.account_id == account.id,
                Position.status == PositionStatus.OPEN,
            )
        )
        open_positions = open_pos_q.scalars().all()
        open_margin = Decimal("0")
        unrealized_pnl = Decimal("0")
        for pos in open_positions:
            p_inst = pos.instrument
            cs = (p_inst.contract_size if p_inst else None) or Decimal("100000")
            open_margin += await margin_for(pos.lots, pos.open_price, p_inst, account.leverage)
            if not p_inst:
                continue
            tick_data = await redis_client.get(PriceChannel.tick_key(p_inst.symbol))
            if not tick_data:
                continue
            tick = json.loads(tick_data)
            if is_tick_stale(tick):
                continue
            sv = pos.side.value if hasattr(pos.side, "value") else str(pos.side)
            cp = Decimal(str(tick["bid"])) if sv == "buy" else Decimal(str(tick["ask"]))
            if sv == "buy":
                pos_pnl = (cp - pos.open_price) * pos.lots * cs
            else:
                pos_pnl = (pos.open_price - cp) * pos.lots * cs
            unrealized_pnl += quote_to_account_pnl(
                pos_pnl,
                getattr(p_inst, "base_currency", None),
                getattr(p_inst, "quote_currency", None),
                cp,
                symbol=p_inst.symbol,
                cross_rate=await cross_rate_for(p_inst),
            )

        real_equity = (account.balance or Decimal("0")) + (account.credit or Decimal("0")) + unrealized_pnl
        real_free_margin = real_equity - open_margin
        if margin > real_free_margin:
            order.status = OrderStatus.REJECTED
            return

        # Use the SAME resolver as the gateway's market-order path so a pending
        # fill is charged identically to a market order. The previous local
        # _get_commission() only checked user > instrument > segment > default
        # and silently charged $0 whenever commission was configured at the
        # account-group level (tier default) — i.e. for most accounts.
        commission = await resolve_commission(
            db,
            instrument,
            order.lots,
            fill_price,
            user_id=account.user_id,
            account_group_id=account.account_group_id,
        )

        order.status = OrderStatus.FILLED
        order.filled_price = fill_price
        order.filled_at = datetime.now(timezone.utc)
        order.commission = commission
        await db.flush()

        position = Position(
            account_id=account.id,
            instrument_id=instrument.id,
            order_id=order.id,
            side=order.side,
            lots=order.lots,
            open_price=fill_price,
            stop_loss=order.stop_loss,
            take_profit=order.take_profit,
            status=PositionStatus.OPEN,
            commission=commission,
        )
        db.add(position)

        # Recomputed total (never increment a stored value that can drift).
        account.margin_used = open_margin + margin
        account.balance = (account.balance or Decimal("0")) - commission
        account.equity = (account.balance or Decimal("0")) + (account.credit or Decimal("0"))
        account.free_margin = account.equity - account.margin_used
        if commission and Decimal(str(commission)) != 0:
            db.add(Transaction(
                user_id=account.user_id,
                account_id=account.id,
                type="commission",
                amount=-Decimal(str(commission)),
                balance_after=account.balance,
                reference_id=order.id,
                description=f"Commission {instrument.symbol} pending fill {order.lots} lots",
            ))

        # A filled pending order is a real trade: accrue for the IB chain like
        # a market order does. Runs in a SAVEPOINT (accrue_ib_commission_safe)
        # so an IB error can never roll back this fill or any other.
        await accrue_ib_commission_safe(
            db, account.user_id, order.id, Decimal(str(order.lots)), instrument.symbol,
        )

        logger.info(f"Pending order {order.id} executed: {instrument.symbol} {order.side.value} @ {fill_price}")

        await redis_client.publish(f"account:{account.id}", json.dumps({
            "type": "order_filled",
            "order_id": str(order.id),
            "symbol": instrument.symbol,
            "side": order.side.value,
            "price": str(fill_price),
            "lots": str(order.lots),
        }))
