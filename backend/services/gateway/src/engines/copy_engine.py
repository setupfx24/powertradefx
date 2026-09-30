"""Copy Trade Engine — Replicates master trades to investor sub-accounts.

Architecture:
- Manager trades one master TradingAccount; positions live as Position rows.
- This engine polls ~every 2s, diffs master open positions vs in-memory snapshot,
  opens/closes child positions on each linked investor account.
- Lot scaling is driven by InvestorAllocation.copy_type (signal | pamm | mam), not mixed.
- Master positions are never modified by this engine.

Performance fee runs on close only (see _close_copy).
"""
import asyncio
import json
import logging
from decimal import Decimal
from datetime import datetime, timezone
from uuid import UUID
from collections import defaultdict
from typing import Optional, Tuple

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import (
    MasterAccount, InvestorAllocation, CopyTrade, Position, PositionStatus,
    TradingAccount, TradeHistory, Transaction, Order,
)
from packages.common.src.redis_client import redis_client, PriceChannel, is_tick_stale
from packages.common.src.price_cache import price_cache
from packages.common.src.admin_fees import credit_admin_fee
from packages.common.src.copy_fees import apply_hwm_fee
from packages.common.src.engine_lock import engine_lock
from packages.common.src.row_locks import lock_account
from packages.common.src.trading_service import margin_for, recompute_account_margin
from packages.common.src.notify import create_notification

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("copy-engine")

MIN_COPY_LOT = 0.01
COPY_COMMENT_PREFIX = "Copy of master position "
# Cluster-wide lock key so only one gateway worker processes copy trades at a
# time — with --workers=N each worker would otherwise duplicate every mirror.
COPY_ENGINE_LOCK_KEY = "copy_engine:cycle_lock"
COPY_ENGINE_LOCK_TTL = 10


def resolve_copy_type(allocation: InvestorAllocation, master: MasterAccount) -> str:
    """Effective copy mode: stored copy_type, else legacy inference from master.master_type."""
    raw = allocation.copy_type
    if raw:
        s = str(raw).strip().lower()
        if s in ("signal", "pamm", "mam"):
            return s
    mt = (master.master_type or "signal_provider").lower()
    if mt == "pamm":
        return "pamm"
    if mt == "mamm":
        return "mam"
    return "signal"


