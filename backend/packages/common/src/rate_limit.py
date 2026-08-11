"""Shared rate-limiting helpers.

Lifted out of ``services/gateway/src/services/auth_service.py`` so the
admin API can throttle its own login / sensitive endpoints with the same
sliding-window + Redis cross-process semantics. Anything that needs an
HTTP-bound rate limit should depend on this module instead of redefining
its own bucket.

Local in-memory buckets are per-process; the Redis pipeline is best-
effort cross-process sync (multi-worker / multi-pod deployments rely on
it for cluster-wide counting). A Redis blip never makes the request
slower than the local check.
"""
from __future__ import annotations

import asyncio
import ipaddress
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
    """Return a value PostgreSQL INET accepts, or None."""
    ff = request.headers.get("x-forwarded-for") or request.headers.get("X-Forwarded-For")
    if ff:
        for part in ff.split(","):
            got = _parse_one_ip(part)
            if got:
                return got
    host = request.client.host if request.client else None
    return _parse_one_ip(str(host)) if host else None


# ─── Sliding-window rate limit ───────────────────────────────────────────

_LOCAL_RATE_BUCKETS: dict[str, list[float]] = {}


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
            detail=f"Too many requests — retry after {retry_after}s.",
            headers={"Retry-After": str(retry_after)},
        )
    arr.append(now)

    # Best-effort Redis cross-process sync — fire-and-forget so a Redis
    # blip never makes the request slower than it already is.
    try:
        from packages.common.src.redis_client import redis_client

        async def _sync() -> None:
            try:
                pipe = redis_client.pipeline()
                pipe.zremrangebyscore(key, 0, floor)
                pipe.zadd(key, {f"{now}:{ip}": now})
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

        try:
            asyncio.create_task(_sync())
        except RuntimeError:
            pass
    except Exception:
        pass
