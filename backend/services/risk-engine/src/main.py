"""Risk Engine — Margin monitoring, stop-out, exposure tracking.

Continuously monitors all open positions and accounts for:
- Margin level breaches (margin call at 80%, stop-out at 50%)
- Stop-out execution (close positions if margin level drops below threshold)
- Exposure monitoring (admin's B-book risk per instrument)

Rollover/swap charging does NOT live here. The gateway's overnight_fee_engine
is the single authority: it resolves the same SwapConfig chain via
resolve_swap_rate, is idempotent (positions.last_swap_at), leader-locked, and
writes Transaction audit rows. A second SwapConfig-based calculator used to run
in this service at 21:00 UTC with none of those guards — the same position
could be charged by both engines in one night — so it was removed.
"""
import asyncio
import json
import logging
from decimal import Decimal
from datetime import datetime, timezone
from collections import defaultdict

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import (
    Position, PositionStatus, TradingAccount, Instrument,
    OrderSide, Notification, Transaction, TradeHistory, User,
)
from packages.common.src.redis_client import redis_client, PriceChannel, is_tick_stale
from packages.common.src.row_locks import lock_account, lock_position
from packages.common.src.trading_service import margin_for
from packages.common.src.kafka_client import produce_event, KafkaTopics
from packages.common.src.config import get_settings
from packages.common.src import corecen_trade_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-5s [%(name)s] %(message)s")
logger = logging.getLogger("risk-engine")

try:
    from packages.common.src.instrumentation import init_sentry
    init_sentry("risk-engine")
except Exception:
    pass

settings = get_settings()

# Demo accounts are practice money — they auto-refill back to the standard
# balance once they're flat and below the floor (see the NBP sweep).
DEMO_REFILL_BALANCE = Decimal("10000")
DEMO_REFILL_FLOOR = Decimal("100")


