import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from packages.common.src.config import get_settings
from packages.common.src.database import engine
from packages.common.src.instrumentation import init_sentry, add_middleware_stack

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-5s [%(name)s] %(message)s")
logger = logging.getLogger("admin-api")

from routes import (
    auth, dashboard, users, trades, deposits, banks, book,
    config as routes_config, instruments_admin, business, social, analytics, bonus, banners,
    support, employees, settings, transactions, kyc, account_types, user_audit_logs,
    admin_audit_logs,
    deposit_wallets,
    notifications,
    fund_approvals,
)

app_settings = get_settings()
init_sentry("admin-api")

_cors_origins = [
    o.strip()
    for o in app_settings.CORS_ORIGINS.split(",")
    if o.strip()
]
if not _cors_origins:
    _cors_origins = ["http://localhost:3001"]
_cors_methods = [m.strip() for m in app_settings.CORS_ALLOW_METHODS.split(",") if m.strip()]
_cors_headers = [h.strip() for h in app_settings.CORS_ALLOW_HEADERS.split(",") if h.strip()]


async def _apply_startup_ddl():
    """Idempotent ALTERs that unblock admin endpoints when manual migrations
    haven't been run yet on a host (Render/Vercel/etc.). Safe to re-run."""
    from sqlalchemy import text
    try:
        async with engine.begin() as conn:
            await conn.execute(text(
                "ALTER TABLE employees ADD COLUMN IF NOT EXISTS extra_permissions JSONB DEFAULT '[]'::jsonb"
            ))
            # Book-management LP settings read/write this table. Create if the
            # baseline migration hasn't been applied so GET/PUT don't 500.
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS system_settings (
                    key VARCHAR(100) PRIMARY KEY,
                    value JSONB NOT NULL,
                    description TEXT,
                    updated_by UUID REFERENCES users(id),
                    updated_at TIMESTAMPTZ DEFAULT now()
                )
            """))
            # Algo Connector — per-account API keys for external bots. Bootstrap
            # so key generation works even if alembic 0055 hasn't run on a host.
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS algo_api_keys (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
                    account_id UUID REFERENCES trading_accounts(id) ON DELETE CASCADE,
                    api_key VARCHAR(64) UNIQUE NOT NULL,
                    secret_hash VARCHAR(128) NOT NULL,
                    label VARCHAR(100) DEFAULT '',
                    is_active BOOLEAN DEFAULT true,
                    last_used_at TIMESTAMPTZ,
                    trades_count INTEGER DEFAULT 0,
                    created_at TIMESTAMPTZ DEFAULT now()
                )
            """))
            await conn.execute(text(
                "CREATE INDEX IF NOT EXISTS idx_algo_api_keys_api_key ON algo_api_keys(api_key)"
            ))
            # Plaintext secret storage was removed (alembic 0056) — auth only
            # ever compares secret_hash. Drop the column here too so hosts that
            # never run alembic also stop holding plaintext trading credentials.
            await conn.execute(text(
                "ALTER TABLE algo_api_keys DROP COLUMN IF EXISTS api_secret"
            ))
    except Exception as e:
        logger.warning("startup DDL skipped: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await _apply_startup_ddl()
    yield
    await engine.dispose()


# Docs are an opt-in exposure (security audit M6). Previously this
# exposed the full admin OpenAPI spec on any environment that wasn't
# tagged exactly "development". Now docs only mount when ENVIRONMENT is
# explicitly dev/local.
_EXPOSE_DOCS = app_settings.ENVIRONMENT in ("development", "local")
app = FastAPI(
    title="PowerTradeFX Admin API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if _EXPOSE_DOCS else None,
    redoc_url="/redoc" if _EXPOSE_DOCS else None,
    openapi_url="/openapi.json" if _EXPOSE_DOCS else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=_cors_methods,
    allow_headers=_cors_headers,
)

add_middleware_stack(app)

_UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


@app.middleware("http")
async def csrf_origin_guard(request: Request, call_next):
    """CSRF defence for cookie-authenticated mutations.

    SameSite=strict on fx_admin blocks cross-SITE requests, but not
    cross-ORIGIN same-site ones — trade.powertradefx.com and the apex
    share the registrable domain, so XSS there could form-POST here with
    the cookie attached. Browsers send Origin on every POST, so a
    present-but-unlisted Origin is rejected. Absent Origin is allowed:
    that's the admin-frontend Next proxy (which strips Origin and does
    its own same-origin check) or a non-browser client, where an ambient
    cookie can't be riding a forged cross-site request. Bearer-only
    requests are exempt — no ambient credential, no CSRF.
    """
    if request.method in _UNSAFE_METHODS and request.cookies.get("fx_admin"):
        origin = request.headers.get("origin")
        if origin and origin not in _cors_origins:
            return JSONResponse(
                status_code=403,
                content={"detail": "Cross-origin request blocked"},
            )
    return await call_next(request)


@app.exception_handler(Exception)
async def unhandled_exception(request: Request, exc: Exception):
    """Return JSON (not plain text) so proxies and the admin UI can parse errors."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


prefix = "/api/v1/admin"

app.include_router(auth.router, prefix=prefix)
app.include_router(dashboard.router, prefix=prefix)
app.include_router(users.router, prefix=prefix)
app.include_router(trades.router, prefix=prefix)
app.include_router(book.router, prefix=prefix)
app.include_router(deposits.router, prefix=prefix)
app.include_router(banks.router, prefix=prefix)
app.include_router(routes_config.router, prefix=prefix)
app.include_router(instruments_admin.router, prefix=prefix)
app.include_router(business.router, prefix=prefix)
app.include_router(social.router, prefix=prefix)
app.include_router(analytics.router, prefix=prefix)
app.include_router(bonus.router, prefix=prefix)
app.include_router(banners.router, prefix=prefix)
app.include_router(support.router, prefix=prefix)
app.include_router(employees.router, prefix=prefix)
app.include_router(settings.router, prefix=prefix)
app.include_router(transactions.router, prefix=prefix)
app.include_router(kyc.router, prefix=prefix)
app.include_router(account_types.router, prefix=prefix)
app.include_router(user_audit_logs.router, prefix=prefix)
app.include_router(admin_audit_logs.router, prefix=prefix)
app.include_router(deposit_wallets.router, prefix=prefix)
app.include_router(notifications.router, prefix=prefix)
app.include_router(fund_approvals.router, prefix=prefix)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "admin"}
