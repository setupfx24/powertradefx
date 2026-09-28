"""Admin Auth Service — login (password + MFA), refresh, password change, me.

Controls implemented here and the threat each one addresses:

* Constant-time credential check — unknown email and wrong password cost
  the same bcrypt work and return the same 401, so response timing cannot
  be used to enumerate which addresses are admin accounts.
* MFA after the password — TOTP / backup-code is only requested once the
  password verified, so the MFA prompt itself never leaks whether an
  email exists or has 2FA enrolled. Gated by ADMIN_MFA_ENABLED.
* Revocable sessions (H-ADMIN-1) — every token carries `sid` bound to a
  user_sessions row so logout / password change kill it server-side.
* Password-fingerprinted JWTs — every token also carries `pwd` (see
  ``dependencies.password_fingerprint``) so a password rotation revokes
  all outstanding sessions even when the session lookup fails open.
* Per-account lockout — credential/MFA failures are surfaced as
  ``AdminAuthFailure`` so the route can count them against the account
  (IP-independent) without counting benign outcomes such as
  "MFA code required".
"""
from __future__ import annotations

import logging
import re
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID, uuid4

import jwt
import pyotp
from fastapi import HTTPException, status
from sqlalchemy import select, func, update as sql_update
from sqlalchemy.exc import DBAPIError, OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.auth import (
    hash_password, verify_password, hash_token, _session_is_active, invalidate_session_cache,
)
from packages.common.src.config import get_settings
from packages.common.src.models import User, Employee, UserSession, TwoFactorBackupCode
from packages.common.src.admin_schemas import AdminLoginRequest, AdminLoginResponse
from dependencies import (
    EMPLOYEE_ROLE_PERMISSIONS,
    ADMIN_ROLES,
    ADMIN_JWT_ISSUER,
    password_fingerprint,
    decode_admin_token,
    assert_token_matches_password,
)

logger = logging.getLogger("uvicorn.error")
settings = get_settings()

# Roles that may sign in to the admin API at all ("broker" = white-label
# tenant admin with scoped panel access).
_ADMIN_ROLES = ADMIN_ROLES

# Minimum admin password length. Admin accounts can move money, so the
# bar is higher than the trader-side 8.
ADMIN_MIN_PASSWORD_LENGTH = 12

# Precomputed bcrypt hash of a random secret, used as the comparison
# target when the email is unknown (or the row has no password, e.g. an
# OAuth-only user). Verifying against it costs the same as a real check,
# so the "no such account" path takes as long as the "wrong password"
# path. Generated once per process; the plaintext is discarded.
_DUMMY_PASSWORD_HASH: str = hash_password(secrets.token_urlsafe(32))


class AdminAuthFailure(HTTPException):
    """A sign-in attempt that should count towards the per-account
    lockout: wrong password, unknown email, or wrong MFA code. Outcomes
    that are NOT guesses (MFA code merely missing, inactive account,
    database unavailable, wrong admin host) raise plain ``HTTPException``
    and are not counted, otherwise a legitimate operator could be locked
    out by the normal two-step MFA dance."""


