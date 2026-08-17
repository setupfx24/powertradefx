import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from dependencies import require_permission
from packages.common.src.database import get_db
from packages.common.src.models import User
from services import fund_approval_service

router = APIRouter(prefix="/fund-approvals", tags=["Fund Approvals"])


class RejectBody(BaseModel):
    reason: Optional[str] = None


@router.get("")
async def list_fund_approvals(
    status: str = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    admin: User = Depends(require_permission("users.view")),
    db: AsyncSession = Depends(get_db),
):
    return await fund_approval_service.list_moves(
        status=status, page=page, per_page=per_page, db=db,
    )


@router.post("/{approval_id}/approve")
async def approve_fund_move(
    approval_id: uuid.UUID,
    request: Request,
    admin: User = Depends(require_permission("funds.approve")),
    db: AsyncSession = Depends(get_db),
):
    return await fund_approval_service.approve(
        approval_id=approval_id, admin=admin,
        ip_address=request.client.host if request.client else None, db=db,
    )


@router.post("/{approval_id}/reject")
async def reject_fund_move(
    approval_id: uuid.UUID,
    body: RejectBody,
    request: Request,
    admin: User = Depends(require_permission("funds.approve")),
    db: AsyncSession = Depends(get_db),
):
    return await fund_approval_service.reject(
        approval_id=approval_id, reason=body.reason, admin=admin,
        ip_address=request.client.host if request.client else None, db=db,
    )
