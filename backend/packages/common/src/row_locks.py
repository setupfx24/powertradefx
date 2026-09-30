"""Row-level locks for balance mutations (C-TRADE-4 / H-TRADE-1).

Several balance-mutating paths read a User / TradingAccount row, checked a
balance, then wrote it back without a row lock — so two concurrent requests
could both read the pre-debit balance, both pass the check, and both write,
double-spending the wallet or overdrawing an account.

These helpers take a `SELECT ... FOR UPDATE` lock so concurrent mutators
serialise on the row. To avoid deadlocks every caller MUST acquire locks in the
same canonical order:

    user first, then trading account(s) in ascending id.

(The transfer paths in wallet_service already follow this order.)
"""
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import User, TradingAccount, Position

# populate_existing: if this session already holds the row (loaded earlier
# without a lock), SQLAlchemy would otherwise hand back that STALE in-memory
# copy even though the FOR UPDATE ran; the caller then writes a balance
# computed from pre-lock values and silently erases a concurrent update
# (QA 2026-09-29: concurrent closes/orders lost commission and P&L). With it,
# the locked row's current values overwrite the in-session copy.
_FRESH = {"populate_existing": True}

# FOR NO KEY UPDATE (key_share=True): serialises every balance writer on the
# row exactly like FOR UPDATE, but does NOT block other transactions inserting
# rows that REFERENCE it (a new Position/Transaction/audit row takes a KEY
# SHARE lock on its users/trading_accounts parent). With plain FOR UPDATE a
# transfer holding the user row deadlocked against an order inserting an
# audit row for the same user (QA 2026-09-29, HTTP 500s).
_LOCK = {"key_share": True}


async def lock_user(db: AsyncSession, user_id: UUID) -> User | None:
    """Lock and return the User row (FOR UPDATE). Lock this BEFORE any account."""
    return (
        await db.execute(
            select(User).where(User.id == user_id).with_for_update(**_LOCK).execution_options(**_FRESH)
        )
    ).scalar_one_or_none()


async def lock_account(
    db: AsyncSession, account_id: UUID, *, user_id: UUID | None = None
) -> TradingAccount | None:
    """Lock and return a TradingAccount row (FOR UPDATE). Lock AFTER the user.
    Pass user_id to also enforce ownership in the same query."""
    q = select(TradingAccount).where(TradingAccount.id == account_id)
    if user_id is not None:
        q = q.where(TradingAccount.user_id == user_id)
    return (await db.execute(q.with_for_update(**_LOCK).execution_options(**_FRESH))).scalar_one_or_none()


async def lock_accounts(db: AsyncSession, account_ids) -> dict:
    """Lock several accounts in the canonical ascending-id order (deadlock-safe).
    Returns {account_id: TradingAccount}."""
    out = {}
    for aid in sorted({a for a in account_ids if a is not None}, key=str):
        row = await lock_account(db, aid)
        if row is not None:
            out[aid] = row
    return out


async def lock_position(db: AsyncSession, position_id: UUID) -> Position | None:
    """Lock and return a Position row (FOR UPDATE, fresh values).

    Canonical order for trade mutations: user (if needed) -> account(s) ->
    position. Every close/modify path must re-check the position's status
    AFTER taking this lock, so a position closed concurrently is never closed
    or credited twice."""
    return (
        await db.execute(
            select(Position).where(Position.id == position_id).with_for_update(**_LOCK).execution_options(**_FRESH)
        )
    ).scalar_one_or_none()
