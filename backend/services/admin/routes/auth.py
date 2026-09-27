"""Admin auth routes — the only place the `fx_admin` session cookie is
issued or cleared.

Cookie contract: HttpOnly + SameSite=strict + Secure (always in
production), Path=/ so the same cookie reaches both entry points the
admin SPA uses — `/admin-api/*` (Next.js proxy) and `/api/v1/admin/*`
(nginx direct). The JWT is never returned in a JSON body.
"""
from __future__ import annotations

import hashlib
from typing import Optional

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from packages.common.src.config import get_settings
from packages.common.src.database import get_db
from packages.common.src.rate_limit import rate_limit_http, rate_limit_key, rate_limit_reset
from dependencies import get_current_admin, ADMIN_COOKIE_NAME
from packages.common.src.models import User
from packages.common.src.admin_schemas import AdminLoginRequest, AdminRefreshRequest
from services import auth_service
from services.auth_service import AdminAuthFailure


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


router = APIRouter(prefix="/auth", tags=["Auth"])
_settings = get_settings()

# Fields of AdminLoginResponse that must never leave the server in JSON.
_TOKEN_FIELDS = {"access_token", "token_type"}

# Per-account lockout: 5 FAILED attempts (wrong password / wrong MFA code)
# within 15 minutes locks sign-in for that account until the window
# slides. Keyed on the account, not the IP, so a distributed guessing
# campaign against one admin still hits the wall.
ACCOUNT_LOCK_MAX_FAILURES = 5
ACCOUNT_LOCK_WINDOW_SEC = 15 * 60.0
_ACCOUNT_LOCK_DETAIL = "Too many failed sign-in attempts — try again in {minutes} minutes"


def _account_lock_key(email_norm: str) -> str:
    """Bucket key for the per-account throttle. The email is hashed so
    raw addresses never appear in Redis keys or rate-limit logs."""
    digest = hashlib.sha256(email_norm.encode("utf-8")).hexdigest()[:32]
    return f"rl:admin-login-acct:{digest}"


def _request_is_https(request: Request) -> bool:
    """Whether the Secure flag must be set on the session cookie.

    In production the answer is always yes — an admin cookie must never
    be issued without Secure, regardless of what proxy headers say (a
    stripped X-Forwarded-Proto must not downgrade the cookie). Elsewhere
    (local / staging over plain HTTP) we follow the forwarded scheme so
    the cookie still works in dev browsers.
    """
    if _settings.ENVIRONMENT.lower() == "production":
        return True
    if (request.headers.get("x-forwarded-proto") or "").lower().startswith("https"):
        return True
    return request.url.scheme == "https"


def _cookie_attrs(request: Request) -> dict:
    """Attributes shared by set and delete so the browser matches the
    same cookie on both operations."""
    return {
        "path": "/",
        "httponly": True,
        "secure": _request_is_https(request),
        "samesite": "strict",
    }


def _set_admin_cookie(resp: Response, request: Request, token: str) -> None:
    """Drop the admin JWT into the `fx_admin` HttpOnly cookie.

    HttpOnly: script (XSS) cannot read it. SameSite=strict: the browser
    never attaches it to cross-site requests (CSRF). Secure: never sent
    over plain HTTP (always on in production, see ``_request_is_https``).
    Path=/: the cookie must reach both `/admin-api` (the Next.js proxy)
    and `/api/v1/admin` (nginx direct), so it cannot be narrowed to one
    prefix; isolation from the trader app comes from the separate cookie
    name and the admin-only JWT issuer/secret, not from the path.
    """
    max_age = int(_settings.ADMIN_JWT_EXPIRY_HOURS) * 3600
    resp.set_cookie(key=ADMIN_COOKIE_NAME, value=token, max_age=max_age, **_cookie_attrs(request))


def _clear_admin_cookie(resp: Response, request: Request) -> None:
    """Expire the session cookie with the SAME attributes it was set with.
    Browsers only clear a cookie when path/secure/samesite match, so a
    bare delete_cookie(path="/") leaves a Secure cookie in place."""
    resp.delete_cookie(key=ADMIN_COOKIE_NAME, **_cookie_attrs(request))