def _invalid_credentials() -> AdminAuthFailure:
    return AdminAuthFailure(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")


# ─── Token minting ────────────────────────────────────────────────────────

def create_admin_token(
    admin_id: str,
    role: str,
    password_hash: str | None,
    sid: str | None = None,
    extra_claims: Optional[dict] = None,
) -> str:
    """Mint an admin JWT.

    Claims: ``admin_id``, ``role``, ``type=admin``, ``iss`` (checked on
    decode so tokens for other audiences signed with a shared secret are
    refused), ``jti`` (unique per token; enables a future denylist),
    ``pwd`` (password fingerprint — rotating the password invalidates
    the token), ``sid`` (H-ADMIN-1: the revocable user_sessions row),
    ``iat``/``exp``. ``extra_claims`` lets the impersonation flow add
    ``employee_role`` / ``impersonated_by`` without minting its own
    unfingerprinted token.
    """
    now = datetime.now(timezone.utc)
    expire = now + timedelta(hours=settings.ADMIN_JWT_EXPIRY_HOURS)
    payload = {
        **(extra_claims or {}),
        "admin_id": admin_id,
        "role": str(role),
        "type": "admin",
        "iss": ADMIN_JWT_ISSUER,
        "jti": uuid.uuid4().hex,
        "pwd": password_fingerprint(password_hash),
        "iat": now,
        "exp": expire,
    }
    if sid is not None:
        payload["sid"] = sid
    try:
        return jwt.encode(payload, settings.ADMIN_JWT_SECRET, algorithm=settings.ADMIN_JWT_ALGORITHM)
    except jwt.PyJWTError as e:
        logger.error("Admin JWT encode failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server configuration error (JWT)",
        ) from e


async def _mint_session(admin: User, db: AsyncSession) -> AdminLoginResponse:
    """Mint a revocable session: sid → user_sessions row, so logout /
    password change can kill this token server-side (H-ADMIN-1)."""
    sid = uuid4()
    token = create_admin_token(str(admin.id), admin.role, admin.password_hash, sid=str(sid))
    db.add(UserSession(
        id=sid,
        user_id=admin.id,
        token_hash=hash_token(token),
        expires_at=datetime.now(timezone.utc) + timedelta(hours=settings.ADMIN_JWT_EXPIRY_HOURS),
    ))
    await db.commit()
    return _login_response(admin, token)


def _login_response(admin: User, token: str) -> AdminLoginResponse:
    return AdminLoginResponse(
        access_token=token,
        admin_id=str(admin.id),
        role=admin.role,
        first_name=admin.first_name,
        last_name=admin.last_name,
    )


# ─── MFA ─────────────────────────────────────────────────────────────────

_CODE_SEPARATORS = re.compile(r"[\s\-]+")


def _normalise_mfa_code(raw: str | None) -> str:
    """Strip whitespace/dashes and upper-case so '123 456', '12345-67890'
    and 'abcde fghij' all compare cleanly."""
    return _CODE_SEPARATORS.sub("", raw or "").strip().upper()


async def _consume_backup_code(user_id: uuid.UUID, code: str, db: AsyncSession) -> bool:
    """bcrypt-verify ``code`` against every unused backup code for the
    user; on a match mark that row used (single-use) and return True.
    Mirrors the trader-side ``consume_2fa_backup_code``: the loop always
    runs over the full set so timing does not reveal how many codes
    remain. Backup codes are stored hashed in their display form
    (XXXXX-XXXXX), so a 10-char bare code is re-hyphenated first."""
    candidate = code
    if len(candidate) == 10 and "-" not in candidate:
        candidate = f"{candidate[:5]}-{candidate[5:]}"
    if not candidate:
        return False
    rows = (
        await db.execute(
            select(TwoFactorBackupCode).where(
                TwoFactorBackupCode.user_id == user_id,
                TwoFactorBackupCode.used_at.is_(None),
            )
        )
    ).scalars().all()
    matched: TwoFactorBackupCode | None = None
    for row in rows:
        if verify_password(candidate, row.code_hash):
            matched = row  # keep looping — roughly constant time
    if matched is None:
        return False
    matched.used_at = datetime.now(timezone.utc)
    await db.commit()
    return True


async def _verify_second_factor(admin: User, totp_code: str | None, db: AsyncSession) -> None:
    """Enforce MFA for an admin whose PASSWORD HAS ALREADY BEEN VERIFIED.

    Ordering matters: calling this before the password check would turn
    the MFA prompt into an oracle for "this email is an admin with 2FA".
    Accepts a 6-digit TOTP (``valid_window=1`` = one 30 s step of clock
    drift either side) or a one-time backup code, which is burned on use.

    ``ADMIN_MFA_ENABLED`` is the master switch: while it is off (the
    default until the flow is verified in production) no second factor
    is requested for anyone, and ``ADMIN_MFA_REQUIRED`` is ignored.
    """
    if not settings.ADMIN_MFA_ENABLED:
        return

    if admin.two_factor_enabled:
        secret = (admin.two_factor_secret or "").strip()
        if not secret:
            # Enabled flag with no secret can only come from a broken
            # enrolment; fail closed rather than silently skipping MFA.
            logger.error("admin %s has two_factor_enabled but no secret", admin.id)
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "mfa_misconfigured",
                    "message": "Two-factor authentication is misconfigured for this account. Contact support.",
                },
            )
        code = _normalise_mfa_code(totp_code)
        if not code:
            # Not a guess: the client simply has not asked the user yet.
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "mfa_required", "message": "Two-factor authentication code required"},
            )
        ok = False
        if len(code) == 6 and code.isdigit():
            ok = pyotp.TOTP(secret).verify(code, valid_window=1)
        if not ok:
            ok = await _consume_backup_code(admin.id, code, db)
        if not ok:
            raise AdminAuthFailure(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"code": "mfa_invalid", "message": "Invalid two-factor code"},
            )
        return

    if settings.ADMIN_MFA_REQUIRED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "mfa_enrolment_required",
                "message": "Two-factor authentication must be enabled on this account before signing in",
            },
        )


