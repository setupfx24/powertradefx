"""IB Commission — shared by the gateway (market orders, algo, copy trades)
and the b-book engine (pending-order fills) so every trade from a referred
user is treated identically.

Three phases, deliberately separated:

ACCRUE (``distribute_ib_commission``, called at fill)
  1. Find the referrer IB via the Referral table
  2. Resolve the per-lot rate (IB custom override > plan > nothing)
  3. Cap the pool at the commission the trader actually paid on this order —
     the house never pays the chain more than it collected, so a referred
     second account cannot be farmed for the difference
  4. Split up the MLM chain and write IBCommission rows with status
     ``accrued``. Nothing is owed yet: the source trade is still open.

RELEASE (``settle_ib_commissions``, run by the b-book engine every 10 s)
  Every accrued row whose source position is CLOSED flips to ``pending``
  and is added to IBProfile.pending_payout (atomic SQL). A trade that is
  still open keeps its accrual, so an IB cannot cash out on a position
  that was only just opened.

PAY OUT (admin ``business_service.approve_ib_payout``)
  Pending rows are credited to the IB's live trading account and marked
  ``paid``. This is the ONLY place money moves — commissions used to be
  written status="paid" and credited in the same transaction as the fill,
  with no one approving the payout.

Guards on the accrue path (audit 2026-09-28, before any IB plan existed in
production): demo accounts never earn anyone real money; one accrual set
per order however many fill paths retry; an IB never earns on their own
trades (self-referral / multi-account farming) — that level is skipped.

Neither function commits; the caller owns the transaction (the gateway
wraps it in a background session it commits; the b-book engine relies on
its loop's commit).
"""
import json
import logging
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from .models import (
    Referral, IBProfile, IBCommission, IBCommissionPlan,
    SystemSetting, Order, Position, PositionStatus, TradingAccount,
)

logger = logging.getLogger("ib-engine")

DEFAULT_MLM_DISTRIBUTION = [40, 25, 15, 10, 10]

# IBCommission.status written at fill time: earned on an OPEN trade, not yet
# owed. settle_ib_commissions flips it to "pending" once the position is
# closed; the admin payout flow only ever sees "pending".
STATUS_ACCRUED = "accrued"


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
    """Called after an order is filled. Accrues commission for the IB chain.

    Guards (audit 2026-09-28, before any IB plan existed in production):
      * demo accounts never earn real IB money — a demo fill is play money on
        one side and a withdrawable credit on the other;
      * one accrual per order — every fill path (market, pending, algo, copy)
        calls this best-effort, so a retry must not pay the chain twice;
      * an IB never earns from their own trading (self-referral / multi-
        account farming): that level is skipped, the chain continues above.
    """
    # Idempotency: already accrued for this order → nothing to do.
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

    # Effective rates. A plan can price a trade three ways and they ADD up —
    # only commission_per_lot was ever read, so a plan configured with a
    # per-trade fee or a spread share silently paid the IB nothing.
    #
    #   per lot     : rate x lots            (IB's custom override beats plan)
    #   per trade   : flat, once per fill
    #   spread share: a cut of the markup the broker actually captured
    per_lot = Decimal("0")
    if direct_ib.custom_commission_per_lot is not None and direct_ib.custom_commission_per_lot > 0:
        per_lot = Decimal(str(direct_ib.custom_commission_per_lot))
    elif plan and plan.commission_per_lot:
        per_lot = Decimal(str(plan.commission_per_lot))

    per_trade = Decimal("0")
    if direct_ib.custom_commission_per_trade is not None and direct_ib.custom_commission_per_trade > 0:
        per_trade = Decimal(str(direct_ib.custom_commission_per_trade))
    elif plan and plan.commission_per_trade:
        per_trade = Decimal(str(plan.commission_per_trade))

    spread_share = Decimal("0")
    if plan and plan.spread_share_pct and Decimal(str(plan.spread_share_pct)) > 0:
        revenue = await _spread_revenue(db, trader_user_id, instrument_symbol, lots)
        spread_share = revenue * Decimal(str(plan.spread_share_pct)) / Decimal("100")

    total_commission = (per_lot * lots) + per_trade + spread_share
    if total_commission <= 0:
        return

    # Cap at what this order earned the house. Commission is the only per-
    # trade revenue that is recorded on the order (spreads are configurable
    # and can be zero), so it is the safe ceiling: payout <= collected.
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

        # Accrue only. The row becomes a pending (approvable) commission once
        # the trade closes (settle_ib_commissions), and money moves only when
        # an admin releases the payout (approve_ib_payout). Nothing here
        # touches pending_payout or a balance.
        db.add(IBCommission(
            ib_id=current_ib.id,
            source_user_id=trader_user_id,
            source_trade_id=order_id,
            commission_type="trade",
            amount=share,
            mlm_level=level,
            status=STATUS_ACCRUED,
        ))
        logger.info(
            "IB commission L%d accrued: $%.2f to %s (%s %s lots, order %s) — releases when the trade closes",
            level, share, current_ib.referral_code, instrument_symbol, lots, order_id,
        )

        current_ib = await _get_parent_ib(current_ib, db)