class CopyTradeEngine:
    def __init__(self):
        self._running = False
        self._master_positions: dict[str, set[str]] = defaultdict(set)
        # Allocations that have already been "seeded" with the master's
        # currently-open positions (catch-up for followers who subscribe
        # mid-trade). Keyed by master_id -> set of allocation_ids. In-memory
        # only; a process restart re-seeds, but the _open_copy dedup guard
        # makes that a no-op for copies that already exist.
        self._seeded_allocations: dict[str, set[str]] = defaultdict(set)
        # Real-time WS events queued during a cycle and published to the
        # follower's `account:{id}` channel AFTER db.commit() — so the
        # follower's terminal refreshes open positions + history the instant
        # a copy opens/closes, instead of only on a manual page refresh.
        # Published post-commit to avoid a read-before-commit race in the
        # follower's refreshPositions() call.
        self._pending_events: list[tuple[str, str]] = []

    @staticmethod
    def compute_lot_size(
        master_lots: float,
        master_account: TradingAccount,
        investor_allocation: InvestorAllocation,
        investor_account: TradingAccount,
        *,
        total_pool: float,
        copy_type: str,
    ) -> Tuple[Optional[float], Optional[str]]:
        """
        Raw scaled lots for one investor, rounded to 2 decimals.
        Returns (lots, None) or (None, skip_reason).
        """
        ml = float(master_lots or 0)
        if ml <= 0:
            return None, "zero_master_lots"

        ct = (copy_type or "signal").lower()

        if ct == "signal":
            inv_eq = float(investor_account.equity or investor_account.balance or 0)
            if inv_eq <= 0:
                return None, "signal_zero_investor_equity"
            mst_eq = float(master_account.equity or master_account.balance or 0)
            if mst_eq <= 0:
                return None, "signal_zero_master_equity"
            raw = ml * (inv_eq / mst_eq)
        elif ct == "pamm":
            if total_pool <= 0:
                return None, "pamm_zero_total_pool"
            amt = float(investor_allocation.allocation_amount or 0)
            raw = ml * (amt / total_pool)
        elif ct == "mam":
            if total_pool <= 0:
                return None, "mam_zero_total_pool"
            pct = (
                float(investor_allocation.allocation_pct)
                if investor_allocation.allocation_pct is not None
                else 100.0
            )
            if pct == 0:
                return None, "mam_zero_allocation_pct"
            amt = float(investor_allocation.allocation_amount or 0)
            pool_share_lots = ml * (amt / total_pool)
            raw = pool_share_lots * (pct / 100.0)
        else:
            return None, f"unknown_copy_type:{ct}"

        rounded = round(raw, 2)
        if rounded < MIN_COPY_LOT:
            # The proportional size rounds below the platform's minimum lot —
            # e.g. a master trading 0.01 lots with a follower whose equity is
            # smaller than the master's. Skipping here left followers with NO
            # mirrored trade at all (the reported "master trade not copying"
            # bug). Clamp up to the minimum tradeable lot so the position is
            # still copied; the follower accepts slightly higher proportional
            # exposure as the cost of participating at small sizes. The
            # downstream free-margin check in _open_copy still rejects the open
            # if the account genuinely can't afford even 0.01 lots.
            return MIN_COPY_LOT, None
        return rounded, None

    async def start(self):
        self._running = True
        logger.info("Copy Trade Engine started")
        asyncio.create_task(self._run())

    async def stop(self):
        self._running = False

    async def _run(self):
        while self._running:
            try:
                # Cluster-wide leader lock — prevents duplicate mirroring
                # when gateway runs with `--workers N`. Migrated from a
                # hand-rolled `SET NX + DELETE` to the shared engine_lock
                # utility, which uses a CAS-style Lua release so a slow
                # tick whose TTL expires can't accidentally delete the
                # next holder's lock.
                async with engine_lock("copy_engine", ttl_seconds=COPY_ENGINE_LOCK_TTL) as is_leader:
                    if not is_leader:
                        await asyncio.sleep(1)
                        continue

                    self._pending_events = []  # fresh per cycle
                    async with AsyncSessionLocal() as db:
                        # Global orphan sweep — close any follower mirror whose
                        # master position is already closed, even if the master
                        # has no active followers left (e.g. last investor
                        # withdrew while master still had open positions).
                        await self._global_orphan_sweep(db)

                        # Select masters that ACTUALLY have an active follower,
                        # computed live via EXISTS — never the denormalised
                        # master.followers_count counter. That counter drifts
                        # out of sync (double-decrements on stop/withdraw, admin
                        # resets to 0, legacy backfills — see fix_pending_copies.py
                        # and the "actual count from allocations, not stale
                        # counter" notes in every read path). When it drifts to 0
                        # while a follower is still active, the old query skipped
                        # the master entirely and NO trades were ever mirrored —
                        # the reported "master trade not copying" bug. EXISTS is
                        # also still efficient: masters with no active allocation
                        # are filtered in SQL, not loaded and early-returned.
                        masters = await db.execute(
                            select(MasterAccount).where(
                                MasterAccount.status.in_(["approved", "active"]),
                                select(InvestorAllocation.id)
                                .where(
                                    InvestorAllocation.master_id == MasterAccount.id,
                                    InvestorAllocation.status == "active",
                                )
                                .exists(),
                            )
                        )
                        for master in masters.scalars().all():
                            # One master's failure (bad row, constraint, a
                            # follower's drawdown pause...) rolls back only its
                            # own savepoint. QA 2026-09-29: a single rejected
                            # status aborted the shared transaction and stopped
                            # copy trading for EVERY master.
                            n_events = len(self._pending_events)
                            try:
                                async with db.begin_nested():
                                    await self.process_master(master, db)
                            except Exception as e:
                                del self._pending_events[n_events:]
                                logger.error("Copy sync failed for master %s: %s", master.id, e, exc_info=True)
                        await db.commit()
                    # Durably committed — now fan out the real-time events so
                    # followers' terminals update without a manual refresh.
                    await self._flush_events()
            except Exception as e:
                logger.error("Copy engine error: %s", e, exc_info=True)
                self._pending_events = []  # don't publish a half-rolled-back cycle

            await asyncio.sleep(1)

    async def _flush_events(self) -> None:
        """Publish queued follower-facing WS events (post-commit, best-effort)."""
        events, self._pending_events = self._pending_events, []
        for channel, payload in events:
            try:
                await redis_client.publish(channel, payload)
            except Exception as e:
                logger.warning("copy-engine publish failed on %s: %s", channel, e)

    async def _global_orphan_sweep(self, db: AsyncSession) -> None:
        """Close any open CopyTrade whose master Position is already closed,
        regardless of which master it belongs to. Guarantees stuck follower
        mirrors recover even if the master has been deactivated or has zero
        active followers now."""
        q = await db.execute(
            select(CopyTrade, MasterAccount)
            .join(Position, CopyTrade.master_position_id == Position.id)
            .join(InvestorAllocation, CopyTrade.investor_allocation_id == InvestorAllocation.id)
            .join(MasterAccount, InvestorAllocation.master_id == MasterAccount.id)
            .where(
                CopyTrade.status == "open",
                Position.status != "open",
            )
        )
        rows = list(q.all())
        if not rows:
            return
        logger.info("Global orphan sweep: closing %d stuck copy mirror(s)", len(rows))
        for copy, master in rows:
            n_events = len(self._pending_events)
            try:
                async with db.begin_nested():
                    await self._close_copy(copy, master, db)
            except Exception as e:
                del self._pending_events[n_events:]
                logger.error("Global orphan sweep failed for copy=%s: %s", copy.id, e)

    async def _sum_active_allocation_pool(self, master_id: UUID, db: AsyncSession) -> float:
        q = await db.execute(
            select(func.coalesce(func.sum(InvestorAllocation.allocation_amount), 0)).where(
                InvestorAllocation.master_id == master_id,
                InvestorAllocation.status == "active",
            )
        )
        return float(q.scalar() or 0)

    async def process_master(self, master: MasterAccount, db: AsyncSession) -> None:
        """One full sync cycle for a single master: read, diff, open/close children."""
        master_id_str = str(master.id)

        master_positions_q = await db.execute(
            select(Position).where(
                Position.account_id == master.account_id,
                Position.status == PositionStatus.OPEN,
            )
        )
        master_open = {}
        for p in master_positions_q.scalars().all():
            if p.comment and COPY_COMMENT_PREFIX in (p.comment or ""):
                continue
            if p.comment and "Copy of master" in p.comment:
                continue
            master_open[str(p.id)] = p
        current_master_pos_ids = set(master_open.keys())
        prev_master_pos_ids = self._master_positions.get(master_id_str, set())

        investors = await db.execute(
            select(InvestorAllocation).where(
                InvestorAllocation.master_id == master.id,
                InvestorAllocation.status == "active",
            )
        )
        active_investors = investors.scalars().all()
        if not active_investors:
            logger.debug("process_master skip master=%s: no active allocations", master_id_str)
            self._master_positions[master_id_str] = current_master_pos_ids
            return

        master_account = await db.get(TradingAccount, master.account_id)
        if not master_account:
            logger.warning("process_master skip master=%s: master trading account missing", master_id_str)
            return

        total_pool = await self._sum_active_allocation_pool(master.id, db)
        if total_pool <= 0 and any(
            resolve_copy_type(inv, master) in ("pamm", "mam") for inv in active_investors
        ):
            logger.warning(
                "process_master master=%s: total_pool=0, skipping PAMM/MAM opens this cycle",
                master_id_str,
            )

        # ── Catch-up for newly-joined followers ─────────────────────────────
        # The new_positions diff below only mirrors trades the master opens
        # AFTER this cycle. A follower who subscribes while the master already
        # holds open positions would otherwise never receive them (the master
        # position is already in prev_master_pos_ids, so it's never "new").
        # Seed each allocation once with the master's currently-open positions.
        seeded = self._seeded_allocations[master_id_str]
        for investor in active_investors:
            alloc_key = str(investor.id)
            if alloc_key in seeded:
                continue
            # PAMM investors pool on the master account — no sub-account opens.
            if resolve_copy_type(investor, master) == "pamm":
                seeded.add(alloc_key)
                continue
            investor_account = await db.get(TradingAccount, investor.investor_account_id)
            if not investor_account or not investor_account.is_active:
                # Account not ready yet — retry next cycle, don't mark seeded.
                continue
            for pos_id in current_master_pos_ids:
                await self._open_copy(
                    master,
                    master_open[pos_id],
                    investor,
                    investor_account,
                    master_account,
                    total_pool,
                    db,
                    catch_up=True,
                )
            seeded.add(alloc_key)
            if current_master_pos_ids:
                logger.info(
                    "Catch-up: seeded allocation=%s with %d open master position(s)",
                    investor.id, len(current_master_pos_ids),
                )

        new_positions = current_master_pos_ids - prev_master_pos_ids
        closed_positions = prev_master_pos_ids - current_master_pos_ids

        for pos_id in new_positions:
            master_pos = master_open[pos_id]
            for investor in active_investors:
                # PAMM investors have no sub-account — funds are pooled on the
                # master's account directly. Profit is distributed to their main
                # wallet when the master closes the trade (see trading_service).
                if resolve_copy_type(investor, master) == "pamm":
                    continue
                investor_account = await db.get(TradingAccount, investor.investor_account_id)
                if not investor_account or not investor_account.is_active:
                    logger.info(
                        "Skip copy open: inactive or missing investor account allocation=%s",
                        investor.id,
                    )
                    continue
                await self._open_copy(
                    master,
                    master_pos,
                    investor,
                    investor_account,
                    master_account,
                    total_pool,
                    db,
                )

        # Master PARTIAL closes: a copy is sized master_lots x ratio (ratio
        # stored at open), so after the master reduces a position every copy
        # is reduced to its share of what the master still holds. QA
        # 2026-09-29: a master's partial close was never mirrored and
        # followers kept the full exposure.
        for pos_id in current_master_pos_ids & prev_master_pos_ids:
            master_pos = master_open[pos_id]
            open_copies = (await db.execute(
                select(CopyTrade).where(
                    CopyTrade.master_position_id == UUID(pos_id),
                    CopyTrade.status == "open",
                )
            )).scalars().all()
            for copy in open_copies:
                await self._mirror_partial(copy, master, master_pos, db)

        for closed_id in closed_positions:
            copies = await db.execute(
                select(CopyTrade).where(
                    CopyTrade.master_position_id == UUID(closed_id),
                    CopyTrade.status == "open",
                )
            )
            for copy in copies.scalars().all():
                await self._close_copy(copy, master, db)

        # ── Orphan catch-up ────────────────────────────────────────────────
        # In-memory diff (prev vs current) misses closes that happened while
        # the engine was not running (gateway restart, crash, leader rotation
        # when --workers=N + redis lock). Self-heal by closing any CopyTrade
        # whose master position is no longer open but whose follower mirror
        # is still marked open.
        orphan_copies_q = await db.execute(
            select(CopyTrade)
            .join(Position, CopyTrade.master_position_id == Position.id)
            .where(
                Position.account_id == master.account_id,
                CopyTrade.status == "open",
                Position.status != "open",
            )
        )
        orphans = list(orphan_copies_q.scalars().all())
        if orphans:
            logger.info(
                "process_master master=%s: found %d orphaned copy(ies) to close",
                master_id_str, len(orphans),
            )
        for copy in orphans:
            logger.info(
                "Closing orphaned copy: copy_id=%s investor_allocation=%s master_pos=%s",
                copy.id, copy.investor_allocation_id, copy.master_position_id,
            )
            await self._close_copy(copy, master, db)

        self._master_positions[master_id_str] = current_master_pos_ids


    async def _mirror_partial(self, copy, master, master_pos, db: AsyncSession) -> None:
        """Reduce one open copy to master_pos.lots x copy.ratio (lot-step
        rounded) by partially closing the difference at the follower's
        close price, with history, ledger, fee settlement and margin recompute."""
        from packages.common.src.row_locks import lock_position
        from packages.common.src.trading_service import quote_to_account_pnl, cross_rate_for
        ratio = Decimal(str(copy.ratio or 1))
        inst = master_pos.instrument
        if inst is None or not copy.investor_position_id:
            return
        step = Decimal(str(getattr(inst, "lot_step", None) or "0.01"))
        target = (Decimal(str(master_pos.lots)) * ratio / step).to_integral_value() * step
        acct_id = (await db.execute(
            select(Position.account_id).where(Position.id == copy.investor_position_id)
        )).scalar_one_or_none()
        if acct_id is None:
            return
        account = await lock_account(db, acct_id)
        fpos = await lock_position(db, copy.investor_position_id)
        if account is None or fpos is None:
            return
        fst = fpos.status.value if hasattr(fpos.status, "value") else str(fpos.status)
        if fst != "open":
            return
        excess = Decimal(str(fpos.lots)) - target
        if excess < step:
            return  # already in line (or master grew: never auto-increase)
        if target < step:
            await self._close_copy(copy, master, db)  # nothing meaningful left
            return
        raw = await redis_client.get(PriceChannel.tick_key(inst.symbol))
        if not raw:
            return
        tick = json.loads(raw)
        if is_tick_stale(tick):
            return
        side = fpos.side.value if hasattr(fpos.side, "value") else str(fpos.side)
        close_price = Decimal(str(tick["bid"])) if side == "buy" else Decimal(str(tick["ask"]))
        cs = inst.contract_size or Decimal("100000")
        gross = ((close_price - fpos.open_price) if side == "buy" else (fpos.open_price - close_price)) * excess * cs
        gross = quote_to_account_pnl(
            gross, getattr(inst, "base_currency", None), getattr(inst, "quote_currency", None),
            close_price, symbol=inst.symbol, cross_rate=await cross_rate_for(inst),
        )
        share = excess / Decimal(str(fpos.lots))
        part_comm = (fpos.commission or Decimal("0")) * share
        part_swap = (fpos.swap or Decimal("0")) * share
        account.balance = (account.balance or Decimal("0")) + gross
        db.add(Transaction(
            user_id=account.user_id, account_id=account.id,
            type="profit" if gross >= 0 else "loss", amount=gross,
            balance_after=account.balance, reference_id=fpos.id,
            description=f"Copy partial close {inst.symbol} {excess} lots @ {close_price} (master reduced)",
        ))
        alloc = await db.get(InvestorAllocation, copy.investor_allocation_id)
        fee = await settle_copy_fee(
            db, master=master, alloc=alloc, gross_profit=gross,
            investor_account=account, reference_id=fpos.id,
        )
        db.add(TradeHistory(
            position_id=fpos.id, account_id=fpos.account_id, instrument_id=fpos.instrument_id,
            side=fpos.side, lots=excess, open_price=fpos.open_price, close_price=close_price,
            swap=part_swap, commission=part_comm, profit=gross - fee,
            close_reason="copy_close", opened_at=fpos.created_at,
            closed_at=datetime.now(timezone.utc),
        ))
        fpos.lots = Decimal(str(fpos.lots)) - excess
        fpos.commission = (fpos.commission or Decimal("0")) - part_comm
        fpos.swap = (fpos.swap or Decimal("0")) - part_swap
        await db.flush()
        await recompute_account_margin(db, account)
        self._pending_events.append((
            f"account:{fpos.account_id}",
            json.dumps({"type": "position_updated", "position_id": str(fpos.id), "lots": float(fpos.lots)}),
        ))
        logger.info("Copy partial-closed %s lots of %s to follow master reduction", excess, fpos.id)

    async def _open_copy(
        self,
        master: MasterAccount,
        master_pos: Position,
        investor: InvestorAllocation,
        investor_account: TradingAccount,
        master_account: TradingAccount,
        total_pool: float,
        db: AsyncSession,
        catch_up: bool = False,
    ):
        instrument = master_pos.instrument
        if not instrument:
            logger.warning("Skip copy open: no instrument on master position %s", master_pos.id)
            return

        existing_q = await db.execute(
            select(CopyTrade).where(
                CopyTrade.master_position_id == master_pos.id,
                CopyTrade.investor_allocation_id == investor.id,
                CopyTrade.status == "open",
            )
        )
        if existing_q.scalar_one_or_none():
            return

        # Max-drawdown safety stop: if cumulative loss as a percentage of
        # the allocation principal exceeds the follower's configured
        # threshold, pause this allocation and skip the open. Status flips
        # to "paused_drawdown" so the engine stops opening new copies on
        # this allocation; existing open copies continue and may recover.
        # The follower can manually re-activate from the social UI once
        # they're comfortable.
        if investor.max_drawdown_pct is not None and investor.max_drawdown_pct > 0:
            principal = Decimal(str(investor.allocation_amount or 0))
            profit = Decimal(str(investor.total_profit or 0))
            if principal > 0 and profit < 0:
                drawdown_pct = (-profit / principal) * Decimal("100")
                if drawdown_pct >= Decimal(str(investor.max_drawdown_pct)):
                    investor.status = "paused_drawdown"
                    logger.warning(
                        "Allocation %s paused: drawdown %.2f%% >= cap %.2f%%",
                        investor.id, float(drawdown_pct), float(investor.max_drawdown_pct),
                    )
                    try:
                        await create_notification(
                            db,
                            investor.investor_user_id,
                            title="Copy trading paused — drawdown limit hit",
                            message=(
                                f"Your copy of this master was paused after a "
                                f"{float(drawdown_pct):.1f}% loss (your limit: "
                                f"{float(investor.max_drawdown_pct):.1f}%). "
                                "No new trades will be copied. You can resume from /social."
                            ),
                            notif_type="copy_trade",
                            action_url="/social",
                            commit=False,
                        )
                    except Exception:
                        pass
                    return

        side_val = master_pos.side.value if hasattr(master_pos.side, "value") else str(master_pos.side)
        master_lots = float(master_pos.lots or 0)

        ct = resolve_copy_type(investor, master)
        base_lots, skip_reason = self.compute_lot_size(
            master_lots,
            master_account,
            investor,
            investor_account,
            total_pool=total_pool,
            copy_type=ct,
        )
        if base_lots is None:
            logger.info(
                "Skip copy open: allocation=%s master_pos=%s copy_type=%s reason=%s",
                investor.id,
                master_pos.id,
                ct,
                skip_reason,
            )
            return

        copy_lots = float(base_lots)
        lot_step = float(instrument.lot_step or Decimal("0.01"))
        copy_lots = max(lot_step, round(copy_lots / lot_step) * lot_step)

        min_lot = float(instrument.min_lot or Decimal("0.01"))
        max_lot = float(instrument.max_lot or Decimal("100"))
        copy_lots = max(min_lot, min(copy_lots, max_lot))

        if copy_lots < MIN_COPY_LOT:
            logger.info(
                "Skip copy open: allocation=%s master_pos=%s post_step_lots=%s below min %s",
                investor.id,
                master_pos.id,
                copy_lots,
                MIN_COPY_LOT,
            )
            return

        if investor.max_lot_override and copy_lots > float(investor.max_lot_override):
            copy_lots = float(investor.max_lot_override)

        # C-TRADE-3: a follower joining while the master position is ALREADY
        # open (catch-up seeding) must enter at the CURRENT market price, not
        # the master's original entry — otherwise they instantly inherit the
        # master's accrued unrealised P&L (a phantom gain/loss). A real-time
        # mirror (catch_up=False) uses the master's open price, which is ~now.
        open_price = master_pos.open_price
        if catch_up:
            tick_data = await price_cache.get(instrument.symbol)
            if tick_data:
                try:
                    tick = json.loads(tick_data)
                    open_price = Decimal(str(tick["ask"])) if side_val == "buy" else Decimal(str(tick["bid"]))
                except (json.JSONDecodeError, KeyError, ValueError):
                    open_price = master_pos.open_price
            else:
                logger.warning(
                    "Catch-up copy open for %s: no live tick, falling back to master open_price",
                    instrument.symbol,
                )

        # Lock the follower's account (fresh) before any balance/margin math.
        investor_account = await lock_account(db, investor_account.id) or investor_account
        required_margin = await margin_for(
            Decimal(str(copy_lots)), Decimal(str(open_price)), instrument, investor_account.leverage,
        )
        # A copied trade is a real trade: charged the follower's resolved
        # commission like any market order (QA: copies charged 0, so the
        # follower's IB never earned and the house lost the commission).
        from packages.common.src.instrument_pricing import resolve_commission
        copy_commission = await resolve_commission(
            db, instrument, Decimal(str(copy_lots)), Decimal(str(open_price)),
            user_id=investor_account.user_id, account_group_id=investor_account.account_group_id,
        )

        if required_margin + copy_commission > (investor_account.free_margin or Decimal("0")):
            logger.warning(
                "Insufficient margin for copy: investor_account=%s allocation=%s master_pos=%s",
                investor.investor_account_id,
                investor.id,
                master_pos.id,
            )
            return

        comment = f"{COPY_COMMENT_PREFIX}{master_pos.id}"

        # Create an Order row so the copy trade is first-class in trading history
        # and so IBCommission.source_trade_id (FK → orders.id) can reference it.
        order = Order(
            account_id=investor_account.id,
            instrument_id=master_pos.instrument_id,
            order_type="market",
            side=side_val,
            status="filled",
            lots=Decimal(str(copy_lots)),
            filled_price=open_price,
            filled_at=datetime.now(timezone.utc),
            commission=copy_commission,
            comment=comment,
        )
        db.add(order)
        await db.flush()

        position = Position(
            account_id=investor_account.id,
            instrument_id=master_pos.instrument_id,
            order_id=order.id,
            side=side_val,
            status=PositionStatus.OPEN.value,
            lots=Decimal(str(copy_lots)),
            open_price=open_price,
            stop_loss=master_pos.stop_loss,
            take_profit=master_pos.take_profit,
            comment=comment,
            commission=copy_commission,
        )
        db.add(position)
        await db.flush()

        copy_record = CopyTrade(
            master_position_id=master_pos.id,
            investor_allocation_id=investor.id,
            investor_position_id=position.id,
            ratio=Decimal(str(copy_lots / master_lots)) if master_lots > 0 else Decimal("1"),
            status="open",
        )
        db.add(copy_record)

        if copy_commission and copy_commission != 0:
            investor_account.balance = (investor_account.balance or Decimal("0")) - copy_commission
            db.add(Transaction(
                user_id=investor_account.user_id,
                account_id=investor_account.id,
                type="commission",
                amount=-copy_commission,
                balance_after=investor_account.balance,
                reference_id=order.id,
                description=f"Commission {instrument.symbol} copy trade {copy_lots} lots",
            ))
        await db.flush()
        await recompute_account_margin(db, investor_account)

        # Copy trades count as real trading volume: accrue for the follower's
        # IB chain (savepoint-safe, idempotent).
        from packages.common.src.ib_commission import accrue_ib_commission_safe
        await accrue_ib_commission_safe(
            db, investor_account.user_id, order.id, Decimal(str(copy_lots)), instrument.symbol,
        )

        logger.info(
            "Copy opened: %s %s %s lots investor=%s master_pos=%s copy_type=%s (master %s lots)",
            instrument.symbol,
            side_val,
            copy_lots,
            investor_account.account_number,
            master_pos.id,
            ct,
            master_lots,
        )

        # Notify the follower's terminal so the new copy position appears live
        # (flushed after commit in _run).
        self._pending_events.append((
            f"account:{investor_account.id}",
            json.dumps({
                "type": "position_opened",
                "position_id": str(position.id),
                "symbol": instrument.symbol,
                "side": side_val,
                "lots": str(copy_lots),
                "open_price": str(open_price),
            }),
        ))

    async def _close_copy(self, copy: CopyTrade, master: MasterAccount, db: AsyncSession):
        investor_pos = await db.get(Position, copy.investor_position_id)
        if not investor_pos:
            copy.status = "closed"
            logger.info("Close copy: investor position missing, marking copy closed")
            return

        pos_status = investor_pos.status.value if hasattr(investor_pos.status, "value") else str(investor_pos.status)
        if pos_status != "open":
            copy.status = "closed"
            return

        instrument = investor_pos.instrument
        if not instrument:
            copy.status = "closed"
            logger.warning("Close copy: no instrument on investor position %s", investor_pos.id)
            return

        side_val = investor_pos.side.value if hasattr(investor_pos.side, "value") else str(investor_pos.side)
        close_price = None

        # Prefer the live tick so in-progress closes mirror the master's
        # exit price tightly.
        tick_data = await price_cache.get(instrument.symbol)
        if tick_data:
            try:
                tick = json.loads(tick_data)
                close_price = Decimal(str(tick["bid"])) if side_val == "buy" else Decimal(str(tick["ask"]))
            except (json.JSONDecodeError, KeyError, ValueError):
                close_price = None

        # Orphan catch-up (gateway restart, market closed, tick expired): the
        # master has already closed — use the master position's own close_price
        # so the follower books out at the same level instead of getting stuck
        # forever waiting for a tick.
        if close_price is None:
            master_pos = await db.get(Position, copy.master_position_id)
            if master_pos and master_pos.close_price is not None:
                close_price = master_pos.close_price
                logger.info(
                    "Close copy: using master close_price=%s for %s (no live tick)",
                    close_price, instrument.symbol,
                )

        # Last resort: close at the investor's own open price (zero P&L) rather
        # than leave the position stuck open indefinitely.
        if close_price is None:
            close_price = investor_pos.open_price
            logger.warning(
                "Close copy: no tick and no master close_price for %s — closing at open_price (zero P&L)",
                instrument.symbol,
            )

        contract_size = instrument.contract_size or Decimal("100000")

        if side_val == "buy":
            gross_profit = (close_price - investor_pos.open_price) * investor_pos.lots * contract_size
        else:
            gross_profit = (investor_pos.open_price - close_price) * investor_pos.lots * contract_size
        from packages.common.src.trading_service import quote_to_account_pnl, cross_rate_for
        gross_profit = quote_to_account_pnl(
            gross_profit,
            getattr(instrument, "base_currency", None),
            getattr(instrument, "quote_currency", None),
            close_price,
            symbol=getattr(instrument, "symbol", None),
            cross_rate=await cross_rate_for(instrument),
        )

        investor_pos.status = PositionStatus.CLOSED.value
        investor_pos.close_price = close_price
        investor_pos.closed_at = datetime.now(timezone.utc)

        # C-TRADE-4: lock the CF account row before crediting the mirror-close
        # P&L, so this can't race a manual close / transfer / withdrawal on the
        # same account (each of which also mutates balance under its own lock).
        investor_account = await lock_account(db, investor_pos.account_id)
        alloc = await db.get(InvestorAllocation, copy.investor_allocation_id)
        performance_fee = Decimal("0")
        if investor_account:
            investor_account.balance = (investor_account.balance or Decimal("0")) + gross_profit
            db.add(Transaction(
                user_id=investor_account.user_id,
                account_id=investor_account.id,
                type="profit" if gross_profit >= 0 else "loss",
                amount=gross_profit,
                balance_after=investor_account.balance,
                reference_id=investor_pos.id,
                description=f"Copy close {instrument.symbol} {investor_pos.lots} lots @ {close_price}",
            ))
            performance_fee = await settle_copy_fee(
                db, master=master, alloc=alloc, gross_profit=gross_profit,
                investor_account=investor_account, reference_id=investor_pos.id,
            )
            await db.flush()
            await recompute_account_margin(db, investor_account)
        net_profit = gross_profit - performance_fee
        investor_pos.profit = net_profit

        history = TradeHistory(
            position_id=investor_pos.id,
            account_id=investor_pos.account_id,
            instrument_id=investor_pos.instrument_id,
            side=investor_pos.side,
            lots=investor_pos.lots,
            open_price=investor_pos.open_price,
            close_price=close_price,
            swap=investor_pos.swap or Decimal("0"),
            commission=investor_pos.commission or Decimal("0"),
            profit=net_profit,
            close_reason="copy_close",
            opened_at=investor_pos.created_at,
            closed_at=datetime.now(timezone.utc),
        )
        db.add(history)

        copy.status = "closed"

        # Notify the follower's terminal so the closed copy leaves the open
        # list and lands in Closed Positions live — same payload shape the
        # SL/TP + manual-close paths use (flushed after commit in _run).
        self._pending_events.append((
            f"account:{investor_pos.account_id}",
            json.dumps({
                "type": "position_closed",
                "position_id": str(investor_pos.id),
                "reason": "copy_close",
                "profit": str(net_profit),
                "close_price": str(close_price),
            }),
        ))

        logger.info(
            "Copy closed: %s %s %s lots | gross=%s perf_fee=%s net=%s master_pos=%s",
            instrument.symbol,
            side_val,
            investor_pos.lots,
            gross_profit,
            performance_fee,
            net_profit,
            copy.master_position_id,
        )



