"""Admin in-app notifications — read + mark-read endpoints.

Reuses the existing `notifications` table (per-user rows). The gateway
service writes notifications addressed to admin user_ids via
`notify_all_admins()`; this router lets the admin frontend list and
acknowledge them.
"""
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.database import get_db
from packages.common.src.models import Notification, User
from dependencies import get_current_admin


router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("")
async def list_notifications(
    limit: int = Query(20, ge=1, le=100),
    unread: bool = Query(False),
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Returns the most-recent notifications for the logged-in admin.

    `unread=true` filters out anything already acknowledged so the bell
    icon's badge math doesn't need a second query."""
    q = select(Notification).where(Notification.user_id == admin.id)
    if unread:
        q = q.where(Notification.is_read.is_(False))
    q = q.order_by(Notification.created_at.desc()).limit(limit)
    rows = (await db.execute(q)).scalars().all()

    # Count of unread is cheap and useful to keep the badge correct even
    # when `unread=false` is passed for the dropdown listing.
    unread_q = await db.execute(
        select(Notification.id).where(
            Notification.user_id == admin.id,
            Notification.is_read.is_(False),
        )
    )
    unread_count = len(unread_q.all())

    return {
        "items": [
            {
                "id": str(n.id),
                "title": n.title,
                "message": n.message,
                "type": n.type,
                "is_read": bool(n.is_read),
                "action_url": n.action_url,
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in rows
        ],
        "unread_count": unread_count,
    }


@router.post("/{notification_id}/read")
async def mark_read(
    notification_id: uuid.UUID,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Mark a single notification as read. Idempotent — re-flagging an
    already-read row is a no-op."""
    await db.execute(
        update(Notification)
        .where(
            Notification.id == notification_id,
            Notification.user_id == admin.id,
        )
        .values(is_read=True)
    )
    await db.commit()
    return {"ok": True}


@router.post("/read-all")
async def mark_all_read(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Mark every unread notification for the logged-in admin as read."""
    await db.execute(
        update(Notification)
        .where(
            Notification.user_id == admin.id,
            Notification.is_read.is_(False),
        )
        .values(is_read=True)
    )
    await db.commit()
    return {"ok": True}
