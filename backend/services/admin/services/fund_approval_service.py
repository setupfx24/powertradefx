"""Two-person rule for admin fund moves (audit item behind migration 0037).

Policy: every add-fund / deduct-fund / give-credit / take-credit initiated
by a NON-super-admin lands in `fund_move_approvals` as `pending` instead of
executing. A second, different admin (super_admin, or an employee granted
`funds.approve`) executes or rejects it. Super admins' own moves execute
immediately — they are the root authority, and requiring a second super
admin would deadlock single-operator installs.

The approver's execution reuses the exact user_service functions the
direct path uses, so balance math, row locking, transactions and audit
logging stay identical — the approval row is just a gate in front.
"""
import uuid
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from dependencies import write_audit_log
from packages.common.src.admin_schemas import CreditRequest, FundRequest
from packages.common.src.models import FundMoveApproval, User

# action → (user_service function name, request schema)
_ACTIONS = {
    "add_fund": ("add_fund", FundRequest),
    "deduct_fund": ("deduct_fund", FundRequest),
    "give_credit": ("give_credit", CreditRequest),
    "take_credit": ("take_credit", CreditRequest),
}


async def request_move(
    action: str,
    target_user_id: uuid.UUID,
    body,
    admin: User,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    """Stage a fund move as pending. Called for non-super-admin initiators."""
    if action not in _ACTIONS:
        raise HTTPException(status_code=400, detail=f"Unknown fund action '{action}'")

    target = (
        await db.execute(select(User.id).where(User.id == target_user_id))
    ).scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="User not found")

    account_id = getattr(body, "account_id", None)
    approval = FundMoveApproval(
        action=action,
        target_user_id=target_user_id,
        target_account_id=uuid.UUID(account_id) if account_id else None,
        amount=body.amount,
        source=getattr(body, "source", None),
        description=body.description,
        requested_by=admin.id,
        status="pending",
    )
    db.add(approval)
    await db.flush()

    await write_audit_log(
        db, admin.id, f"{action}_requested", "fund_move_approval", approval.id,
        new_values={
            "target_user_id": str(target_user_id),
            "amount": body.amount,
            "source": getattr(body, "source", None),
        },
        ip_address=ip_address,
    )
    await db.commit()
    return {
        "status": "pending_approval",
        "approval_id": str(approval.id),
        "message": "Request submitted — a second admin must approve this fund move before it executes.",
    }


async def list_moves(
    status: str | None,
    page: int,
    per_page: int,
    db: AsyncSession,
) -> dict:
    requester = aliased(User)
    target = aliased(User)
    q = (
        select(
            FundMoveApproval,
            requester.email.label("requested_by_email"),
            target.email.label("target_user_email"),
        )
        .join(requester, requester.id == FundMoveApproval.requested_by)
        .join(target, target.id == FundMoveApproval.target_user_id)
        .order_by(FundMoveApproval.requested_at.desc())
    )
    count_q = select(func.count()).select_from(FundMoveApproval)
    if status:
        q = q.where(FundMoveApproval.status == status)
        count_q = count_q.where(FundMoveApproval.status == status)

    total = (await db.execute(count_q)).scalar_one()
    rows = (
        await db.execute(q.offset((page - 1) * per_page).limit(per_page))
    ).all()

    items = []
    for approval, requested_by_email, target_user_email in rows:
        items.append({
            "id": str(approval.id),
            "action": approval.action,
            "target_user_id": str(approval.target_user_id),
            "target_user_email": target_user_email,
            "target_account_id": str(approval.target_account_id) if approval.target_account_id else None,
            "amount": float(approval.amount),
            "source": approval.source,
            "description": approval.description,
            "status": approval.status,
            "requested_by": str(approval.requested_by),
            "requested_by_email": requested_by_email,
            "requested_at": approval.requested_at.isoformat() if approval.requested_at else None,
            "approved_by": str(approval.approved_by) if approval.approved_by else None,
            "approved_at": approval.approved_at.isoformat() if approval.approved_at else None,
            "rejected_by": str(approval.rejected_by) if approval.rejected_by else None,
            "rejected_at": approval.rejected_at.isoformat() if approval.rejected_at else None,
            "rejection_reason": approval.rejection_reason,
            "executed_at": approval.executed_at.isoformat() if approval.executed_at else None,
        })
    return {"items": items, "total": total, "page": page, "per_page": per_page}


async def _load_pending_locked(approval_id: uuid.UUID, db: AsyncSession) -> FundMoveApproval:
    """Lock the row so two approvers can't both execute it."""
    approval = (
        await db.execute(
            select(FundMoveApproval)
            .where(FundMoveApproval.id == approval_id)
            .with_for_update()
        )
    ).scalar_one_or_none()
    if approval is None:
        raise HTTPException(status_code=404, detail="Approval not found")
    if approval.status != "pending":
        raise HTTPException(status_code=409, detail=f"Approval is already {approval.status}")
    return approval


async def approve(
    approval_id: uuid.UUID,
    admin: User,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    from services import user_service

    approval = await _load_pending_locked(approval_id, db)
    if approval.requested_by == admin.id:
        raise HTTPException(
            status_code=403,
            detail="A different admin must approve this request (two-person rule)",
        )

    fn_name, schema = _ACTIONS[approval.action]
    body = schema(
        account_id=str(approval.target_account_id) if approval.target_account_id else None,
        amount=float(approval.amount),
        description=approval.description,
        **({"source": approval.source} if schema is FundRequest else {}),
    )

    # Mark the approval first so the executor's commit persists both the
    # move and the approval flip atomically. If the executor raises
    # (insufficient balance, account gone), the session rolls back and
    # the row stays pending.
    now = datetime.utcnow()
    approval.status = "executed"
    approval.approved_by = admin.id
    approval.approved_at = now
    approval.executed_at = now
    await write_audit_log(
        db, admin.id, f"{approval.action}_approved", "fund_move_approval", approval.id,
        new_values={
            "requested_by": str(approval.requested_by),
            "target_user_id": str(approval.target_user_id),
            "amount": float(approval.amount),
        },
        ip_address=ip_address,
    )

    result = await getattr(user_service, fn_name)(
        user_id=approval.target_user_id, body=body,
        admin_id=admin.id, ip_address=ip_address, db=db,
    )
    result["approval_id"] = str(approval.id)
    result["status"] = "executed"
    return result


async def reject(
    approval_id: uuid.UUID,
    reason: str | None,
    admin: User,
    ip_address: str | None,
    db: AsyncSession,
) -> dict:
    approval = await _load_pending_locked(approval_id, db)

    approval.status = "rejected"
    approval.rejected_by = admin.id
    approval.rejected_at = datetime.utcnow()
    approval.rejection_reason = reason
    await write_audit_log(
        db, admin.id, f"{approval.action}_rejected", "fund_move_approval", approval.id,
        new_values={"reason": reason, "requested_by": str(approval.requested_by)},
        ip_address=ip_address,
    )
    await db.commit()
    return {"status": "rejected", "approval_id": str(approval.id)}