class RiskEngine:
    def __init__(self):
        self._running = False
        self._margin_call_sent: set[str] = set()
        self._stale_warned: dict = {}

    async def start(self):
        self._running = True
        logger.info("Risk Engine started")

        await asyncio.gather(
            self._margin_monitor(),
            self._exposure_monitor(),
            self._negative_balance_protection(),
        )

    async def stop(self):
        self._running = False

    # NUMERIC(10,4) holds at most 999999.9999; a tiny margin on a big account
    # overflowed it and the exception aborted the WHOLE pass, so nobody could
    # be stopped out (QA 2026-09-29). Store a clamped value.
    _MARGIN_LEVEL_CAP = Decimal("999999")

    async def _live_float(self, pos):
        """(floating P&L at MID in account ccy, close price at the side, ok).
        ok=False when the price is missing/stale or a needed cross rate is
        unavailable: the account's equity is then UNKNOWN and nobody may be
        stopped out on it (a stale winning position used to count as 0 and
        trigger a false stop-out)."""
        from packages.common.src.trading_service import quote_to_account_pnl, cross_rate_for, _needs_cross_rate
        inst = pos.instrument
        if inst is None:
            return Decimal("0"), None, False
        raw = await redis_client.get(PriceChannel.tick_key(inst.symbol))
        if not raw:
            return Decimal("0"), None, False
        tick = json.loads(raw)
        if is_tick_stale(tick):
            return Decimal("0"), None, False
        bid, ask = Decimal(str(tick["bid"])), Decimal(str(tick["ask"]))
        if getattr(pos, "spread_override", None) is not None:
            from packages.common.src.instrument_pricing import symmetric_quote_from_mid
            m = (bid + ask) / Decimal("2")
            bid, ask = symmetric_quote_from_mid(
                m, Decimal(str(pos.spread_override)), (pos.spread_override_type or "pips"),
                Decimal(str(inst.pip_size or "0.0001")), int(inst.digits or 5), Decimal("0"),
            )
        # Decision on the MID: an artificial spread change must never force a
        # stop-out the market did not warrant. The close itself books at the
        # side's real price (bid for a buy, ask for a sell).
        mid = (bid + ask) / Decimal("2")
        is_buy = pos.side == OrderSide.BUY or str(getattr(pos.side, "value", pos.side)).lower() == "buy"
        cs = inst.contract_size or Decimal("100000")
        raw_pnl = (mid - pos.open_price) * pos.lots * cs if is_buy else (pos.open_price - mid) * pos.lots * cs
        cross = await cross_rate_for(inst)
        if cross is None and _needs_cross_rate(inst):
            return Decimal("0"), None, False
        pnl = quote_to_account_pnl(
            raw_pnl, getattr(inst, "base_currency", None), getattr(inst, "quote_currency", None),
            mid, symbol=inst.symbol, cross_rate=cross,
        )
        return pnl, (bid if is_buy else ask), True

    async def _margin_monitor(self):
        """Monitor margin levels; each account in its OWN short transaction.

        QA 2026-09-29: the monitor updated every account inside one
        transaction, so a deadlock or one bad account rolled back the whole
        pass and stop-outs were skipped for everyone. Now a failure affects
        one account for one pass."""
        logger.info("Margin monitor started")
        from packages.common.src.settings_store import get_float_setting
        while self._running:
            try:
                async with AsyncSessionLocal() as db:
                    ids = (await db.execute(
                        select(TradingAccount.id).where(
                            TradingAccount.margin_used > 0,
                            TradingAccount.is_active == True,  # noqa: E712
                        )
                    )).scalars().all()
                stop_out = Decimal(str(await get_float_setting("stop_out_level", settings.STOP_OUT_LEVEL)))
                margin_call = Decimal(str(await get_float_setting("margin_call_level", settings.MARGIN_CALL_LEVEL)))
                for account_id in ids:
                    try:
                        await self._check_account(account_id, stop_out, margin_call)
                    except Exception as e:
                        logger.error("Margin check failed for account %s: %s", account_id, e, exc_info=True)
            except Exception as e:
                logger.error(f"Margin monitor error: {e}")

            await asyncio.sleep(1)

    async def _check_account(self, account_id, stop_out: Decimal, margin_call: Decimal) -> None:
        async with AsyncSessionLocal() as db:
            account = (await db.execute(
                select(TradingAccount).where(TradingAccount.id == account_id)
            )).scalar_one_or_none()
            if account is None:
                return
            positions = (await db.execute(
                select(Position).where(
                    Position.account_id == account.id,
                    Position.status == PositionStatus.OPEN,
                )
            )).scalars().all()
            if not positions:
                return

            unrealized = Decimal("0")
            known = True
            for pos in positions:
                pnl, _px, ok = await self._live_float(pos)
                if not ok:
                    known = False
                    continue
                unrealized += pnl

            equity = (account.balance or Decimal("0")) + (account.credit or Decimal("0")) + unrealized
            used = account.margin_used or Decimal("0")
            level = (equity / used * 100) if used > 0 else self._MARGIN_LEVEL_CAP
            level = max(min(level, self._MARGIN_LEVEL_CAP), -self._MARGIN_LEVEL_CAP)

            if not known:
                # Equity unknown (stale/missing price): never act on it. Warn at
                # most every 5 minutes per account (a dead feed would otherwise
                # log once per second per account).
                import time as _t
                last = self._stale_warned.get(account.id, 0.0)
                if _t.monotonic() - last > 300:
                    self._stale_warned[account.id] = _t.monotonic()
                    logger.warning("Margin check skipped for %s: a price is stale or missing", account.account_number)
                return

            account.equity = equity
            account.free_margin = equity - used
            account.margin_level = level
            await db.commit()

            if level <= stop_out:
                await self._execute_stop_out(account.id, stop_out)
            elif level <= margin_call:
                acct_key = str(account.id)
                if acct_key not in self._margin_call_sent:
                    self._margin_call_sent.add(acct_key)
                    async with AsyncSessionLocal() as ndb:
                        ndb.add(Notification(
                            user_id=account.user_id,
                            title="Margin Call Warning",
                            message=f"Your margin level is at {level:.1f}%. Please add funds or close positions.",
                            type="margin_call",
                        ))
                        await ndb.commit()
                        await redis_client.publish(f"account:{account.id}", json.dumps({
                            "type": "margin_call",
                            "margin_level": str(level),
                        }))
                        if not bool(account.is_demo):
                            await self._send_margin_call_email(
                                account=account,
                                margin_level=level,
                                equity=equity,
                                used_margin=used,
                                free_margin=account.free_margin,
                                db=ndb,
                            )
            else:
                self._margin_call_sent.discard(str(account.id))

    async def _execute_stop_out(self, account_id, stop_out: Decimal) -> None:
        """Close positions, LARGEST FLOATING LOSS first, until the margin level
        (including the floating P&L of the positions still open) is back above
        the stop-out level. Runs in its own transaction holding the account
        lock and every position lock (account -> positions ascending id), and
        re-evaluates everything on FRESH values, so it never overwrites a
        concurrent balance change or re-closes a position closed meanwhile.

        QA 2026-09-29 fixes: sorted by Position.profit (always 0 while open) so
        it closed arbitrary positions; recomputed the level from balance only
        (ignoring the remaining floating P&L) and over-liquidated; worked from
        the pass-start snapshot."""
        from packages.common.src.trading_service import recompute_account_margin
        async with AsyncSessionLocal() as db:
            try:
                account = await lock_account(db, account_id)
                if account is None:
                    await db.rollback()
                    return
                ids = (await db.execute(
                    select(Position.id).where(
                        Position.account_id == account.id,
                        Position.status == PositionStatus.OPEN,
                    ).order_by(Position.id)
                )).scalars().all()
                open_pos = []
                for pid in ids:
                    p = await lock_position(db, pid)
                    st = p.status.value if p is not None and hasattr(p.status, "value") else (str(p.status) if p else "")
                    if p is not None and st == "open":
                        open_pos.append(p)
                if not open_pos:
                    await db.rollback()
                    return

                live = {}
                for p in open_pos:
                    pnl, close_px, ok = await self._live_float(p)
                    if not ok:
                        logger.warning("Stop-out for %s deferred: stale/missing price", account.account_number)
                        await db.rollback()
                        return
                    live[p.id] = (pnl, close_px)

                def level_now(remaining):
                    eq = (account.balance or Decimal("0")) + (account.credit or Decimal("0")) + sum(
                        live[x.id][0] for x in remaining
                    )
                    used = account.margin_used or Decimal("0")
                    return (eq / used * 100) if used > 0 else self._MARGIN_LEVEL_CAP, eq

                lvl, _eq = level_now(open_pos)
                if lvl > stop_out:
                    await db.rollback()
                    return  # recovered between the check and the lock
                logger.warning(f"Stop-out triggered for account {account.account_number} (level {lvl:.2f}%)")

                remaining = sorted(open_pos, key=lambda x: live[x.id][0])  # most negative first
                closed_count = 0
                realized_pnl = Decimal("0")
                while remaining:
                    pos = remaining.pop(0)
                    close_price = live[pos.id][1]
                    profit = await self._book_close(db, account, pos, close_price)
                    closed_count += 1
                    realized_pnl += profit
                    await db.flush()
                    await recompute_account_margin(db, account)
                    lvl, eq = level_now(remaining)
                    if lvl > stop_out:
                        break
                eq = level_now(remaining)[1]
                account.equity = eq
                account.free_margin = eq - (account.margin_used or Decimal("0"))
                account.margin_level = max(min(lvl, self._MARGIN_LEVEL_CAP), -self._MARGIN_LEVEL_CAP)
                await db.commit()
            except Exception:
                await db.rollback()
                raise

            if closed_count > 0 and not bool(account.is_demo):
                await self._send_stop_out_email(
                    account=account,
                    closed_count=closed_count,
                    realized_pnl=realized_pnl,
                    new_equity=account.equity,
                    db=db,
                )

    async def _book_close(self, db: AsyncSession, account: TradingAccount, pos: Position, close_price: Decimal) -> Decimal:
        """Close one position at close_price (side price) with history, ledger,
        notification and A-book forward. Returns realised profit."""
        from packages.common.src.trading_service import quote_to_account_pnl, cross_rate_for
        is_buy = pos.side == OrderSide.BUY or str(getattr(pos.side, "value", pos.side)).lower() == "buy"
        cs = pos.instrument.contract_size or Decimal("100000")
        raw = (close_price - pos.open_price) * pos.lots * cs if is_buy else (pos.open_price - close_price) * pos.lots * cs
        profit = quote_to_account_pnl(
            raw,
            getattr(pos.instrument, "base_currency", None),
            getattr(pos.instrument, "quote_currency", None),
            close_price,
            symbol=getattr(pos.instrument, "symbol", None),
            cross_rate=await cross_rate_for(pos.instrument),
        )
        pos.status = PositionStatus.CLOSED
        pos.close_price = close_price
        pos.profit = profit
        pos.closed_at = datetime.now(timezone.utc)
        pos.comment = "Auto-closed by STOP OUT"
        account.balance = (account.balance or Decimal("0")) + profit

        db.add(TradeHistory(
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
            close_reason="stop_out",
            opened_at=pos.created_at,
            closed_at=pos.closed_at,
        ))
        db.add(Transaction(
            user_id=account.user_id,
            account_id=pos.account_id,
            type="profit" if profit >= 0 else "loss",
            amount=profit,
            balance_after=account.balance,
            reference_id=pos.id,
            description=(
                f"Stop-out: {pos.instrument.symbol} "
                f"{pos.side.value if hasattr(pos.side, 'value') else pos.side} "
                f"{pos.lots} lots @ {close_price}"
            ),
        ))
        db.add(Notification(
            user_id=account.user_id,
            title=f"Stop Out — {pos.instrument.symbol}",
            message=(
                f"Position closed by stop-out at {close_price} | "
                f"P&L: {'+' if profit >= 0 else ''}{float(profit):.2f}"
            ),
            type="margin_call",
        ))
        try:
            await redis_client.publish(f"account:{account.id}", json.dumps({
                "type": "stop_out",
                "position_id": str(pos.id),
                "symbol": pos.instrument.symbol,
                "profit": str(profit),
            }))
        except Exception:
            pass
        logger.info(f"Stop-out closed {pos.instrument.symbol} {getattr(pos.side, 'value', pos.side)}, profit: {profit}")

        _pos_id, _cp, _pnl, _is_demo, _uid = str(pos.id), close_price, profit, bool(account.is_demo), account.user_id

        async def _forward_stopout(pid=_pos_id, cp=_cp, pnl=_pnl, is_demo=_is_demo, uid=_uid):
            if is_demo:
                return
            try:
                async with AsyncSessionLocal() as bg_db:
                    u = (await bg_db.execute(select(User).where(User.id == uid))).scalar_one_or_none()
                    if u and (u.book_type or "B") == "A":
                        await corecen_trade_client.forward_trade_close(
                            position_id=pid, close_price=cp, pnl=pnl, closed_by="STOP_OUT",
                        )
            except Exception as exc:
                logger.error("[A-BOOK] Stop-out close forward failed: %s", exc)

        asyncio.create_task(_forward_stopout())
        return profit

    async def _send_margin_call_email(
        self,
        *,
        account: TradingAccount,
        margin_level: Decimal,
        equity: Decimal,
        used_margin: Decimal,
        free_margin: Decimal,
        db: AsyncSession,
    ) -> None:
        try:
            from packages.common.src.smtp_mail import (
                send_email, smtp_configured, fire_and_forget,
            )
            if not smtp_configured():
                return
            user_q = await db.execute(select(User).where(User.id == account.user_id))
            user = user_q.scalar_one_or_none()
            if not user or not user.email:
                return
            from packages.common.src.email_templates import render_margin_call
            st = get_settings()
            subject, html, text = render_margin_call(
                first_name=user.first_name,
                account_number=account.account_number,
                margin_level_pct=float(margin_level),
                equity=equity,
                used_margin=used_margin,
                free_margin=free_margin,
                currency=account.currency or "USD",
                trader_app_url=getattr(st, "TRADER_APP_URL", None) or "https://powertradefx.com",
            )
            fire_and_forget(send_email(user.email, subject, html, text=text))
        except Exception as e:
            logger.debug("margin call email failed acct=%s: %s", account.account_number, e)

    async def _send_stop_out_email(
        self,
        *,
        account: TradingAccount,
        closed_count: int,
        realized_pnl: Decimal,
        new_equity: Decimal,
        db: AsyncSession,
    ) -> None:
        try:
            from packages.common.src.smtp_mail import (
                send_email, smtp_configured, fire_and_forget,
            )
            if not smtp_configured():
                return
            user_q = await db.execute(select(User).where(User.id == account.user_id))
            user = user_q.scalar_one_or_none()
            if not user or not user.email:
                return
            from packages.common.src.email_templates import render_stop_out
            st = get_settings()
            subject, html, text = render_stop_out(
                first_name=user.first_name,
                account_number=account.account_number,
                closed_count=closed_count,
                realized_pnl=realized_pnl,
                new_equity=new_equity,
                currency=account.currency or "USD",
                trader_app_url=getattr(st, "TRADER_APP_URL", None) or "https://powertradefx.com",
            )
            fire_and_forget(send_email(user.email, subject, html, text=text))
        except Exception as e:
            logger.debug("stop-out email failed acct=%s: %s", account.account_number, e)

    async def _negative_balance_protection(self):
        """Zero out negative balances once an account is flat (standard
        retail-broker NBP). A stop-out at the 50% margin level can still
        overshoot below zero — price gaps, fast moves, or (historically) a
        feed-stale window where the guard rightly refused to close at dead
        prices. Once every position is closed and the balance is negative,
        the deficit is written off with a proper `adjustment` Transaction so
        the ledger explains the correction instead of the balance silently
        changing. Runs for demo and live alike; the B-book house absorbs
        the live-side deficit (that's what NBP means)."""
        logger.info("Negative balance protection started")
        while self._running:
            try:
                async with AsyncSessionLocal() as db:
                    rows = (await db.execute(
                        select(TradingAccount).where(
                            TradingAccount.balance < 0,
                            TradingAccount.is_active == True,  # noqa: E712
                        ).with_for_update(skip_locked=True)
                    )).scalars().all()
                    for account in rows:
                        open_count = (await db.execute(
                            select(func.count(Position.id)).where(
                                Position.account_id == account.id,
                                Position.status == PositionStatus.OPEN,
                            )
                        )).scalar() or 0
                        if open_count:
                            continue  # still has exposure — wait until flat
                        deficit = -account.balance
                        account.balance = Decimal("0")
                        account.equity = account.credit or Decimal("0")
                        account.margin_used = Decimal("0")
                        account.free_margin = account.equity
                        account.margin_level = Decimal("0")
                        db.add(Transaction(
                            user_id=account.user_id,
                            account_id=account.id,
                            type="negative_balance",
                            amount=deficit,
                            balance_after=Decimal("0"),
                            description="Negative balance protection: deficit written off",
                        ))
                        db.add(Notification(
                            user_id=account.user_id,
                            title="Negative balance corrected",
                            message=(
                                f"Account {account.account_number}: a negative "
                                f"balance of {float(-deficit):.2f} was reset to "
                                f"0.00 under negative balance protection."
                            ),
                            type="margin_call",
                        ))
                        logger.warning(
                            "NBP: account %s deficit %.2f written off",
                            account.account_number, float(deficit),
                        )
                    await db.commit()

                # ── Demo auto-refill ──────────────────────────────────
                # A practice account should never stay broke: once a demo
                # account is flat and its balance has fallen below the
                # refill floor, top it back up to the standard demo
                # balance — with a ledger row, like every balance change.
                async with AsyncSessionLocal() as db:
                    demo_rows = (await db.execute(
                        select(TradingAccount).where(
                            TradingAccount.is_demo == True,  # noqa: E712
                            TradingAccount.is_active == True,  # noqa: E712
                            TradingAccount.balance < DEMO_REFILL_FLOOR,
                        ).with_for_update(skip_locked=True)
                    )).scalars().all()
                    for account in demo_rows:
                        open_count = (await db.execute(
                            select(func.count(Position.id)).where(
                                Position.account_id == account.id,
                                Position.status == PositionStatus.OPEN,
                            )
                        )).scalar() or 0
                        if open_count:
                            continue
                        top_up = DEMO_REFILL_BALANCE - account.balance
                        if top_up <= 0:
                            continue
                        account.balance = DEMO_REFILL_BALANCE
                        account.equity = DEMO_REFILL_BALANCE + (account.credit or Decimal("0"))
                        account.margin_used = Decimal("0")
                        account.free_margin = account.equity
                        db.add(Transaction(
                            user_id=account.user_id,
                            account_id=account.id,
                            type="adjustment",
                            amount=top_up,
                            balance_after=account.balance,
                            description="Demo auto-refill: practice balance restored",
                        ))
                        db.add(Notification(
                            user_id=account.user_id,
                            title="Demo balance refilled",
                            message=(
                                f"Demo account {account.account_number} was "
                                f"topped back up to "
                                f"${float(DEMO_REFILL_BALANCE):,.0f} so you "
                                f"can keep practicing."
                            ),
                            type="margin_call",
                        ))
                        logger.info(
                            "Demo refill: account %s topped up by %.2f",
                            account.account_number, float(top_up),
                        )
                    await db.commit()
            except Exception as e:
                logger.error(f"NBP sweep error: {e}")
            await asyncio.sleep(60)

    async def _exposure_monitor(self):
        """Track the admin's net exposure per instrument (B-book risk)."""
        logger.info("Exposure monitor started")
        while self._running:
            try:
                async with AsyncSessionLocal() as db:
                    result = await db.execute(
                        select(Position).where(Position.status == PositionStatus.OPEN)
                    )
                    positions = result.scalars().all()

                    exposure: dict[str, dict] = defaultdict(lambda: {"long_lots": Decimal("0"), "short_lots": Decimal("0"), "long_value": Decimal("0"), "short_value": Decimal("0")})

                    for pos in positions:
                        symbol = pos.instrument.symbol
                        tick_data = await redis_client.get(PriceChannel.tick_key(symbol))
                        if not tick_data:
                            continue
                        tick = json.loads(tick_data)
                        mid_price = (Decimal(str(tick["bid"])) + Decimal(str(tick["ask"]))) / 2
                        value = pos.lots * pos.instrument.contract_size * mid_price

                        if pos.side == OrderSide.BUY:
                            exposure[symbol]["long_lots"] += pos.lots
                            exposure[symbol]["long_value"] += value
                        else:
                            exposure[symbol]["short_lots"] += pos.lots
                            exposure[symbol]["short_value"] += value

                    exposure_data = {}
                    for symbol, data in exposure.items():
                        net_lots = data["long_lots"] - data["short_lots"]
                        net_value = data["long_value"] - data["short_value"]
                        exposure_data[symbol] = {
                            "long_lots": str(data["long_lots"]),
                            "short_lots": str(data["short_lots"]),
                            "long_value": str(data["long_value"]),
                            "short_value": str(data["short_value"]),
                            "net_lots": str(net_lots),
                            "net_value": str(net_value),
                            "admin_exposure": str(-net_value),
                        }

                    await redis_client.set("exposure:summary", json.dumps(exposure_data))

            except Exception as e:
                logger.error(f"Exposure monitor error: {e}")

            await asyncio.sleep(5)

async def main():
    engine = RiskEngine()
    try:
        await engine.start()
    except KeyboardInterrupt:
        await engine.stop()


if __name__ == "__main__":
    asyncio.run(main())