# ─── White-label host isolation ──────────────────────────────────────────

async def _enforce_admin_host_isolation(admin: User, host: str | None, db: AsyncSession) -> None:
    """White-label admin-host rules (login-time; cookies are host-only so a
    session never travels between admin hosts):

      * admin.<broker-domain>  → only that broker (and brokers in its
        subtree) may sign in; the platform super-admin is also allowed
        (support/debug). Anyone else is refused.
      * platform / unknown host → a broker whose custom domain is LIVE is
        refused with a pointer to their own admin domain (they must never
        work out of admin.powertradefx.com once their panel exists). A
        broker with no live domain yet may still use the platform host —
        otherwise a fresh tenant could never log in to set things up.
    """
    from packages.common.src.config import get_settings as _gs
    if not _gs().BRANDING_ENABLED or not host:
        return
    from packages.common.src import broker_tenancy
    from packages.common.src.models import BrokerProfile
    from packages.common.src.models.broker import DOMAIN_STATUS_READY

    h = host.strip().lower().split(":", 1)[0]
    tenant_profile = None
    if h.startswith("admin."):
        apex = h[len("admin."):]
        tenant_profile = (
            await db.execute(
                select(BrokerProfile).where(
                    BrokerProfile.custom_domain == apex,
                    BrokerProfile.custom_domain_status == DOMAIN_STATUS_READY,
                    BrokerProfile.is_suspended.is_(False),
                )
            )
        ).scalar_one_or_none()

    if tenant_profile is not None:
        if admin.role == "super_admin":
            return
        owner_id = tenant_profile.user_id
        if admin.id == owner_id or owner_id in (admin.broker_ancestry or []):
            return
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This admin portal belongs to a different broker.",
        )

    # Platform / unrecognised host.
    if admin.role == "broker":
        from packages.common.src import broker_tenancy as _bt
        profile = await _bt.get_broker_profile(db, admin.id)
        if (
            profile is not None
            and profile.custom_domain
            and profile.custom_domain_status == DOMAIN_STATUS_READY
            and not profile.is_suspended
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Please sign in on your own admin portal: "
                    f"https://admin.{profile.custom_domain}"
                ),
            )


# ─── Login ───────────────────────────────────────────────────────────────

def normalise_admin_email(email: str | None) -> str:
    """Canonical form used both for the DB lookup and the per-account
    lockout key, so 'Admin@X.com ' and 'admin@x.com' share one bucket."""
    return (email or "").strip().lower()