async def settle_ib_commissions(db: AsyncSession, limit: int = 200) -> int:
    """Release every accrued commission whose source trade has CLOSED.

    Flips the row to ``pending`` and adds it to IBProfile.pending_payout
    with an atomic SQL increment (two engine replicas / two rows for the
    same IB never lose an update). Locks the rows it releases (FOR UPDATE
    SKIP LOCKED) so two replicas never release the same accrual twice.
    Returns the number released. The caller commits. Money is credited
    later by the admin payout approval, never here.
    """
    rows_q = await db.execute(
        select(IBCommission)
        .join(Position, Position.order_id == IBCommission.source_trade_id)
        .where(
            IBCommission.status == STATUS_ACCRUED,
            Position.status == PositionStatus.CLOSED,
        )
        .order_by(IBCommission.created_at.asc())
        .limit(limit)
        .with_for_update(of=IBCommission, skip_locked=True)
    )
    accrued = rows_q.scalars().all()
    released = 0
    for c in accrued:
        amount = Decimal(str(c.amount or 0))
        if amount <= 0:
            c.status = "rejected"
            continue
        ib_q = await db.execute(select(IBProfile.id, IBProfile.referral_code).where(IBProfile.id == c.ib_id))
        ib = ib_q.first()
        if ib is None:
            c.status = "rejected"
            continue
        await db.execute(
            update(IBProfile)
            .where(IBProfile.id == c.ib_id)
            .values(pending_payout=IBProfile.pending_payout + amount)
        )
        c.status = "pending"
        released += 1
        logger.info(
            "IB commission released to pending payout: $%.2f to %s (L%d, order %s, trade closed)",
            amount, ib[1], c.mlm_level, c.source_trade_id,
        )
    return released



