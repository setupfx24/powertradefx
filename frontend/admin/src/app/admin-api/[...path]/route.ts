import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Same-origin reverse proxy: /admin-api/*  →  <admin-api>/api/v1/admin/*
 *
 * Security responsibilities of this file:
 *   1. CSRF defence for the cookie-authenticated admin session (Sec-Fetch-Site,
 *      then Origin, then Referer — scheme-aware, against an explicit allowlist
 *      plus the request's own nginx-vouched origin).
 *   2. A hard trust boundary between the browser and the internal service:
 *      request/response headers are allow-listed, only the admin session cookie
 *      crosses, the upstream path cannot escape the /api/v1/admin prefix, and
 *      upstream redirects are never followed.
 *   3. Correct forwarding metadata (X-Forwarded-Proto/Host/For, X-Request-Id)
 *      so the backend can set `Secure` cookies, enforce white-label admin-host
 *      isolation (admin.<broker-domain>) and write truthful audit logs.
 *
 * Configuration (environment):
 *   ADMIN_API_PROXY_TARGET        http://admin-api:8001   (origin only; any path is ignored)
 *   ADMIN_ALLOWED_ORIGINS         https://admin.powertradefx.com[,https://other]
 *                                 Required in production. Tenant admin hosts
 *                                 (admin.<broker-domain>) need no entry: a request
 *                                 whose Origin equals its own nginx-set Host is
 *                                 same-origin by construction and is accepted.
 *   ADMIN_TRUST_FORWARDED_HOST=1  also derive "self" from X-Forwarded-Host (only if your
 *                                 proxy SETS that header; nginx here — platform and
 *                                 tenant blocks alike — sets Host instead)
 *   ADMIN_COOKIE_NAME             default fx_admin (backend dependencies.ADMIN_COOKIE_NAME)
 *   ADMIN_API_PROXY_TIMEOUT_MS    default 120000
 */

const UPSTREAM_PREFIX = '/api/v1/admin';
const PUBLIC_PREFIX = '/admin-api';
const ADMIN_COOKIE = process.env.ADMIN_COOKIE_NAME || 'fx_admin';
const TRUST_FORWARDED_HOST = process.env.ADMIN_TRUST_FORWARDED_HOST === '1';
const UPSTREAM_TIMEOUT_MS = clampInt(process.env.ADMIN_API_PROXY_TIMEOUT_MS, 120_000, 1_000, 600_000);

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const BODYLESS_METHODS = new Set(['GET', 'HEAD']);

/** Browser → upstream. Everything else (Origin, Referer, Host, hop-by-hop, other cookies) is dropped. */
const REQUEST_HEADER_ALLOWLIST = [
  'authorization',
  'content-type',
  'accept',
  'accept-language',
  'user-agent',
  'if-none-match',
  'if-modified-since',
] as const;

/** Upstream → browser. content-length / content-encoding are deliberately absent: fetch
 *  transparently decompresses, so the original values would be wrong. */
const RESPONSE_HEADER_ALLOWLIST = [
  'content-type',
  'content-disposition',
  'retry-after',
  'etag',
  'last-modified',
  'x-request-id',
] as const;

class ProxyConfigError extends Error {}