async def admin_login(
    body: AdminLoginRequest, db: AsyncSession, host: str | None = None
) -> AdminLoginResponse:
    """Password (+ MFA) sign-in. Raises ``AdminAuthFailure`` for outcomes
    that count as a failed guess; see the class docstring."""
    email_norm = normalise_admin_email(body.email)
    if not email_norm:
        raise _invalid_credentials()

    try:
        result = await db.execute(
            select(User).where(
                func.lower(User.email) == email_norm,
                User.role.in_(_ADMIN_ROLES),
            )
        )
    except (OperationalError, DBAPIError) as e:
        logger.exception("Database error on admin login")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable",
        ) from e
    admin = result.scalar_one_or_none()

    # Always pay for one bcrypt verification. Unknown email and password-
    # less rows compare against the dummy hash so the failure path is
    # timing-indistinguishable from a wrong password on a real account.
    if admin is None or not admin.password_hash:
        verify_password(body.password, _DUMMY_PASSWORD_HASH)
        raise _invalid_credentials()
    if not verify_password(body.password, admin.password_hash):
        raise _invalid_credentials()

    # Only AFTER the password is right may the response reveal anything
    # account-specific (status, tenant state, MFA state).
    if admin.status != "active":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is not active")

    if admin.role == "broker":
        # Suspended tenants (rental lapsed, ToS breach) get a clear message
        # at the door instead of a generic 403 on every subsequent call.
        from packages.common.src import broker_tenancy
        profile = await broker_tenancy.get_broker_profile(db, admin.id)
        if profile is None or profile.is_suspended:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Broker account is suspended — contact the platform",
            )

    # White-label host isolation (tenant admin domains vs platform host).
    await _enforce_admin_host_isolation(admin, host, db)

    await _verify_second_factor(admin, body.totp_code, db)

    logger.info("admin login ok: admin_id=%s role=%s", admin.id, admin.role)
    return await _mint_session(admin, db)


# ─── Refresh ─────────────────────────────────────────────────────────────

async def admin_refresh(token: str | None, db: AsyncSession) -> AdminLoginResponse:
    """Exchange a still-valid admin token for a fresh one (sliding session).

    The token comes from the fx_admin cookie (SPA) or the request body
    (legacy clients) — the route decides which. The same issuer, session
    and password-fingerprint checks as ``get_current_admin`` apply, so a
    refresh can never resurrect a logged-out session or outlive a
    password change.

    H-ADMIN-1: verify_exp=True. Previously an EXPIRED admin token could be
    refreshed indefinitely, so a single leaked (even long-expired) token
    granted permanent access. Refresh only re-issues while the current 8h
    token is still valid. A full refresh-token table with rotation is
    tracked as an open item in REMEDIATION.md.
    """
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    payload = decode_admin_token(token, verify_exp=True)
    try:
        admin_uuid = uuid.UUID(str(payload["admin_id"]))
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    old_sid = payload.get("sid")

    result = await db.execute(
        select(User).where(
            User.id == admin_uuid,
            User.role.in_(_ADMIN_ROLES),
            User.status == "active",
        )
    )
    admin = result.scalar_one_or_none()
    if admin is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Admin not found")

    assert_token_matches_password(payload, admin)

    new_exp = datetime.now(timezone.utc) + timedelta(hours=settings.ADMIN_JWT_EXPIRY_HOURS)
    if old_sid:
        # A revoked session must NOT be refreshable — a logged-out / stolen token
        # cannot be resurrected. Fail OPEN only on an infra error, never lock out.
        try:
            still_active = await _session_is_active(old_sid)
        except Exception:
            still_active = True
        if not still_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session revoked, please sign in again")
        new_token = create_admin_token(str(admin.id), admin.role, admin.password_hash, sid=str(old_sid))
        await db.execute(
            sql_update(UserSession).where(UserSession.id == UUID(str(old_sid)))
            .values(token_hash=hash_token(new_token), expires_at=new_exp)
        )
        await db.commit()
        await invalidate_session_cache(old_sid)
        return _login_response(admin, new_token)

    # Grandfathered token (minted before sessions existed) — upgrade it to a
    # revocable session on refresh so it becomes killable going forward.
    return await _mint_session(admin, db)


# ─── Password change ─────────────────────────────────────────────────────