@router.post("/login")
async def admin_login(
    body: AdminLoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    """Issue an admin session as an HttpOnly cookie ONLY.

    The token is set on a `Set-Cookie` header marked HttpOnly + Secure +
    SameSite=strict. We deliberately strip it from the JSON body so that
    an XSS shell, an intercepted browser response, or a curl session that
    forgot to ignore the body cannot exfiltrate the bearer credential.

    Responses:
      200  cookie set; body {admin_id, role, first_name, last_name}
      401  "Invalid credentials" (unknown email OR wrong password)
      403  {"code": "mfa_required"|"mfa_invalid"|"mfa_enrolment_required"}
           or "Account is not active"
      429  per-IP burst or per-account lockout (Retry-After header)
    """
    # Throttle per client IP. Admin accounts grant full money movement
    # and impersonation, so the bucket is significantly tighter than the
    # trader login (which sits at 40/min): 10 attempts per 60s ≈ 1 every
    # 6 seconds, enough to retype a wrong password but not enough for
    # credential stuffing / spraying. Audit finding H1.
    rate_limit_http(request, "admin-login", 10, 60.0)

    # Per-account lockout, IP-independent. Peek (record=False) BEFORE any
    # password work so a locked account costs nothing and leaks nothing;
    # only genuine failed guesses are recorded below.
    lock_key = _account_lock_key(auth_service.normalise_admin_email(body.email))
    rate_limit_key(
        lock_key, ACCOUNT_LOCK_MAX_FAILURES, ACCOUNT_LOCK_WINDOW_SEC,
        detail=_ACCOUNT_LOCK_DETAIL, record=False,
    )
    try:
        result = await auth_service.admin_login(body=body, db=db)
    except AdminAuthFailure:
        # Wrong password / unknown email / wrong MFA code — consume a
        # slot. If this was the last free slot the account is now locked
        # for the window; the caller still gets the auth error for THIS
        # attempt (a 429 only replaces it if a parallel request already
        # filled the bucket, which is a truthful answer too).
        rate_limit_key(
            lock_key, ACCOUNT_LOCK_MAX_FAILURES, ACCOUNT_LOCK_WINDOW_SEC,
            detail=_ACCOUNT_LOCK_DETAIL, record=True,
        )
        raise

    rate_limit_reset(lock_key)
    _set_admin_cookie(response, request, result.access_token)
    return result.model_dump(exclude=_TOKEN_FIELDS)


@router.post("/refresh")
async def admin_refresh(
    request: Request,
    response: Response,
    body: Optional[AdminRefreshRequest] = None,
    db: AsyncSession = Depends(get_db),
):
    """Renew the session. The cookie-only SPA posts no body and the token
    is read from the `fx_admin` cookie; legacy clients may still supply
    `access_token` in the body (body wins when both are present). Same
    body-stripping as `/login` — the new token travels only in the
    cookie. A token whose password fingerprint no longer matches is
    refused, so refresh cannot outlive a password change."""
    rate_limit_http(request, "admin-refresh", 30, 60.0)
    token = (body.access_token if body else None) or request.cookies.get(ADMIN_COOKIE_NAME)
    result = await auth_service.admin_refresh(token=token, db=db)
    _set_admin_cookie(response, request, result.access_token)
    return result.model_dump(exclude=_TOKEN_FIELDS)


@router.post("/logout")
async def admin_logout(request: Request, response: Response):
    """Clear the admin cookie. Idempotent — safe to call when not signed in."""
    _clear_admin_cookie(response, request)
    return {"message": "Signed out"}


@router.post("/change-password")
async def change_admin_password(
    body: ChangePasswordRequest,
    request: Request,
    response: Response,
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    """Rotate the password. Every other session for this account is
    revoked (tokens are fingerprinted against the password hash); the
    current session is re-issued via a fresh cookie so the caller is not
    locked out mid-request. Clients should still prompt a re-login."""
    result = await auth_service.change_admin_password(
        admin=admin,
        current_password=body.current_password,
        new_password=body.new_password,
        db=db,
    )
    _set_admin_cookie(response, request, result.access_token)
    return {"message": "Password changed — please sign in again"}


@router.get("/me")
async def get_admin_me(
    admin: User = Depends(get_current_admin),
    db: AsyncSession = Depends(get_db),
):
    return await auth_service.get_admin_me(admin=admin, db=db)
