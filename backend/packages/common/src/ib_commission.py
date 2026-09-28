"""IB Commission — shared by the gateway (market orders, algo, copy trades)
and the b-book engine (pending-order fills) so every trade from a referred
user is treated identically.

Two phases, deliberately separated:

ACCRUE (``distribute_ib_commission``, called at fill)
  1. Find the referrer IB via the Referral table
  2. Resolve the per-lot rate (IB custom override > plan > nothing)
  3. Cap the pool at the commission the trader actually paid on this order —
     the house never pays the chain more than it collected, so a referred
     second account cannot be farmed for the difference
  4. Split up the MLM chain and write IBCommission rows with status
     ``pending``; bump IBProfile.pending_payout. NO balance is credited yet.

SETTLE (``settle_ib_commissions``, run by the b-book engine every few seconds)
  Every pending row whose source position is CLOSED is credited to the IB's
  real trading account (atomic SQL), logged as a Transaction, and marked
  ``paid``. A trade that is still open keeps its accrual pending, so an IB
  cannot cash out on a position that was only just opened.

Neither function commits; the caller owns the transaction.
"""
import json
import logging
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from .models import (
    Referral, IBProfile, IBCommission, IBCommissionPlan,
    TradingAccount, Transaction, SystemSetting, Order, Position, PositionStatus,
)

logger = logging.getLogger("ib-engine")

DEFAULT_MLM_DISTRIBUTION = [40, 25, 15, 10, 10]


async def get_mlm_distribution(db: AsyncSession) -> list[int]:
    result = await db.execute(
        select(SystemSetting).where(SystemSetting.key == "mlm_distribution")
    )
    setting = result.scalar_one_or_none()
    if setting and setting.value:
        val = setting.value
        if isinstance(val, str):
            try:
                val = json.loads(val)
            except Exception:
                return DEFAULT_MLM_DISTRIBUTION
        if isinstance(val, list):
            return [int(x) for x in val]
    return DEFAULT_MLM_DISTRIBUTION