async def change_admin_password(
    admin: User,
    current_password: str,
    new_password: str,
    db: AsyncSession,
) -> AdminLoginResponse:
    """Rotate the admin's password.

    Every existing session for the account is revoked (user_sessions rows
    deactivated AND the password fingerprint in every outstanding token
    stops matching), so a stolen cookie or a forgotten shared machine is
    signed out immediately. The CURRENT session would be revoked too, so
    a fresh session fingerprinted against the new hash is returned for
    the route to set as the cookie — the caller keeps working, everyone
    else is signed out.
    """
    if not verify_password(current_password, admin.password_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Current password is incorrect")
    if len(new_password) < ADMIN_MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"New password must be at least {ADMIN_MIN_PASSWORD_LENGTH} characters",
        )
    if new_password == current_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must differ from the current password",
        )
    admin.password_hash = hash_password(new_password)
    # Kill every existing session for this admin so a changed password
    # invalidates any outstanding (possibly stolen) token immediately.
    sids = (await db.execute(
        select(UserSession.id).where(
            UserSession.user_id == admin.id, UserSession.is_active == True,  # noqa: E712
        )
    )).scalars().all()
    await db.execute(
        sql_update(UserSession).where(UserSession.user_id == admin.id).values(is_active=False)
    )
    await db.commit()
    for _sid in sids:
        await invalidate_session_cache(str(_sid))
    logger.info("admin password changed: admin_id=%s (all other sessions revoked)", admin.id)
    return await _mint_session(admin, db)


# ─── Me ──────────────────────────────────────────────────────────────────

async def get_admin_me(admin: User, db: AsyncSession) -> dict:
    employee_role = None
    permissions = set()

    if admin.role == "super_admin":
        employee_role = "super_admin"
        permissions = {"*"}
    elif admin.role == "broker":
        # White-label tenant: expose the tri-state section grants so the
        # admin frontend can build the (scoped) sidebar. Expressed in the
        # same "<section>.<action>" vocabulary the frontend already gates
        # on: view granted at VIEW+, mutations granted at EDIT.
        from packages.common.src import broker_tenancy
        from packages.common.src.models.broker import (
            PERMISSION_EDIT, PERMISSION_VIEW, permission_at_least,
        )
        profile = await broker_tenancy.get_broker_profile(db, admin.id)
        broker_perms: set[str] = set()
        levels = (profile.permissions or {}) if profile else {}
        _view_map = {
            "users": ["users.view"],
            "kyc": ["kyc.view"],
            "deposits": ["deposits.view"],
            "withdrawals": ["withdrawals.view"],
            "trades": ["trades.view", "positions.view", "orders.view"],
            "transactions": ["transactions.view"],
            "sub_brokers": ["sub_brokers.view"],
        }
        _edit_map = {
            "users": ["users.ban", "users.block_trading"],
            "kyc": ["kyc.manage"],
            "deposits": ["deposits.approve", "deposits.reject"],
            "withdrawals": ["withdrawals.approve", "withdrawals.reject"],
            "sub_brokers": ["sub_brokers.manage"],
        }
        for section, level in levels.items():
            if permission_at_least(level, PERMISSION_VIEW):
                broker_perms.update(_view_map.get(section, []))
            if permission_at_least(level, PERMISSION_EDIT):
                broker_perms.update(_edit_map.get(section, []))
        return {
            "id": str(admin.id),
            "email": admin.email,
            "first_name": admin.first_name,
            "last_name": admin.last_name,
            "role": admin.role,
            "employee_role": "broker",
            "permissions": sorted(broker_perms),
            "broker_permission_levels": levels,
            "brand_name": profile.brand_name if profile else None,
            "logo_url": profile.logo_url if profile else None,
            "partner_code": profile.partner_code if profile else None,
            "two_factor_enabled": bool(admin.two_factor_enabled),
        }
    else:
        emp_q = await db.execute(
            select(Employee).where(Employee.user_id == admin.id, Employee.is_active == True)
        )
        emp = emp_q.scalar_one_or_none()
        if emp:
            employee_role = emp.role
            permissions = EMPLOYEE_ROLE_PERMISSIONS.get(emp.role, set())

    return {
        "id": str(admin.id),
        "email": admin.email,
        "first_name": admin.first_name,
        "last_name": admin.last_name,
        "role": admin.role,
        "employee_role": employee_role,
        "permissions": list(permissions),
        "two_factor_enabled": bool(admin.two_factor_enabled),
    }
