"""Shared instrumentation — Sentry, rate limiting, Prometheus metrics, request size limit.

Usage in any FastAPI service:

    from packages.common.src.instrumentation import init_sentry, add_middleware_stack

    init_sentry("gateway")
    app = FastAPI(...)
    add_middleware_stack(app)
"""
import logging
import time
from starlette.requests import Request
from starlette.responses import Response, JSONResponse

from .config import get_settings

logger = logging.getLogger("instrumentation")
settings = get_settings()


# ---------------------------------------------------------------------------
# 1. Sentry
# ---------------------------------------------------------------------------
def init_sentry(service_name: str) -> None:
    """Initialise Sentry SDK if SENTRY_DSN is configured."""
    dsn = settings.SENTRY_DSN
    if not dsn:
        logger.info("SENTRY_DSN not set — Sentry disabled for %s", service_name)
        return
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

        # ── PII / secret redaction ───────────────────────────────────
        # send_default_pii=False blocks Sentry's *automatic* PII pulls,
        # but the FastAPI integration still ships request bodies +
        # breadcrumbs that almost certainly contain sensitive data on a
        # money-flow API: deposit amounts, tx hashes, raw webhook
        # bodies, NOWPayments IPN secrets in error contexts, KYC field
        # values, JWTs from headers, etc. We scrub them in before_send
        # so an exception during webhook processing never accidentally
        # leaks a webhook secret or a user's session cookie.
        _REDACT = "[redacted]"
        _SENSITIVE_HEADERS = {
            "authorization", "cookie", "set-cookie", "x-api-key",
            "x-api-secret", "x-razorpay-signature", "hmac",
        }
        _SENSITIVE_URL_PREFIXES = (
            "/api/v1/webhooks/",   # Razorpay / OxaPay / on-chain IPNs
            "/api/v1/auth/",       # passwords, OAuth tokens, 2FA codes
            "/api/lp/",            # Corecen LP push (HMAC-signed prices)
            "/api/v1/wallet/",     # deposit/withdraw bodies
            "/api/v1/admin/",      # admin actions (login-as codes etc.)
        )

        def _scrub_headers(headers: dict | None) -> dict | None:
            if not headers:
                return headers
            return {
                k: (_REDACT if k.lower() in _SENSITIVE_HEADERS else v)
                for k, v in headers.items()
            }

        def _before_send(event: dict, _hint: dict) -> dict | None:
            try:
                req = event.get("request") or {}
                url = (req.get("url") or "")
                req["headers"] = _scrub_headers(req.get("headers"))
                # Drop request bodies wholesale on sensitive paths — much
                # safer than trying to identify which field is a secret.
                if any(p in url for p in _SENSITIVE_URL_PREFIXES):
                    if "data" in req:
                        req["data"] = _REDACT
                # Always strip query strings on auth endpoints — legacy
                # ?token=... fallbacks have ended up in URLs.
                if "/auth" in url and "query_string" in req:
                    req["query_string"] = _REDACT
                event["request"] = req
            except Exception:
                # Never let a redaction bug drop a real exception report.
                pass
            return event

        sentry_sdk.init(
            dsn=dsn,
            traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
            environment=settings.ENVIRONMENT,
            release=f"powertradefx-{service_name}@1.0.0",
            integrations=[
                FastApiIntegration(transaction_style="endpoint"),
                SqlalchemyIntegration(),
            ],
            send_default_pii=False,
            before_send=_before_send,
            # Don't include request bodies in event payloads by default;
            # the before_send hook is a second layer of defence in case
            # this is ignored on some SDK paths.
            max_request_body_size="never",
        )
        logger.info("Sentry initialised for %s (env=%s)", service_name, settings.ENVIRONMENT)
    except Exception as exc:
        logger.warning("Failed to initialise Sentry: %s", exc)


# ---------------------------------------------------------------------------
# 2. Rate Limiting (slowapi)
# ---------------------------------------------------------------------------
_limiter_instance = None


