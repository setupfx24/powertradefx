import { NextRequest, NextResponse } from 'next/server';

/**
 * Shared proxy handler for /api/v1/* and /api/algo/* (and any future
 * gateway-fronted route). Centralizes:
 *  - gatewayOrigin() resolution (env priority: TRADER_API_PROXY_TARGET >
 *    GATEWAY_URL > INTERNAL_API_URL > NEXT_PUBLIC_GATEWAY_ORIGIN > localhost)
 *  - Header forwarding (auth, CORS preflight, client metadata)
 *  - Multipart re-encoding (opt-in via handleMultipart) for FastAPI's
 *    binary upload routes (KYC docs, deposit receipts)
 *  - Manual redirect following with ORIGIN VALIDATION — rejects redirects
 *    to off-gateway hosts to prevent credential leak if a compromised or
 *    misconfigured gateway returns a hostile Location header
 *  - Response CORS sanitization — drops Allow-Credentials when
 *    Allow-Origin is wildcard (per spec these can't coexist, but some
 *    historical browsers were permissive)
 *  - Set-Cookie passthrough (handles both single + multi-cookie via
 *    getSetCookie when available)
 */

type ProxyOptions = {
  /** URL prefix prepended to forwarded path — e.g. 'api/v1' or 'api/algo'. */
  pathPrefix: string;
  /** Extra request headers to forward beyond the defaults. */
  extraRequestHeaders?: readonly string[];
  /** True = re-encode multipart/form-data through formData() so FastAPI's File() accepts it. */
  handleMultipart?: boolean;
  /** Tag prepended to all console.error lines for log filtering. */
  logTag: string;
};

const DEFAULT_REQUEST_HEADERS = [
  'authorization',
  'cookie',
  'user-agent',
  'x-forwarded-for',
  'x-real-ip',
  'origin',
  'access-control-request-method',
  'access-control-request-headers',
] as const;

const RESPONSE_CORS_HEADERS = [
  'access-control-allow-origin',
  'access-control-allow-credentials',
  'access-control-allow-methods',
  'access-control-allow-headers',
  'access-control-expose-headers',
  'access-control-max-age',
  'vary',
] as const;

/** Resolve the upstream gateway origin from env. */
export function gatewayOrigin(): string {
  const explicit =
    process.env.TRADER_API_PROXY_TARGET?.trim() ||
    process.env.GATEWAY_URL?.trim();
  if (explicit) return String(explicit).replace(/\/$/, '');

  const internal = process.env.INTERNAL_API_URL?.trim();
  if (internal) {
    const base = internal.replace(/\/api\/v1\/?$/i, '').replace(/\/$/, '');
    if (base) {
      try {
        const u = new URL(base);
        const path = u.pathname.replace(/\/$/, '');
        return path ? `${u.origin}${path}` : u.origin;
      } catch {
        return base;
      }
    }
  }

  const fallback = process.env.NEXT_PUBLIC_GATEWAY_ORIGIN?.trim();
  if (fallback) return String(fallback).replace(/\/$/, '');

  return 'http://127.0.0.1:8000';
}

/**
 * Validate that a redirect URL stays under the trusted gateway origin.
 * Returns the absolute URL string if safe, null if cross-origin.
 * Without this guard a hostile Location header could exfiltrate the
 * forwarded auth cookie + Bearer token to an attacker-controlled host.
 */
function validateRedirectTarget(location: string, baseUrl: string): string | null {
  let target: URL;
  try {
    target = new URL(location, baseUrl);
  } catch {
    return null;
  }
  let allowed: URL;
  try {
    allowed = new URL(gatewayOrigin());
  } catch {
    return null;
  }
  if (target.origin !== allowed.origin) return null;
  return target.toString();
}

/** Forward CORS response headers, but strip Allow-Credentials when Allow-Origin is '*'. */
function sanitizeCorsHeaders(out: Headers, src: Response) {
  let allowOrigin: string | null = null;
  for (const h of RESPONSE_CORS_HEADERS) {
    const v = src.headers.get(h);
    if (v) out.set(h, v);
    if (h === 'access-control-allow-origin') allowOrigin = v;
  }
  if (allowOrigin === '*') out.delete('access-control-allow-credentials');
}

