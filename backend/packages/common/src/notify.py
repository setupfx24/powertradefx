"""In-app notification helper — DB row + Redis pub/sub fan-out.

Pure in-app surface. Email delivery lives in `smtp_mail.py` + the
`email_templates/` package — keep them separate so a notification never
implicitly fires a transactional email and vice versa.
"""
import json
import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from .models import Notification
from .redis_client import redis_client

logger = logging.getLogger("notify")

TYPES = {
    "trade": "trade",
    "sl_hit": "trade",
    "tp_hit": "trade",
    "order": "trade",
    "deposit": "wallet",
    "withdrawal": "wallet",
    "admin_fund": "wallet",
    "login": "security",
    "system": "system",
}


async def notify_all_admins(
    db: AsyncSession,
    title: str,
    message: str,
    notif_type: str = "system",
    action_url: str | None = None,
    commit: bool = True,
) -> int:
    """Fan-out a notification to every user with role 'admin' or
    'super_admin'. Used for back-office events (new deposit, proof
    upload, KYC submission, master application, etc.) so the admin
    bell icon lights up in real time without polling Postgres for
    state.

    Returns the number of admin rows that received the notification.
    Safe to call inside another transaction (`commit=False`).
    """
    from .models import User  # local import — avoid circulars at load
    from sqlalchemy import select

    admins_q = await db.execute(
        select(User.id).where(User.role.in_(["admin", "super_admin"]))
    )
    admin_ids = [row[0] for row in admins_q.all()]
    for admin_id in admin_ids:
        await create_notification(
            db,
            user_id=admin_id,
            title=title,
            message=message,
            notif_type=notif_type,
            action_url=action_url,
            commit=False,
        )
    if commit:
        await db.flush()
    return len(admin_ids)


async def create_notification(
    db: AsyncSession,
    user_id: UUID,
    title: str,
    message: str,
    notif_type: str = "info",
    action_url: str | None = None,
    commit: bool = True,
):
    """Insert a Notification row and publish to Redis so any open WebSocket
    subscribed to `notifications:{user_id}` receives it. The `commit` flag
    lets the caller batch the insert with surrounding work — e.g. when a
    trade-close handler is mid-transaction we want the notification to
    land or roll back atomically with the position update."""
    n = Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=notif_type,
        action_url=action_url,
    )
    db.add(n)
    if commit:
        await db.flush()

    try:
        await redis_client.publish(f"notifications:{user_id}", json.dumps({
            "type": "notification",
            "id": str(n.id),
            "title": title,
            "message": message,
            "notif_type": notif_type,
        }))
    except Exception:
        # Pub/sub is best-effort: a Redis blip must not roll back the
        # caller's transaction. The DB row is what survives — clients
        # reconcile on the next /notifications fetch.
        pass

    # OS-level push so the user is alerted even when the app is closed.
    # Fire-and-forget on its own DB session — never blocks or rolls back the
    # caller. Reads tokens independently of this (possibly uncommitted) row.
    try:
        import asyncio
        from .push import send_push_to_user
        asyncio.create_task(send_push_to_user(
            user_id, title, message,
            {"action_url": action_url, "type": notif_type},
        ))
    except Exception:
        pass

    return n