def get_rate_limiter():
    """Return a singleton SlowAPI Limiter instance."""
    global _limiter_instance
    if _limiter_instance is None:
        from slowapi import Limiter
        from slowapi.util import get_remote_address
        from .rate_limit import client_ip_for_inet

        def _client_key(request):
            # Same verified client IP as every other limiter (nginx overwrites
            # CF-Connecting-IP with the address it validated), so each real
            # user has their own bucket and a client can't pick theirs.
            return client_ip_for_inet(request) or get_remote_address(request)

        _limiter_instance = Limiter(
            key_func=_client_key,
            default_limits=[settings.RATE_LIMIT_DEFAULT],
            storage_uri=settings.REDIS_URL,
        )
    return _limiter_instance


def add_rate_limit_handler(app):
    """Attach SlowAPI exception handler to the app."""
    from slowapi.errors import RateLimitExceeded
    from slowapi.middleware import SlowAPIMiddleware

    limiter = get_rate_limiter()
    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)

    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
        return JSONResponse(
            status_code=429,
            content={"detail": "Rate limit exceeded. Please slow down."},
        )


# ---------------------------------------------------------------------------
# 3. Request Body Size Limit Middleware
# ---------------------------------------------------------------------------
class _BodyTooLarge(Exception):
    pass


class RequestSizeLimitMiddleware:
    """Reject request bodies larger than MAX_REQUEST_SIZE.

    Pure ASGI (not BaseHTTPMiddleware) so it can count the bytes ACTUALLY
    streamed: the old version only trusted the Content-Length header, so a
    chunked (Transfer-Encoding) upload with no Content-Length bypassed the cap
    entirely, and a malformed Content-Length crashed with a 500. Now:
      * declared Content-Length over the cap → 413 before reading anything;
      * non-numeric Content-Length → 400;
      * streamed body that grows past the cap (chunked) → 413.
    """

    def __init__(self, app, max_size: int | None = None):
        self.app = app
        self.max_size = max_size or settings.MAX_REQUEST_SIZE

    async def _reply(self, send, status_code: int, detail: str) -> None:
        resp = JSONResponse(status_code=status_code, content={"detail": detail})
        await send({
            "type": "http.response.start",
            "status": resp.status_code,
            "headers": resp.raw_headers,
        })
        await send({"type": "http.response.body", "body": resp.body})

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return

        too_large = f"Request body too large. Max {self.max_size // (1024 * 1024)} MB."
        for name, value in scope.get("headers") or []:
            if name == b"content-length":
                try:
                    declared = int(value)
                except (ValueError, TypeError):
                    await self._reply(send, 400, "Invalid Content-Length header.")
                    return
                if declared < 0:
                    await self._reply(send, 400, "Invalid Content-Length header.")
                    return
                if declared > self.max_size:
                    await self._reply(send, 413, too_large)
                    return
                break

        received = 0
        response_started = False

        async def limited_receive():
            nonlocal received
            message = await receive()
            if message.get("type") == "http.request":
                received += len(message.get("body", b"") or b"")
                if received > self.max_size:
                    raise _BodyTooLarge()
            return message

        async def tracking_send(message):
            nonlocal response_started
            if message.get("type") == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, limited_receive, tracking_send)
        except _BodyTooLarge:
            if not response_started:
                await self._reply(send, 413, too_large)


# ---------------------------------------------------------------------------
# 4. Prometheus Metrics Middleware
# ---------------------------------------------------------------------------
try:
    from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

    REQUEST_COUNT = Counter(
        "http_requests_total",
        "Total HTTP requests",
        ["method", "endpoint", "status"],
    )
    REQUEST_LATENCY = Histogram(
        "http_request_duration_seconds",
        "HTTP request latency",
        ["method", "endpoint"],
    )
    _PROM_AVAILABLE = True
except ImportError:
    _PROM_AVAILABLE = False