async def _spread_revenue(
    db: AsyncSession, trader_user_id: UUID, instrument_symbol: str, lots: Decimal,
) -> Decimal:
    """What the broker actually captured in spread markup on this fill.

    The quote is built symmetrically around the mid (see
    instrument_pricing.symmetric_quote_from_mid), so an entry fill captures
    HALF the configured spread; the other half is captured when the position
    closes. Paying the IB on the half taken at this fill is the honest reading
    — the alternative (paying the full spread at entry) would pay out revenue
    the broker has not earned yet and would double-count if the close ever
    started paying too.

    Returns 0 rather than guessing whenever anything needed is missing.
    """
    from .instrument_pricing import resolve_spread_config
    from .models import Instrument, TradingAccount

    inst_q = await db.execute(
        select(Instrument).where(Instrument.symbol == str(instrument_symbol).upper())
    )
    instrument = inst_q.scalar_one_or_none()
    if instrument is None:
        return Decimal("0")

    acct_q = await db.execute(
        select(TradingAccount).where(
            TradingAccount.user_id == trader_user_id,
            TradingAccount.is_demo == False,  # noqa: E712
        ).limit(1)
    )
    account = acct_q.scalar_one_or_none()

    try:
        spread_value, spread_type, _impact = await resolve_spread_config(
            db,
            instrument,
            user_id=trader_user_id,
            account_group_id=getattr(account, "account_group_id", None),
            trading_account_id=getattr(account, "id", None),
        )
    except Exception as exc:
        logger.warning("IB spread share: could not resolve spread for %s: %s", instrument_symbol, exc)
        return Decimal("0")

    if not spread_value or Decimal(str(spread_value)) <= 0:
        return Decimal("0")

    spread = Decimal(str(spread_value))
    if str(spread_type).lower() == "pips":
        pip_size = Decimal(str(getattr(instrument, "pip_size", None) or "0.0001"))
        spread = spread * pip_size

    contract_size = Decimal(str(getattr(instrument, "contract_size", None) or "100000"))
    return spread / Decimal("2") * lots * contract_size


async def distribute_ib_cpa(
    db: AsyncSession,
    trader_user_id: UUID,
    deposit_amount: Decimal,
):
    """One-off CPA when a referred user funds their account for the first time.

    Separate entry point because CPA is triggered by a DEPOSIT, not a trade —
    which is why plan.cpa_per_deposit had never paid anything: the only caller
    of the commission engine was the fill path. Charged once per referred user,
    guarded by looking for an existing cpa row rather than a flag, so a replayed
    or retried deposit cannot pay twice.

    Like the trade path, this accrues as PENDING and credits nothing directly.
    """
    if deposit_amount is None or Decimal(str(deposit_amount)) <= 0:
        return

    referral_q = await db.execute(
        select(Referral).where(Referral.referred_id == trader_user_id)
    )
    referral = referral_q.scalars().first()
    if not referral or not referral.ib_profile_id:
        return

    ib_q = await db.execute(
        select(IBProfile).where(IBProfile.id == referral.ib_profile_id, IBProfile.is_active == True)  # noqa: E712
    )
    direct_ib = ib_q.scalar_one_or_none()
    if not direct_ib:
        return

    already_q = await db.execute(
        select(IBCommission).where(
            IBCommission.source_user_id == trader_user_id,
            IBCommission.commission_type == "cpa",
        ).limit(1)
    )
    if already_q.scalar_one_or_none() is not None:
        return  # this trader has already produced their CPA

    plan = None
    if direct_ib.commission_plan_id:
        plan_q = await db.execute(
            select(IBCommissionPlan).where(IBCommissionPlan.id == direct_ib.commission_plan_id)
        )
        plan = plan_q.scalar_one_or_none()
    if not plan:
        plan_q = await db.execute(
            select(IBCommissionPlan).where(IBCommissionPlan.is_default == True)  # noqa: E712
        )
        plan = plan_q.scalar_one_or_none()

    if not plan or not plan.cpa_per_deposit or Decimal(str(plan.cpa_per_deposit)) <= 0:
        return

    amount = Decimal(str(plan.cpa_per_deposit))

    db.add(IBCommission(
        ib_id=direct_ib.id,
        source_user_id=trader_user_id,
        source_trade_id=None,
        commission_type="cpa",
        amount=amount,
        mlm_level=1,
        status="pending",
    ))
    direct_ib.pending_payout = (direct_ib.pending_payout or Decimal("0")) + amount
    logger.info(f"IB CPA: ${amount:.2f} accrued (pending) to {direct_ib.referral_code}")


async def _get_parent_ib(ib: IBProfile, db: AsyncSession) -> IBProfile | None:
    if not ib.parent_ib_id:
        return None
    result = await db.execute(
        select(IBProfile).where(IBProfile.id == ib.parent_ib_id, IBProfile.is_active == True)
    )
    return result.scalar_one_or_none()
