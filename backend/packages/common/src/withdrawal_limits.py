"""Single source of truth for how much a user may withdraw from a debit source.

C-MONEY-3 / H-MONEY-1: several withdrawal paths (main-wallet withdrawal, manual
UPI payout, on-chain USDT) each derived the withdrawable figure inline, and two
of them used the raw account *balance* — letting a user pull out funds that
collateralise open positions (margin). This helper centralises the rule so every
path agrees:

  * trading account → only funds NOT backing open positions:
    (balance - margin_used), additionally capped by free_margin when the
    account tracks it, and reduced by any live FLOATING LOSS. Credit/bonus is
    never withdrawable and floating profit is not withdrawable until realised.
    Never negative.
  * main wallet     → main_wallet_balance minus un-released bonus.
"""
from decimal import Decimal

from fastapi import HTTPException


def _d(v) -> Decimal:
    return Decimal(str(v)) if v is not None else Decimal("0")


def available_to_withdraw(
    kind: str,
    *,
    balance=None,
    margin_used=None,
    free_margin=None,
    main_wallet_balance=None,
    outstanding_bonus=None,
    floating_pnl=None,
) -> Decimal:
    """Return the amount withdrawable from the given source. See module docstring.

    H-MONEY-2: for the main wallet, subtract the user's outstanding (un-released)
    bonus credit — deposit bonuses are non-withdrawable, so they must not be
    cashable via a wallet withdrawal even though they were credited to the
    main-wallet balance.

    floating_pnl (trading only): live unrealised P&L of the account's open
    positions. A floating LOSS reduces what may leave the account (QA
    2026-09-29: a user moved collateral out while 800 under water, got stopped
    out below zero and the broker wrote the deficit off). A floating profit is
    ignored — it is not money until the position is closed."""
    if kind == "trading":
        avail = _d(balance) - _d(margin_used)
        if free_margin is not None:
            avail = min(avail, _d(free_margin))
        if floating_pnl is not None and _d(floating_pnl) < 0:
            avail = avail + _d(floating_pnl)
        return avail if avail > Decimal("0") else Decimal("0")
    avail = _d(main_wallet_balance) - _d(outstanding_bonus)
    return avail if avail > Decimal("0") else Decimal("0")


async def live_floating_pnl(db, account) -> Decimal:
    """Unrealised P&L (account currency) of the account's OPEN positions at the
    price each would close at NOW (bid for buys, ask for sells).

    Raises HTTPException(409) when an open position has no live quote or needs
    a cross rate that is unavailable: without a price we cannot know how much
    of the balance is really free, and assuming 0 is exactly the hole this
    closes."""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    from .models import OrderSide, Position, PositionStatus
    from .trading_service import (
        TradingServiceError, _needs_cross_rate, calc_position_pnl,
        cross_rate_for, get_current_price,
    )

    rows = (await db.execute(
        select(Position)
        .options(selectinload(Position.instrument))
        .where(Position.account_id == account.id, Position.status == PositionStatus.OPEN)
    )).scalars().all()
    ccy = (getattr(account, "currency", None) or "USD").upper()
    total = Decimal("0")
    for pos in rows:
        inst = pos.instrument
        try:
            bid, ask = await get_current_price(inst.symbol)
        except TradingServiceError:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"No live price for {inst.symbol}, so the funds free on this account "
                    "cannot be calculated right now. Try again shortly."
                ),
            )
        cross = await cross_rate_for(inst, ccy)
        if cross is None and _needs_cross_rate(inst, ccy):
            raise HTTPException(
                status_code=409,
                detail=f"No conversion rate for {inst.symbol} right now. Try again shortly.",
            )
        price = bid if pos.side == OrderSide.BUY else ask
        total += calc_position_pnl(
            pos.side, Decimal(str(pos.open_price)), price, Decimal(str(pos.lots)),
            Decimal(str(inst.contract_size or 0)), instrument=inst,
            account_currency=ccy, cross_rate=cross,
        )
    return total


async def live_trading_withdrawable(db, account) -> Decimal:
    """Amount that may leave a trading account right now: balance - margin_used,
    reduced by the LIVE floating loss (never the stored free_margin, which the
    risk engine may not have refreshed since the last price move). Credit is
    never included. Caller must hold the account row lock (lock_account) so
    balance and margin_used are current."""
    floating = await live_floating_pnl(db, account)
    return available_to_withdraw(
        "trading",
        balance=account.balance,
        margin_used=account.margin_used,
        floating_pnl=floating,
    )


# PAMM/MAM pool accounts hold investors' money under the manager's user_id.
# Money may only leave them through investor redemption / fee settlement,
# never through the manager's own wallet endpoints (QA 2026-09-29: a manager
# moved pool money to his main wallet and investors' NAV dropped).
_POOL_TYPES = ("pamm", "mamm", "mam")
_POOL_INACTIVE_STATUSES = ("pending", "rejected")


async def is_managed_pool_account(db, account_id) -> bool:
    if account_id is None:
        return False
    from sqlalchemy import select

    from .models import MasterAccount

    row = (await db.execute(
        select(MasterAccount.id).where(
            MasterAccount.account_id == account_id,
            MasterAccount.master_type.in_(_POOL_TYPES),
            MasterAccount.status.notin_(_POOL_INACTIVE_STATUSES),
        ).limit(1)
    )).first()
    return row is not None


async def assert_not_managed_pool(db, *account_ids) -> None:
    """403 when any of the accounts is a live PAMM/MAM investor pool."""
    for aid in account_ids:
        if await is_managed_pool_account(db, aid):
            raise HTTPException(
                status_code=403,
                detail=(
                    "This is a managed (PAMM/MAM) pool account. Its funds belong to investors "
                    "and can only move through the pool's invest/withdraw flow."
                ),
            )