export function createProxyHandler(opts: ProxyOptions) {
  const { pathPrefix, extraRequestHeaders = [], handleMultipart = false, logTag } = opts;

  async function proxy(req: NextRequest, segments: string[]): Promise<NextResponse> {
    const subRaw = segments.length ? segments.join('/') : '';
    /* FastAPI routes register without trailing slash; a trailing slash here causes 307s that break multipart POST replay. */
    const sub = subRaw.replace(/\/+$/, '');
    const path = sub ? `${pathPrefix}/${sub}` : pathPrefix;
    const targetUrl = `${gatewayOrigin()}/${path}${req.nextUrl.search}`.replace(/([^:])\/\//g, '$1/');

    // ── Build outbound headers ────────────────────────────────────
    const headers = new Headers();
    const forwardSet = new Set<string>([...DEFAULT_REQUEST_HEADERS, ...extraRequestHeaders]);
    for (const h of forwardSet) {
      const v = req.headers.get(h);
      if (v) headers.set(h, v);
    }
    const incomingCt = req.headers.get('content-type');

    // ── Build outbound body ───────────────────────────────────────
    const method = req.method.toUpperCase();
    const hasBody = !['GET', 'HEAD'].includes(method);
    let body: BodyInit | undefined;
    if (hasBody) {
      const isMultipart = incomingCt?.toLowerCase().includes('multipart/form-data');
      if (isMultipart && handleMultipart) {
        try {
          const incoming = await req.formData();
          const outgoing = new FormData();
          for (const [key, value] of incoming.entries()) {
            if (value instanceof File) {
              outgoing.append(key, value, value.name || 'upload');
            } else {
              outgoing.append(key, value as string);
            }
          }
          body = outgoing;
          /* Don't set content-type — fetch sets it with the multipart boundary. */
        } catch (e) {
          console.error(`[${logTag}] multipart formData`, e);
          return NextResponse.json(
            { detail: 'Could not read file upload. Try a smaller image (JPG/PNG) under 10 MB.' },
            { status: 400 },
          );
        }
      } else {
        if (incomingCt) headers.set('content-type', incomingCt);
        try {
          const buf = await req.arrayBuffer();
          if (buf.byteLength > 0) body = Buffer.from(buf);
        } catch {
          body = undefined;
        }
      }
    }

    // ── First fetch ───────────────────────────────────────────────
    let res: Response;
    try {
      res = await fetch(targetUrl, { method, headers, body, redirect: 'manual' });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'fetch failed';
      console.error(`[${logTag}]`, targetUrl, msg);
      return NextResponse.json(
        {
          detail:
            `Cannot reach API gateway. Run: docker compose up -d (or start gateway on port 8000). ` +
            `Proxy target: ${gatewayOrigin()}`,
        },
        { status: 502 },
      );
    }

    // ── Follow redirects MANUALLY with origin validation ──────────
    if ([301, 302, 307, 308].includes(res.status)) {
      const location = res.headers.get('location');
      if (location) {
        const validated = validateRedirectTarget(location, targetUrl);
        if (!validated) {
          console.error(`[${logTag}] refused cross-origin redirect`, location);
          return NextResponse.json(
            { detail: 'Gateway returned an unsafe redirect.' },
            { status: 502 },
          );
        }
        try {
          res = await fetch(validated, { method, headers, body, redirect: 'manual' });
        } catch (e2) {
          const msg = e2 instanceof Error ? e2.message : 'redirect fetch failed';
          console.error(`[${logTag} redirect]`, validated, msg);
          return NextResponse.json({ detail: 'Gateway redirect failed' }, { status: 502 });
        }
      }
    }

    // ── Build outbound response headers ───────────────────────────
    const out = new Headers();
    const ctOut = res.headers.get('content-type');
    if (ctOut) out.set('content-type', ctOut);
    sanitizeCorsHeaders(out, res);

    // ── Set-Cookie passthrough (multi-cookie aware) ───────────────
    const setCookies =
      typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    if (setCookies.length > 0) {
      for (const c of setCookies) out.append('set-cookie', c);
    } else {
      const single = res.headers.get('set-cookie');
      if (single) out.append('set-cookie', single);
    }

    return new NextResponse(await res.arrayBuffer(), {
      status: res.status,
      statusText: res.statusText,
      headers: out,
    });
  }

  type RouteCtx = { params: Promise<{ path?: string[] }> };
  const handle = async (req: NextRequest, ctx: RouteCtx) => {
    const p = await ctx.params;
    return proxy(req, p.path ?? []);
  };

  return {
    GET: handle,
    POST: handle,
    PUT: handle,
    PATCH: handle,
    DELETE: handle,
    OPTIONS: handle,
  };
}