async def settle_copy_fee(
    db, *, master, alloc, gross_profit, investor_account, reference_id,
) -> Decimal:
    """Settle the performance fee on a closed copy position, whatever closed it
    (master mirror, follower's own close, SL/TP, unfollow).

    Contract: the follower's account (locked by the caller) has ALREADY been
    credited the GROSS profit. This debits the high-water-mark fee from it
    with a ledger row, credits the master's share (performance_fee) and the
    platform's cut, pays the follower's referral network out of the
    platform's cut, and updates the allocation / master totals. Returns the
    fee (0 on a loss or below the high-water mark).

    QA 2026-09-29: a follower closing the copy himself paid no fee at all,
    and unfollow deducted the fee without paying it to anyone."""
    if master is None or alloc is None:
        return Decimal("0")
    fee = apply_hwm_fee(alloc, gross_profit, master.performance_fee_pct or Decimal("0"))
    alloc.total_profit = (alloc.total_profit or Decimal("0")) + (gross_profit - fee)
    if fee <= 0:
        return Decimal("0")

    investor_account.balance = (investor_account.balance or Decimal("0")) - fee
    db.add(Transaction(
        user_id=investor_account.user_id,
        account_id=investor_account.id,
        type="performance_fee",
        amount=-fee,
        balance_after=investor_account.balance,
        reference_id=reference_id,
        description=f"Performance fee ({master.performance_fee_pct}%) on copy trade",
    ))

    admin_fee = fee * (master.admin_commission_pct or Decimal("0")) / Decimal("100")
    master_share = fee - admin_fee
    master_account = await lock_account(db, master.account_id) if master.account_id else None
    if master_account is not None and master_share > 0:
        master_account.balance = (master_account.balance or Decimal("0")) + master_share
        master_account.equity = master_account.balance + (master_account.credit or Decimal("0"))
        master_account.free_margin = master_account.equity - (master_account.margin_used or Decimal("0"))
        db.add(Transaction(
            user_id=master.user_id,
            account_id=master_account.id,
            type="performance_fee",
            amount=master_share,
            balance_after=master_account.balance,
            reference_id=reference_id,
            description="Performance fee earned from copy trade",
        ))
        master.total_fee_earned = (master.total_fee_earned or Decimal("0")) + master_share

    if admin_fee > 0:
        # The follower's referral network is paid OUT OF the platform's cut:
        # only what is left is booked as platform revenue (it used to credit
        # the network on top of the full platform fee, funded by nothing).
        paid_network = Decimal("0")
        try:
            from ..services.social_service import distribute_copy_trade_platform_fee
            async with db.begin_nested():
                paid_network = await distribute_copy_trade_platform_fee(
                    db, follower_user_id=alloc.investor_user_id,
                    platform_fee=admin_fee, reference_id=reference_id,
                )
        except Exception as _e:
            logger.warning("copy-trade fee network distribution failed: %s", _e)
            paid_network = Decimal("0")
        retained = admin_fee - paid_network
        if retained > 0:
            await credit_admin_fee(
                db, retained,
                description=f"Platform commission ({master.admin_commission_pct}%) from copy trade",
                reference_id=reference_id,
            )
    return fee

copy_engine = CopyTradeEngine()
