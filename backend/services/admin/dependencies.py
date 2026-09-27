import hashlib
import hmac
import logging
import uuid
from datetime import datetime
from functools import wraps
from typing import Optional

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.config import get_settings
from packages.common.src.database import get_db
from packages.common.src.models import User, Employee

security = HTTPBearer()
settings = get_settings()
logger = logging.getLogger(__name__)

EMPLOYEE_ROLE_PERMISSIONS = {
    "super_admin": {"*"},
    "trade_manager": {
        "trades.view", "trades.modify", "trades.close", "trades.create",
        "positions.view", "orders.view", "users.view",
        "social.view", "social.manage",
    },
    # Support = support desk only. Deposits/withdrawals/KYC/audit access
    # is NOT part of the default — grant per-employee via extra
    # permissions (shield icon on the Employees page) when needed.
    "support": {
        "tickets.view", "tickets.reply", "tickets.assign",
        "users.view",
    },
    "finance": {
        "deposits.view", "deposits.approve", "deposits.reject",
        "withdrawals.view", "withdrawals.approve", "withdrawals.reject",
        "users.view", "users.add_fund", "users.deduct_fund",
        "banks.view", "banks.create", "banks.update",
        "ib.view",
        "kyc.view", "kyc.manage",
    },
    "risk_manager": {
        "trades.view", "positions.view", "users.view",
        "users.ban", "users.block_trading", "users.kill_switch",
        "analytics.view", "exposure.view",
        "audit_logs.view",
    },
    "marketing": {
        "banners.view", "banners.create", "banners.update", "banners.delete",
        "bonus.view", "bonus.create", "bonus.update",
        "ib.view", "ib.manage",
    },
}


ADMIN_COOKIE_NAME = "fx_admin"

# `iss` claim stamped on every admin JWT and required on decode. Stops a
# token signed for another audience with the same HS256 secret (a shared
# .env, a copy-pasted secret between services) from being accepted here.
ADMIN_JWT_ISSUER = "powertradefx-admin"

# Length of the password fingerprint carried in the `pwd` claim: 16 hex
# chars = 64 bits, plenty to distinguish "same hash" from "rotated" and
# short enough to keep the cookie small. It is derived from the bcrypt
# HASH, never the password, so the claim reveals nothing usable.
_PWD_FINGERPRINT_HEX_LEN = 16


def password_fingerprint(password_hash: str | None) -> str:
    """Fingerprint of the stored bcrypt hash, embedded in the admin JWT.

    Threat: an admin whose credential leaked rotates their password, but
    every session minted before the rotation stays valid until `exp`
    (up to ADMIN_JWT_EXPIRY_HOURS + the refresh grace window). Binding
    the token to sha256(password_hash) makes a password change revoke
    all outstanding sessions on the next request, with no session table
    or migration. bcrypt hashes are salted, so the fingerprint changes
    even when the same password is set again.
    """
    return hashlib.sha256((password_hash or "").encode("utf-8")).hexdigest()[:_PWD_FINGERPRINT_HEX_LEN]