async def distribute_ib_commission(
    db: AsyncSession,
    trader_user_id: UUID,
    order_id: UUID,
    lots: Decimal,
    instrument_symbol: str,
):
    """Called after an order is filled. Distributes commission to the IB chain.

    Guards (audit 2026-09-28, before any IB plan existed in production):
      * demo accounts never pay real IB money — a demo fill is play money on
        one side and a withdrawable credit on the other;
      * one payout per order — every fill path (market, pending, algo, copy)
        calls this best-effort, so a retry must not pay the chain twice;
      * an IB never earns from their own trading (self-referral / multi-
        account farming): that level is skipped, the chain continues above.
    """
    # Idempotency: already paid for this order → nothing to do.
    paid_q = await db.execute(
        select(IBCommission.id).where(IBCommission.source_trade_id == order_id).limit(1)
    )
    if paid_q.scalar_one_or_none() is not None:
        return

    # Demo guard: resolve the order's account.
    acct_q = await db.execute(
        select(TradingAccount.is_demo)
        .join(Order, Order.account_id == TradingAccount.id)
        .where(Order.id == order_id)
    )
    is_demo = acct_q.scalar_one_or_none()
    if is_demo is None or is_demo:
        return

    referral_q = await db.execute(
        select(Referral).where(Referral.referred_id == trader_user_id)
    )
    # A user could (defensively) have more than one referral row; take the
    # earliest attribution rather than letting scalar_one_or_none() raise and
    # silently swallow the whole distribution.
    referral = referral_q.scalars().first()
    if not referral or not referral.ib_profile_id:
        return

    ib_profile_q = await db.execute(
        select(IBProfile).where(IBProfile.id == referral.ib_profile_id, IBProfile.is_active == True)
    )
    direct_ib = ib_profile_q.scalar_one_or_none()
    if not direct_ib:
        return

    plan = None
    if direct_ib.commission_plan_id:
        plan_q = await db.execute(
            select(IBCommissionPlan).where(IBCommissionPlan.id == direct_ib.commission_plan_id)
        )
        plan = plan_q.scalar_one_or_none()

    if not plan:
        plan_q = await db.execute(
            select(IBCommissionPlan).where(IBCommissionPlan.is_default == True)
        )
        plan = plan_q.scalar_one_or_none()

    # Effective per-lot rate: direct IB's custom override beats plan; plan beats nothing.
    per_lot = None
    if direct_ib.custom_commission_per_lot is not None and direct_ib.custom_commission_per_lot > 0:
        per_lot = Decimal(str(direct_ib.custom_commission_per_lot))
    elif plan and plan.commission_per_lot is not None:
        per_lot = Decimal(str(plan.commission_per_lot))

    if per_lot is None or per_lot <= 0:
        return

    total_commission = per_lot * lots
    if total_commission <= 0:
        return

    # Cap at what this order earned the house. Commission is the only per-
    # trade revenue that is recorded on the order (spreads are configurable
    # and can be zero), so it is the safe ceiling: payout ≤ collected.
    cap_q = await db.execute(
        select(Order.commission, Position.commission)
        .outerjoin(Position, Position.order_id == Order.id)
        .where(Order.id == order_id)
        .limit(1)
    )
    cap_row = cap_q.first()
    if cap_row is not None:
        collected = cap_row[0] if cap_row[0] is not None else cap_row[1]
        if collected is not None:
            collected = Decimal(str(collected))
            if total_commission > collected:
                logger.warning(
                    "IB pool %.4f for order %s exceeds trader commission %.4f — capped",
                    total_commission, order_id, collected,
                )
                total_commission = collected
    if total_commission <= 0:
        return

    # Prefer plan's MLM distribution; fall back to global SystemSetting; then default.
    mlm_dist: list[int] | None = None
    if plan and plan.mlm_distribution:
        raw = plan.mlm_distribution
        if isinstance(raw, str):
            try:
                raw = json.loads(raw)
            except Exception:
                raw = None
        if isinstance(raw, list) and raw:
            mlm_dist = [int(x) for x in raw]
    if mlm_dist is None:
        mlm_dist = await get_mlm_distribution(db)

    # The chain can never receive more than 100% of the per-lot pool, whatever
    # an admin typed into the plan. Negative levels pay nothing.
    mlm_dist = [max(0, int(x)) for x in mlm_dist]
    dist_total = sum(mlm_dist)
    if dist_total > 100:
        logger.warning("IB mlm_distribution sums to %d%% — scaling to 100%%", dist_total)
        mlm_dist = [x * 100 // dist_total for x in mlm_dist]

    current_ib = direct_ib
    for level, pct in enumerate(mlm_dist, start=1):
        if current_ib is None:
            break

        # An IB never earns on their own trades (self-referral). Skip the
        # level, keep walking up so genuine uplines are still paid.
        if current_ib.user_id == trader_user_id:
            logger.warning("IB %s is the trader — self-referral level skipped", current_ib.referral_code)
            current_ib = await _get_parent_ib(current_ib, db)
            continue

        share = total_commission * Decimal(str(pct)) / Decimal("100")
        if share <= 0:
            current_ib = await _get_parent_ib(current_ib, db)
            continue

        # Accrue only. Settlement credits the account once the trade closes.
        db.add(IBCommission(
            ib_id=current_ib.id,
            source_user_id=trader_user_id,
            source_trade_id=order_id,
            commission_type="trade_lot",
            amount=share,
            mlm_level=level,
            status="pending",
        ))
        await db.execute(
            update(IBProfile)
            .where(IBProfile.id == current_ib.id)
            .values(pending_payout=IBProfile.pending_payout + share)
        )
        logger.info(
            "IB commission L%d accrued: $%.2f to %s (%s %s lots, order %s)",
            level, share, current_ib.referral_code, instrument_symbol, lots, order_id,
        )

        current_ib = await _get_parent_ib(current_ib, db)


async def settle_ib_commissions(db: AsyncSession, limit: int = 200) -> int:
    """Credit every pending accrual whose source trade has CLOSED.

    Locks the rows it settles (FOR UPDATE SKIP LOCKED) so two engine
    replicas never pay the same accrual twice. Returns the number settled.
    The caller commits.
    """
    rows_q = await db.execute(
        select(IBCommission)
        .join(Position, Position.order_id == IBCommission.source_trade_id)
        .where(
            IBCommission.status == "pending",
            Position.status == PositionStatus.CLOSED,
        )
        .order_by(IBCommission.created_at.asc())
        .limit(limit)
        .with_for_update(of=IBCommission, skip_locked=True)
    )
    pending = rows_q.scalars().all()
    settled = 0
    for c in pending:
        amount = Decimal(str(c.amount or 0))
        if amount <= 0:
            c.status = "void"
            continue
        ib_q = await db.execute(select(IBProfile).where(IBProfile.id == c.ib_id))
        ib = ib_q.scalar_one_or_none()
        if ib is None:
            c.status = "void"
            continue

        acct_q = await db.execute(
            select(TradingAccount.id).where(
                TradingAccount.user_id == ib.user_id,
                TradingAccount.is_demo == False,
                TradingAccount.is_active == True,
            ).order_by(TradingAccount.created_at.asc()).limit(1)
        )
        account_id = acct_q.scalar_one_or_none()
        if account_id is None:
            # IB has no live account to receive funds yet — leave it pending;
            # it settles as soon as one exists.
            continue

        credited = await db.execute(
            update(TradingAccount)
            .where(TradingAccount.id == account_id)
            .values(
                balance=TradingAccount.balance + amount,
                equity=TradingAccount.equity + amount,
                free_margin=TradingAccount.free_margin + amount,
            )
            .returning(TradingAccount.balance)
        )
        balance_after = credited.scalar_one_or_none()
        await db.execute(
            update(IBProfile)
            .where(IBProfile.id == ib.id)
            .values(
                total_earned=IBProfile.total_earned + amount,
                pending_payout=IBProfile.pending_payout - amount,
            )
        )
        db.add(Transaction(
            user_id=ib.user_id,
            account_id=account_id,
            type="ib_commission",
            amount=amount,
            balance_after=balance_after,
            description=f"IB commission L{c.mlm_level} settled (trade closed)",
        ))
        c.status = "paid"
        settled += 1
        logger.info("IB commission settled: $%.2f to %s (L%d, order %s)", amount, ib.referral_code, c.mlm_level, c.source_trade_id)
    return settled


async def _get_parent_ib(ib: IBProfile, db: AsyncSession) -> IBProfile | None:
    if not ib.parent_ib_id:
        return None
    result = await db.execute(
        select(IBProfile).where(IBProfile.id == ib.parent_ib_id, IBProfile.is_active == True)
    )
    return result.scalar_one_or_none()