def add_metrics_endpoint(app):
    """Add /metrics endpoint for Prometheus scraping — internal scrapers only."""
    if not _PROM_AVAILABLE:
        return

    @app.get("/metrics", include_in_schema=False)
    async def metrics(request: Request):
        # Only INTERNAL scrapers may read metrics. Every request that reached
        # this app through the public edge carries an X-Forwarded-* header
        # (nginx/Cloudflare add it); a Prometheus scraper hitting the container
        # directly on the internal network / loopback does not. Deny the
        # forwarded ones so the full route inventory + traffic stats aren't
        # exposed publicly on api.powertradefx.com/metrics. (The gateway binds
        # 127.0.0.1 in prod, so non-forwarded requests are internal-only.)
        if request.headers.get("x-forwarded-for") or request.headers.get("x-forwarded-host"):
            return Response(status_code=404)
        return Response(content=generate_latest(), media_type=CONTENT_TYPE_LATEST)


# ---------------------------------------------------------------------------
# 5. Structured Request Logging Middleware
# ---------------------------------------------------------------------------
_SECURITY_HEADERS = (
    # The nginx blocks for the trader/admin hosts already set these, but the
    # api host JSON responses were missing HSTS / Referrer-Policy /
    # Permissions-Policy — set them at the app so they hold regardless of the
    # (host-managed) proxy config. X-Frame-Options / X-Content-Type-Options are
    # already set by nginx everywhere.
    (b"strict-transport-security", b"max-age=15552000; includeSubDomains"),
    (b"referrer-policy", b"no-referrer"),
    (b"permissions-policy", b"camera=(), microphone=(), geolocation=(), payment=()"),
)


class ObservabilityMiddleware:
    """Security headers + Prometheus metrics + request log in ONE pure ASGI layer.

    These used to be three BaseHTTPMiddleware classes. Each of those runs the
    rest of the app in a separate task and re-streams the response, which cost
    real CPU on every request in the 2026-09-30 load test. The metric endpoint
    label is the ROUTE TEMPLATE (/api/v1/positions/{position_id}), not the raw
    path: raw paths with ids created a new time series per id, growing memory
    without bound.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http":
            await self.app(scope, receive, send)
            return
        start = time.perf_counter()
        status = [500]

        async def wrapped_send(message):
            if message["type"] == "http.response.start":
                status[0] = message["status"]
                headers = list(message.get("headers") or [])
                present = {k.lower() for k, _ in headers}
                for k, v in _SECURITY_HEADERS:
                    if k not in present:
                        headers.append((k, v))
                message = {**message, "headers": headers}
            await send(message)

        try:
            await self.app(scope, receive, wrapped_send)
        finally:
            duration = time.perf_counter() - start
            path = scope.get("path", "")
            route = scope.get("route")
            endpoint = getattr(route, "path", None) or "unmatched"
            method = scope.get("method", "")
            if _PROM_AVAILABLE:
                REQUEST_COUNT.labels(method=method, endpoint=endpoint, status=status[0]).inc()
                REQUEST_LATENCY.labels(method=method, endpoint=endpoint).observe(duration)
            if not path.startswith(("/health", "/metrics")):
                logger.info("%s %s %d %.1fms", method, path, status[0], duration * 1000)


# ---------------------------------------------------------------------------
# Convenience: add the full middleware stack at once
# ---------------------------------------------------------------------------
def add_middleware_stack(app, *, include_rate_limit: bool = False):
    """Add all production middleware to a FastAPI app.

    Call AFTER app creation, BEFORE including routers.
    Middleware is applied in reverse order (last added runs first).

    NOTE: rate limiting is DISABLED by default — the global SlowAPI limiter
    caused 429s on legitimate authenticated traffic (shared NAT IPs, CDN
    fan-out). Pass include_rate_limit=True to re-enable; individual endpoints
    still have per-bucket rate_limit_http() guards where needed.
    """
    app.add_middleware(ObservabilityMiddleware)
    app.add_middleware(RequestSizeLimitMiddleware)
    add_metrics_endpoint(app)
    if include_rate_limit:
        add_rate_limit_handler(app)