def decode_admin_token(token: str, *, verify_exp: bool = True) -> dict:
    """Verify signature, issuer and token type; return the claims.

    Raises 401 on any failure. ``verify_exp=False`` is used only by the
    refresh flow, which deliberately accepts recently-expired tokens and
    enforces its own bounded grace window.
    """
    try:
        payload = jwt.decode(
            token,
            settings.ADMIN_JWT_SECRET,
            algorithms=[settings.ADMIN_JWT_ALGORITHM],
            issuer=ADMIN_JWT_ISSUER,
            options={"verify_exp": verify_exp, "require": ["iss", "exp", "iat"]},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    if payload.get("type") != "admin":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin token")
    if not payload.get("admin_id"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    return payload


def assert_token_matches_password(payload: dict, admin: User) -> None:
    """Reject a token whose `pwd` claim does not match the admin's CURRENT
    password hash (see ``password_fingerprint``). A missing claim is also
    rejected: tokens minted before this check existed are invalidated
    exactly once and the operator simply signs in again — the acceptable
    cost of not needing a migration or a session table."""
    claimed = payload.get("pwd")
    if not isinstance(claimed, str) or not hmac.compare_digest(
        claimed, password_fingerprint(admin.password_hash)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session invalidated — please sign in again",
        )


async def get_current_admin(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(
        HTTPBearer(auto_error=False)
    ),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Resolve the active admin from EITHER an HttpOnly cookie (preferred —
    no XSS-readable token) OR a Bearer header (legacy clients). The
    cookie path is what the new admin frontend uses; the header path
    is retained so cron / scripts that already mint a token via /login
    keep working until they migrate.

    Every token must carry the admin issuer and a `pwd` fingerprint that
    matches the account's current password hash, so a password rotation
    kills all pre-existing sessions on their next request."""
    token: str | None = None
    cookie_token = request.cookies.get(ADMIN_COOKIE_NAME)
    if cookie_token:
        token = cookie_token
    elif credentials is not None:
        token = credentials.credentials
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    payload = decode_admin_token(token)
    try:
        admin_uuid = uuid.UUID(str(payload["admin_id"]))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    result = await db.execute(
        select(User).where(
            User.id == admin_uuid,
            User.role.in_(["admin", "super_admin"]),
            User.status == "active",
        )
    )
    admin = result.scalar_one_or_none()
    if admin is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin user not found or inactive")

    assert_token_matches_password(payload, admin)
    return admin


async def require_super_admin(
    admin: User = Depends(get_current_admin),
) -> User:
    """Gate for super-admin-only surfaces (settings, employee management).
    Employees authenticate as role="admin" users, so get_current_admin
    alone does NOT keep them out."""
    if admin.role != "super_admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin access required",
        )
    return admin


def require_permission(permission: str):
    """FastAPI dependency factory that checks if the current admin has the required permission."""
    async def _check(
        admin: User = Depends(get_current_admin),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        # Only super admins bypass per-permission checks. Employees are
        # stored as role="admin" users WITH an employees row (so they can
        # pass admin login) — letting role "admin" bypass here would give
        # every support/finance employee unrestricted backend access.
        if admin.role == "super_admin":
            return admin

        result = await db.execute(
            select(Employee).where(Employee.user_id == admin.id, Employee.is_active == True)
        )
        employee = result.scalar_one_or_none()
        if employee is None:
            # A role="admin" user with no employees row used to be treated as
            # a "legacy full admin" and bypassed every permission check — any
            # path that created an admin user without an employee record
            # silently granted god mode. Deny now; log loudly so a genuinely
            # legacy account is easy to diagnose and fix (a super_admin can
            # recreate it from the Employees page, which writes both rows).
            logger.warning(
                "admin user %s (role=admin) has no active employees row — "
                "denied '%s'. Create an employee record for this account "
                "via the Employees page to restore access.",
                admin.id, permission,
            )
        else:
            role_perms = EMPLOYEE_ROLE_PERMISSIONS.get(employee.role, set())
            extra = set(employee.extra_permissions or [])
            effective = role_perms | extra
            if "*" in effective or permission in effective:
                return admin

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission '{permission}' required",
        )
    return _check


async def write_audit_log(
    db: AsyncSession,
    admin_id: uuid.UUID,
    action: str,
    entity_type: str,
    entity_id: Optional[uuid.UUID] = None,
    old_values: Optional[dict] = None,
    new_values: Optional[dict] = None,
    ip_address: Optional[str] = None,
):
    """Insert one row into the admin audit log.

    CONTRACT: this function does NOT commit. The audit insert MUST share
    the caller's transaction with whatever financial mutation it
    documents — otherwise a crash between the audit write and the
    mutation commit would leave one of them orphaned. We only flush, so
    the caller's eventual db.commit() (or db.rollback() on error) is
    the single decision point. Do NOT add db.commit() here under any
    circumstance — the C4 concern from the security audit is exactly
    that.

    Defence in depth: any free-floating Decimal in the JSON payload is
    coerced to a string here so JSONB stores its exact representation
    instead of a lossy float — see H10."""
    from decimal import Decimal as _D
    from packages.common.src.models import AuditLog

    def _safe(d):
        if d is None:
            return None
        return {k: (str(v) if isinstance(v, _D) else v) for k, v in d.items()}

    log = AuditLog(
        admin_id=admin_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_values=_safe(old_values),
        new_values=_safe(new_values),
        ip_address=ip_address,
    )
    db.add(log)
    await db.flush()