function clampInt(raw: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number.parseInt(raw ?? '', 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// ── Upstream target ────────────────────────────────────────────────────────

let cachedUpstream: URL | undefined;

function upstreamOrigin(): URL {
  if (cachedUpstream) return cachedUpstream;
  const raw =
    process.env.ADMIN_API_PROXY_TARGET ||
    process.env.ADMIN_API_INTERNAL_URL ||
    'http://127.0.0.1:8001';
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ProxyConfigError('ADMIN_API_PROXY_TARGET is not a valid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ProxyConfigError('ADMIN_API_PROXY_TARGET must be http(s)');
  }
  cachedUpstream = new URL(url.origin);
  return cachedUpstream;
}

/**
 * Re-encode every path segment and refuse anything that could change the
 * upstream route structure. Next hands us DECODED segments, so a raw
 * `%2e%2e` or `%2f` would otherwise be re-serialised as `..` / `/` and let
 * a caller step outside /api/v1/admin (e.g. to /docs or /health).
 */
function encodePath(segments: string[]): string | null {
  const out: string[] = [];
  for (const s of segments) {
    if (!s || s === '.' || s === '..') return null;
    // eslint-disable-next-line no-control-regex
    if (/[\\/\u0000-\u001f\u007f]/.test(s)) return null;
    out.push(encodeURIComponent(s));
  }
  return out.join('/');
}

// ── Request provenance ─────────────────────────────────────────────────────

function firstValue(header: string | null): string | null {
  if (!header) return null;
  const v = header.split(',')[0]?.trim();
  return v ? v : null;
}

/** Scheme the browser used, as vouched by nginx (X-Forwarded-Proto) or seen by Next. */
function requestProto(req: NextRequest): string {
  return (
    firstValue(req.headers.get('x-forwarded-proto'))?.toLowerCase() ||
    req.nextUrl.protocol.replace(/:$/, '')
  );
}

/**
 * The host the browser actually addressed. nginx sets `Host $host` on the
 * platform block AND on every provisioned tenant block, so Host is
 * trustworthy here. X-Forwarded-Host is only honoured when explicitly
 * enabled: by default it is whatever the client chose to send, and the
 * backend uses this value to decide which broker may sign in on which
 * admin host — it must not be spoofable.
 */
function requestHost(req: NextRequest): string | null {
  if (TRUST_FORWARDED_HOST) {
    const fwd = firstValue(req.headers.get('x-forwarded-host'));
    if (fwd) return fwd;
  }
  return firstValue(req.headers.get('host')) || req.nextUrl.host || null;
}

// ── CSRF ───────────────────────────────────────────────────────────────────

/** Lower-cased `scheme://host[:port]` with default ports removed; null if unparseable/non-http. */
function normalizeOrigin(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.origin.toLowerCase();
  } catch {
    return null; // includes the literal "null" origin (sandboxed iframe / redirect chain)
  }
}

/**
 * The set of origins that are "us": the explicit allowlist plus the origin
 * this very request was addressed to. The latter is what lets white-label
 * tenant admin hosts (admin.<broker-domain>, provisioned at runtime) work
 * without a redeploy: a cross-site attacker's browser always sends an
 * Origin that differs from the Host it connected to, so Origin == Host is
 * same-origin by construction. Host and X-Forwarded-Proto are set by nginx.
 */
function allowedOrigins(req: NextRequest): Set<string> {
  const allowed = new Set<string>();
  const add = (candidate: string | null | undefined) => {
    const n = normalizeOrigin(candidate);
    if (n) allowed.add(n);
  };

  for (const o of (process.env.ADMIN_ALLOWED_ORIGINS ?? '').split(',')) add(o);

  const host = requestHost(req);
  if (host) add(`${requestProto(req)}://${host}`);
  return allowed;
}

/** Returns a short reason when the mutation must be refused, otherwise null. */
function csrfRejection(req: NextRequest): string | null {
  if (!UNSAFE_METHODS.has(req.method)) return null;

  // Strongest signal first: browsers set it and scripts cannot override it
  // (`Sec-` is a forbidden header prefix). `same-site` is exactly the
  // trade.powertradefx.com → admin.powertradefx.com (or brand.com →
  // admin.brand.com) case that SameSite=strict does not cover.
  const fetchSite = req.headers.get('sec-fetch-site')?.trim().toLowerCase();
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    return `sec-fetch-site=${fetchSite}`;
  }
  // The page that made this request was served from this very host; there
  // is nothing cross-site to forge. Also the one signal that does not
  // depend on the allowlist, which matters for tenant admin hosts.
  if (fetchSite === 'same-origin') return null;

  const allowed = allowedOrigins(req);
  const origin = req.headers.get('origin');
  if (origin) {
    const n = normalizeOrigin(origin);
    return n && allowed.has(n) ? null : 'origin not allowed';
  }

  // No Origin: older browsers may still send Referer on a form post.
  const referer = normalizeOrigin(req.headers.get('referer'));
  if (referer && !allowed.has(referer)) return 'referer not allowed';

  // No browser provenance at all → non-browser client. It has no ambient
  // cookie riding a forged cross-site request, so there is nothing to forge.
  return null;
}

// ── Header translation ─────────────────────────────────────────────────────

/** Only the admin session cookie is allowed to reach the internal service. */
function adminCookieOnly(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const kept = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .filter((c) => c.startsWith(`${ADMIN_COOKIE}=`));
  return kept.length ? kept.join('; ') : null;
}

function upstreamHeaders(req: NextRequest, requestId: string, hasBody: boolean): Headers {
  const h = new Headers();
  for (const name of REQUEST_HEADER_ALLOWLIST) {
    const v = req.headers.get(name);
    if (v) h.set(name, v);
  }
  if (hasBody) {
    const len = req.headers.get('content-length');
    if (len && /^\d+$/.test(len)) h.set('content-length', len);
  }

  const cookie = adminCookieOnly(req.headers.get('cookie'));
  if (cookie) h.set('cookie', cookie);

  // nginx appends the verified client IP as the RIGHTMOST X-Forwarded-For
  // entry; the backend reads from the right, so pass the chain through intact.
  const xff = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  if (xff) h.set('x-forwarded-for', xff);
  const realIp = req.headers.get('x-real-ip');
  if (realIp) h.set('x-real-ip', realIp);

  // Without X-Forwarded-Proto the backend sees a plain-http hop and issues the
  // session cookie WITHOUT the Secure attribute.
  h.set('x-forwarded-proto', requestProto(req));

  // The ORIGINAL browser host, so admin-api can enforce white-label host
  // isolation (brokers sign in on admin.<their-domain>, and only their
  // accounts are accepted there; a broker with a live domain is refused on
  // the platform host). Derived from the nginx-set Host, never from a
  // client-supplied X-Forwarded-Host (see requestHost).
  const host = requestHost(req);
  if (host) h.set('x-forwarded-host', host);

  h.set('x-request-id', requestId);
  return h;
}

