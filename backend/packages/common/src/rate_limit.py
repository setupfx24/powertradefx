"""Shared rate-limiting helpers.

Lifted out of ``services/gateway/src/services/auth_service.py`` so the
admin API can throttle its own login / sensitive endpoints with the same
sliding-window + Redis cross-process semantics. Anything that needs an
HTTP-bound rate limit should depend on this module instead of redefining
its own bucket.

Two public entry points share one sliding-window implementation:

* ``rate_limit_http``  - keyed on (bucket, client IP). Slows down a single
  source hammering an endpoint (credential stuffing from one box).
* ``rate_limit_key``   - keyed on whatever the caller supplies (e.g. a
  hashed account email). IP-independent, so a distributed attacker
  rotating through proxies still hits the same wall for one victim
  account (per-account lockout).

Local in-memory buckets are per-process; the Redis pipeline is best-
effort cross-process sync (multi-worker / multi-pod deployments rely on
it for cluster-wide counting). A Redis blip never makes the request
slower than the local check.
"""
from __future__ import annotations

import asyncio
import ipaddress
import math
from time import monotonic

from fastapi import HTTPException, Request


# ─── IP helpers ──────────────────────────────────────────────────────────

def _parse_one_ip(raw: str) -> str | None:
    h = raw.strip()
    if not h:
        return None
    if "," in h:
        h = h.split(",")[0].strip()
    if h.startswith("[") and "]" in h:
        h = h[1 : h.index("]")]
    if "%" in h:
        h = h.split("%", 1)[0]
    try:
        ipaddress.ip_address(h)
        return h
    except ValueError:
        return None


def client_ip_for_inet(request: Request) -> str | None:
    """Return a value PostgreSQL INET accepts, or None.

    Trust model: our nginx sets `X-Forwarded-For $proxy_add_x_forwarded_for`,
    i.e. it APPENDS its own $remote_addr (the real client, after the
    Cloudflare real_ip rewrite) to whatever the client/CDN already sent.
    The RIGHTMOST entry is therefore the only one our infrastructure
    vouches for; everything left of it is attacker-controllable input.
    Taking the first entry (the old behaviour) let anyone evade per-IP
    rate limits and poison ip_logs with a spoofed header.
    """
    ff = request.headers.get("x-forwarded-for") or request.headers.get("X-Forwarded-For")
    if ff:
        for part in reversed(ff.split(",")):
            got = _parse_one_ip(part)
            if got:
                return got
    host = request.client.host if request.client else None
    return _parse_one_ip(str(host)) if host else None


# ─── Sliding-window rate limit ───────────────────────────────────────────

_LOCAL_RATE_BUCKETS: dict[str, list[float]] = {}

_DEFAULT_DETAIL = "Too many requests — retry after {seconds}s."


def _format_detail(detail: str | None, retry_after: int) -> str:
    """Render the 429 body. ``detail`` may carry ``{seconds}`` and/or
    ``{minutes}`` placeholders; a template that fails to format (stray
    braces in a caller-supplied literal) is returned verbatim."""
    template = detail or _DEFAULT_DETAIL
    try:
        return template.format(
            seconds=retry_after,
            minutes=max(1, math.ceil(retry_after / 60)),
        )
    except (KeyError, IndexError, ValueError):
        return template


def _sliding_window(
    key: str,
    member_tag: str,
    max_requests: int,
    window_sec: float,
    *,
    detail: str | None = None,
    record: bool = True,
) -> None:
    """Core sliding-window check shared by every public helper.

    1. Trim the local bucket for ``key`` to the window and raise 429
       (with ``Retry-After``) if it already holds ``max_requests`` hits.
    2. When ``record`` is True, append this hit locally and push it to
       Redis (fire-and-forget). Redis is the cross-process source of
       truth: if it reports the cluster-wide count is over the cap, the
       local bucket is saturated so subsequent hits on this pod fail
       fast without another round-trip.

    ``record=False`` is a pure peek: "would this caller be allowed?"
    without consuming a slot. Login flows use it to refuse a locked
    account BEFORE doing any password work, and then only record a hit
    when the attempt actually failed.
    """
    now = monotonic()
    floor = now - window_sec

    # Local fallback path. Trim, count, decide. Cheap.
    arr = _LOCAL_RATE_BUCKETS.setdefault(key, [])
    while arr and arr[0] < floor:
        arr.pop(0)
    if len(arr) >= max_requests:
        retry_after = max(1, int(arr[0] + window_sec - now))
        raise HTTPException(
            status_code=429,
            detail=_format_detail(detail, retry_after),
            headers={"Retry-After": str(retry_after)},
        )
    if not record:
        return
    arr.append(now)

    # Best-effort Redis cross-process sync — fire-and-forget so a Redis
    # blip never makes the request slower than it already is.
    async def _sync() -> None:
        try:
            from packages.common.src.redis_client import redis_client

            pipe = redis_client.pipeline()
            pipe.zremrangebyscore(key, 0, floor)
            pipe.zadd(key, {f"{now}:{member_tag}": now})
            pipe.zcard(key)
            pipe.expire(key, int(window_sec) + 5)
            _, _, count, _ = await pipe.execute()
            if count > max_requests:
                # Cross-process counter saw too many — bump the local
                # bucket so the next request from this pod also fails
                # without re-querying Redis.
                _LOCAL_RATE_BUCKETS[key] = [now] * max_requests
        except Exception:
            pass

    _fire_and_forget(_sync)


def _fire_and_forget(coro_factory) -> None:
    """Schedule ``coro_factory()`` on the running loop, or do nothing when
    called outside one (sync unit tests). The coroutine is only created
    once we know a loop exists, so nothing is left un-awaited."""
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        return
    try:
        loop.create_task(coro_factory())
    except Exception:
        pass


def rate_limit_http(
    request: Request,
    bucket: str,
    max_requests: int,
    window_sec: float,
) -> None:
    """Sliding-window rate limit, scoped to (bucket, client IP).

    Raises ``HTTPException(429)`` when the cap is exceeded. Whitelisting
    is by IP; if ``client_ip_for_inet`` returns None (e.g. unit test
    request with no client) the bucket is keyed on the bucket name alone.
    """
    ip = client_ip_for_inet(request) or "anon"
    key = f"rl:{bucket}:{ip}"
    _sliding_window(key, ip, max_requests, window_sec)


def rate_limit_key(
    key: str,
    max_requests: int,
    window_sec: float,
    *,
    detail: str | None = None,
    record: bool = True,
) -> None:
    """Sliding-window rate limit keyed purely on ``key`` — no IP involved.

    Use this for per-account throttles where the attacker may spread
    attempts across many source addresses. ``detail`` overrides the 429
    message and may include ``{seconds}`` / ``{minutes}`` placeholders
    for the retry delay. ``record=False`` only checks the bucket without
    consuming a slot (see ``_sliding_window``).

    Callers should namespace ``key`` themselves (``rl:<bucket>:...``) and
    keep raw PII out of it — hash an email before using it as a key so it
    never lands in Redis or logs verbatim.
    """
    _sliding_window(key, "k", max_requests, window_sec, detail=detail, record=record)


def rate_limit_reset(key: str) -> None:
    """Forget every hit recorded for ``key`` (local + best-effort Redis).

    Called after a successful login so an honest user who fat-fingered
    their password a few times starts the next session with a clean
    slate instead of carrying failures towards the lockout threshold.
    """
    _LOCAL_RATE_BUCKETS.pop(key, None)

    async def _clear() -> None:
        try:
            from packages.common.src.redis_client import redis_client

            await redis_client.delete(key)
        except Exception:
            pass

    _fire_and_forget(_clear)
