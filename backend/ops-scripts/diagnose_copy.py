"""Diagnose + auto-repair copy-trading wiring.

Run this ON THE SERVER inside the gateway container when followers are not
receiving the master's trades:

    docker compose exec gateway python -m services.gateway.src.diagnose_copy

It is SAFE to run repeatedly. It prints, for every master, exactly why the
copy engine would (or would not) mirror trades, and auto-fixes the two
data-drift problems that silently break copying:

  1. master.followers_count out of sync with the real number of active
     allocations  → recomputed from the allocations (the copy engine used to
     skip masters whose counter had drifted to 0).
  2. nothing it can safely auto-fix for "master is trading on the wrong
     account" — that needs a human decision — but it REPORTS it loudly:
     if the master has open positions on a different non-demo account than
     the one registered as master.account_id, copies can never happen and
     the registered account must be changed (or the master must trade on the
     registered account).

Nothing is deleted. The only write is followers_count = <real active count>.
"""
import asyncio
import logging
from decimal import Decimal

from sqlalchemy import select, func

from packages.common.src.database import AsyncSessionLocal
from packages.common.src.models import (
    MasterAccount, InvestorAllocation, TradingAccount, Position, CopyTrade, User,
)

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("diagnose-copy")

COPY_COMMENT_PREFIX = "Copy of master position "


def _is_copy(pos: Position) -> bool:
    c = pos.comment or ""
    return COPY_COMMENT_PREFIX in c or "Copy of master" in c


async def diagnose() -> None:
    repairs = 0
    async with AsyncSessionLocal() as db:
        masters = (await db.execute(select(MasterAccount))).scalars().all()
        if not masters:
            logger.info("No master accounts exist at all. Nobody has become a provider yet.")
            return

        for m in masters:
            logger.info("\n==================== MASTER %s ====================", m.id)
            logger.info("  type=%s  status=%s  followers_count(stored)=%s",
                        m.master_type, m.status, m.followers_count)

            # Registered master account
            reg_acct = await db.get(TradingAccount, m.account_id) if m.account_id else None
            if reg_acct is None:
                logger.info("  ❌ master.account_id=%s but that trading account does NOT exist.", m.account_id)
            else:
                logger.info("  registered master account = %s (id=%s)  equity=%s  is_active=%s  is_demo=%s",
                            reg_acct.account_number, reg_acct.id,
                            reg_acct.equity, reg_acct.is_active, reg_acct.is_demo)

            # Open (non-copy) positions on the registered account
            reg_open = 0
            if reg_acct is not None:
                pos_rows = (await db.execute(
                    select(Position).where(
                        Position.account_id == reg_acct.id,
                        Position.status == "open",
                    )
                )).scalars().all()
                reg_open = sum(1 for p in pos_rows if not _is_copy(p))
            logger.info("  open non-copy positions on registered account: %d", reg_open)

            # Real active allocations vs the stored counter
            active_allocs = (await db.execute(
                select(InvestorAllocation).where(
                    InvestorAllocation.master_id == m.id,
                    InvestorAllocation.status == "active",
                )
            )).scalars().all()
            real_active = len(active_allocs)
            logger.info("  active allocations (real)=%d   stored followers_count=%s",
                        real_active, m.followers_count)

            if (m.followers_count or 0) != real_active:
                logger.info("  🔧 REPAIR: followers_count %s → %d (was out of sync — this alone "
                            "could stop the engine from mirroring).", m.followers_count, real_active)
                m.followers_count = real_active
                repairs += 1

            # "Trading on the wrong account" detection: does the master USER hold
            # ANOTHER non-demo account that has open positions, while the
            # registered account has none?
            if reg_open == 0:
                other_accts = (await db.execute(
                    select(TradingAccount).where(
                        TradingAccount.user_id == m.user_id,
                        TradingAccount.is_demo == False,  # noqa: E712
                    )
                )).scalars().all()
                for a in other_accts:
                    if reg_acct is not None and a.id == reg_acct.id:
                        continue
                    cnt = (await db.execute(
                        select(func.count(Position.id)).where(
                            Position.account_id == a.id,
                            Position.status == "open",
                        )
                    )).scalar() or 0
                    if cnt > 0:
                        logger.info(
                            "  ⚠️  WRONG ACCOUNT: master is trading on %s (id=%s, %d open) "
                            "but the REGISTERED master account is %s. Copies only mirror trades "
                            "on the registered account. Fix: either re-point master.account_id "
                            "to %s, or have the master trade on %s.",
                            a.account_number, a.id, cnt,
                            reg_acct.account_number if reg_acct else m.account_id,
                            a.account_number,
                            reg_acct.account_number if reg_acct else "(the registered account)",
                        )

            # Per-follower detail
            for alloc in active_allocs:
                inv_acct = await db.get(TradingAccount, alloc.investor_account_id) if alloc.investor_account_id else None
                copies = (await db.execute(
                    select(func.count(CopyTrade.id)).where(
                        CopyTrade.investor_allocation_id == alloc.id
                    )
                )).scalar() or 0
                u = await db.get(User, alloc.investor_user_id)
                if inv_acct is None:
                    logger.info("    follower %s: ❌ investor_account_id is NULL/missing — copies "
                                "cannot open. (allocation=%s)", (u.email if u else alloc.investor_user_id), alloc.id)
                else:
                    logger.info("    follower %s: account=%s active=%s equity=%s | copy_trades so far=%d",
                                (u.email if u else alloc.investor_user_id),
                                inv_acct.account_number, inv_acct.is_active, inv_acct.equity, copies)

        if repairs:
            await db.commit()
            logger.info("\n✅ Committed %d followers_count repair(s). Restart the gateway so the copy "
                        "engine picks up the corrected masters and seeds existing open trades.", repairs)
        else:
            logger.info("\nNo counter repairs needed. If a ⚠️ WRONG ACCOUNT line appeared above, fix that; "
                        "otherwise the cause is shown per-follower above.")


if __name__ == "__main__":
    asyncio.run(diagnose())