/** Rewrite an upstream Location so the browser stays on /admin-api; drop anything else. */
function rewriteLocation(location: string | null): string | null {
  if (!location) return null;
  try {
    const u = new URL(location, upstreamOrigin());
    if (u.origin !== upstreamOrigin().origin) return null;
    if (u.pathname !== UPSTREAM_PREFIX && !u.pathname.startsWith(`${UPSTREAM_PREFIX}/`)) return null;
    return `${PUBLIC_PREFIX}${u.pathname.slice(UPSTREAM_PREFIX.length)}${u.search}`;
  } catch {
    return null;
  }
}

function downstreamHeaders(res: Response, requestId: string): Headers {
  const h = new Headers();
  for (const name of RESPONSE_HEADER_ALLOWLIST) {
    const v = res.headers.get(name);
    if (v) h.set(name, v);
  }
  const location = rewriteLocation(res.headers.get('location'));
  if (location) h.set('location', location);

  // Admin responses are per-session and sensitive; never let any cache hold them.
  h.set('cache-control', 'no-store');
  h.set('x-content-type-options', 'nosniff');
  if (!h.has('x-request-id')) h.set('x-request-id', requestId);

  // Relay every Set-Cookie: /auth/login issues the HttpOnly session cookie and
  // /auth/logout clears it. getSetCookie() is the only API that keeps multiple
  // cookies separate (Node 20+ / Next 15+).
  const cookies = (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.();
  if (cookies?.length) {
    for (const c of cookies) h.append('set-cookie', c);
  } else {
    const single = res.headers.get('set-cookie');
    if (single) h.set('set-cookie', single);
  }
  return h;
}

// ── Handler ────────────────────────────────────────────────────────────────

function jsonError(status: number, detail: string, requestId: string): NextResponse {
  return NextResponse.json(
    { detail },
    { status, headers: { 'cache-control': 'no-store', 'x-request-id': requestId } },
  );
}

async function proxy(req: NextRequest, segments: string[], requestId: string): Promise<NextResponse> {
  const reason = csrfRejection(req);
  if (reason) {
    console.warn('[admin-api proxy] csrf reject', { requestId, method: req.method, reason });
    return jsonError(403, 'Cross-origin request blocked', requestId);
  }

  const encodedPath = encodePath(segments);
  if (encodedPath === null) return jsonError(400, 'Invalid path', requestId);

  const target = new URL(
    `${UPSTREAM_PREFIX}${encodedPath ? `/${encodedPath}` : ''}${req.nextUrl.search}`,
    upstreamOrigin(),
  );

  const hasBody = !BODYLESS_METHODS.has(req.method) && req.body !== null;
  const init: RequestInit & { duplex?: 'half' } = {
    method: req.method,
    headers: upstreamHeaders(req, requestId, hasBody),
    redirect: 'manual', // never chase an upstream redirect from inside the private network
    cache: 'no-store',
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  };
  if (hasBody) {
    init.body = req.body; // streamed, not buffered
    init.duplex = 'half';
  }

  let res: Response;
  try {
    res = await fetch(target, init);
  } catch (e) {
    const err = e as { name?: string; message?: string };
    const timedOut = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    console.error('[admin-api proxy] upstream failure', {
      requestId,
      method: req.method,
      path: target.pathname,
      error: err?.message ?? String(e),
    });
    return timedOut
      ? jsonError(504, 'Admin API timed out', requestId)
      : jsonError(502, 'Admin API unavailable', requestId);
  }

  const noBody = req.method === 'HEAD' || res.status === 204 || res.status === 304;
  return new NextResponse(noBody ? null : res.body, {
    status: res.status,
    headers: downstreamHeaders(res, requestId),
  });
}

type RouteCtx = { params: Promise<{ path?: string[] }> };

async function handle(req: NextRequest, ctx: RouteCtx): Promise<NextResponse> {
  const requestId = req.headers.get('x-request-id')?.slice(0, 128) || randomUUID();
  try {
    const { path } = await ctx.params;
    return await proxy(req, path ?? [], requestId);
  } catch (e) {
    if (e instanceof ProxyConfigError) {
      console.error('[admin-api proxy] misconfigured', { requestId, error: e.message });
      return jsonError(500, 'Admin API proxy is misconfigured', requestId);
    }
    console.error('[admin-api proxy] unhandled', { requestId, error: e });
    return jsonError(500, 'Admin API proxy error', requestId);
  }
}

export const GET = handle;
export const HEAD = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
