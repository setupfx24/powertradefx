import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Proxies /admin-api/* → admin-api service at /api/v1/admin/*.
 * Set ADMIN_API_PROXY_TARGET (e.g. http://admin-api:8001 in Docker, http://127.0.0.1:8001 locally).
 */
function adminApiOrigin(): string {
  const raw =
    process.env.ADMIN_API_PROXY_TARGET ||
    process.env.ADMIN_API_INTERNAL_URL ||
    'http://127.0.0.1:8001';
  return String(raw).replace(/\/$/, '');
}

async function segmentsFromParams(params: Promise<{ path?: string[] }>): Promise<string[]> {
  const p = await params;
  return p.path ?? [];
}

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * CSRF guard. The fx_admin cookie is SameSite=strict, which blocks
 * cross-SITE requests but not cross-ORIGIN same-site ones — a script on
 * trade.powertradefx.com (same registrable domain) could form-POST here
 * with the cookie attached. Browsers send Origin on every POST, so any
 * mutation whose Origin isn't this host is forged. Absent Origin =
 * non-browser client (no ambient-cookie CSRF vector) — allowed.
 */
function isCrossOriginMutation(req: NextRequest): boolean {
  if (!UNSAFE_METHODS.has(req.method.toUpperCase())) return false;
  const origin = req.headers.get('origin');
  if (!origin) return false;

  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return true; // unparseable Origin — not something a real browser sends
  }

  // Which host is "us"? NOT req.nextUrl.host — behind nginx that resolves to
  // the container's internal bind address (localhost:3001), so every genuine
  // same-origin login was rejected with 403. nginx forwards the real public
  // host as `Host` (proxy_set_header Host $host), so that is authoritative;
  // x-forwarded-host covers proxies that rewrite Host instead.
  const selfHosts = new Set<string>();
  const add = (raw?: string | null) => {
    if (!raw) return;
    for (const part of raw.split(',')) {
      // Strip the default ports so :443 never mismatches a bare hostname.
      const h = part.trim().toLowerCase().replace(/:(?:80|443)$/, '');
      if (h) selfHosts.add(h);
    }
  };
  add(req.headers.get('x-forwarded-host'));
  add(req.headers.get('host'));
  add(req.nextUrl.host);
  add(process.env.ADMIN_PUBLIC_HOST); // explicit override if ever needed

  return !selfHosts.has(originHost.replace(/:(?:80|443)$/, ''));
}

async function proxy(req: NextRequest, segments: string[]): Promise<NextResponse> {
  if (isCrossOriginMutation(req)) {
    return NextResponse.json({ detail: 'Cross-origin request blocked' }, { status: 403 });
  }

  const sub = segments.length ? segments.join('/') : '';
  const path = sub ? `api/v1/admin/${sub}` : 'api/v1/admin';
  const targetUrl = `${adminApiOrigin()}/${path}${req.nextUrl.search}`;

  const headers = new Headers();
  const auth = req.headers.get('authorization');
  if (auth) headers.set('authorization', auth);
  const ct = req.headers.get('content-type');
  if (ct) headers.set('content-type', ct);
  // Forward the browser's cookies so admin-api can read fx_admin (the
  // HttpOnly session cookie set by /auth/login). Without this the proxy
  // strips the cookie and every authenticated request fails with 401.
  const cookie = req.headers.get('cookie');
  if (cookie) headers.set('cookie', cookie);
  // Preserve client IP in the audit logs.
  const fwdFor = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
  if (fwdFor) headers.set('x-forwarded-for', fwdFor);

  const method = req.method.toUpperCase();
  const hasBody = !['GET', 'HEAD'].includes(method);
  let body: ArrayBuffer | undefined;
  if (hasBody) {
    try {
      body = await req.arrayBuffer();
    } catch {
      body = undefined;
    }
  }

  const ctrl =
    typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal
      ? AbortSignal.timeout(120_000)
      : undefined;

  let res: Response;
  try {
    res = await fetch(targetUrl, {
      method,
      headers,
      body: body && body.byteLength > 0 ? body : undefined,
      signal: ctrl,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'fetch failed';
    console.error('[admin-api proxy]', targetUrl, msg);
    return NextResponse.json(
      {
        detail:
          'Cannot reach admin API. Ensure admin-api is running and ADMIN_API_PROXY_TARGET is correct. ' +
          `Target: ${adminApiOrigin()}`,
      },
      { status: 502 },
    );
  }

  let buf: ArrayBuffer;
  try {
    buf = await res.arrayBuffer();
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'read failed';
    console.error('[admin-api proxy] response body', targetUrl, msg);
    return NextResponse.json({ detail: 'Failed to read admin API response' }, { status: 502 });
  }

  const out = new Headers();
  const ctOut = res.headers.get('content-type');
  if (ctOut) out.set('content-type', ctOut);
  // Relay every Set-Cookie back to the browser. Critical for admin auth:
  // /auth/login sets the fx_admin HttpOnly session cookie here, and
  // /auth/logout deletes it. Without this passthrough the cookie never
  // reaches the browser and login appears to work for one request before
  // failing forever.
  // Headers.getSetCookie() returns the array of values (Node 20+, Next 15+).
  const cookies = (res.headers as unknown as { getSetCookie?: () => string[] })
    .getSetCookie?.();
  if (cookies && cookies.length) {
    for (const c of cookies) out.append('set-cookie', c);
  } else {
    const single = res.headers.get('set-cookie');
    if (single) out.set('set-cookie', single);
  }

  return new NextResponse(buf, {
    status: res.status,
    statusText: res.statusText,
    headers: out,
  });
}

type RouteCtx = { params: Promise<{ path?: string[] }> };

async function safeProxy(req: NextRequest, ctx: RouteCtx): Promise<NextResponse> {
  try {
    const segments = await segmentsFromParams(ctx.params);
    return await proxy(req, segments);
  } catch (e) {
    console.error('[admin-api proxy] unhandled', e);
    return NextResponse.json({ detail: 'Admin API proxy error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest, ctx: RouteCtx) {
  return safeProxy(req, ctx);
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
  return safeProxy(req, ctx);
}

export async function PUT(req: NextRequest, ctx: RouteCtx) {
  return safeProxy(req, ctx);
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  return safeProxy(req, ctx);
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  return safeProxy(req, ctx);
}
