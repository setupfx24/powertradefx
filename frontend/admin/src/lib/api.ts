/**
 * Browser-reachable admin API base (no trailing slash).
 * - If NEXT_PUBLIC_ADMIN_API_URL or NEXT_PUBLIC_API_URL is set → `{origin}/api/v1/admin`.
 * - Otherwise same-origin `/admin-api` (proxied by app/admin-api route → admin service).
 */
export function getAdminApiBase(): string {
  const raw = (process.env.NEXT_PUBLIC_ADMIN_API_URL || process.env.NEXT_PUBLIC_API_URL || '').trim();
  if (raw) {
    const u = raw.replace(/\/$/, '');
    if (u.includes('/api/v1/admin')) return u;
    return `${u}/api/v1/admin`;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/admin-api`;
  }
  return `${(process.env.ADMIN_API_PROXY_TARGET || 'http://127.0.0.1:8001').replace(/\/$/, '')}/api/v1/admin`;
}

/** FastAPI returns `detail` as string, object, or validation error array — never pass raw objects to `new Error()`. */
export function formatApiErrorDetail(detail: unknown): string {
  if (detail == null) return '';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item: unknown) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'msg' in item) {
          const o = item as { msg?: string; loc?: unknown[]; type?: string };
          const loc = Array.isArray(o.loc) ? o.loc.filter((x) => x !== 'body').join('.') : '';
          return loc ? `${loc}: ${o.msg || 'invalid'}` : (o.msg || JSON.stringify(item));
        }
        try {
          return JSON.stringify(item);
        } catch {
          return String(item);
        }
      })
      .join('; ');
  }
  // Object detail — `{ message }` or `{ code, message }` (e.g. the MFA
  // challenge: `{ code: "mfa_required", message: "..." }`). The human
  // string is always `message`; `code` is machine-readable and surfaces
  // separately on ApiError.code.
  if (typeof detail === 'object' && detail !== null && 'message' in detail && typeof (detail as { message: unknown }).message === 'string') {
    return (detail as { message: string }).message;
  }
  try {
    return JSON.stringify(detail);
  } catch {
    return 'Request failed';
  }
}

/** Machine-readable `detail.code` when the backend sends an object detail. */
export function extractApiErrorCode(detail: unknown): string | undefined {
  if (detail && typeof detail === 'object' && !Array.isArray(detail) && 'code' in detail) {
    const code = (detail as { code: unknown }).code;
    if (typeof code === 'string' && code) return code;
  }
  return undefined;
}

/** `Retry-After` header → seconds (integer form only; HTTP-date is not used by our backend). */
function parseRetryAfter(res: Response): number | undefined {
  const raw = res.headers.get('Retry-After');
  if (!raw) return undefined;
  const secs = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(secs) && secs >= 0 ? secs : undefined;
}

/**
 * Error thrown by every non-OK admin API response. Extends `Error` so the
 * existing `e instanceof Error ? e.message : …` callers keep working; the
 * extra fields let flows such as MFA sign-in branch on the response.
 */
export class ApiError extends Error {
  /** HTTP status code. */
  readonly status: number;
  /** `detail.code` when the backend sent `{ detail: { code, message } }`. */
  readonly code?: string;
  /** Raw `detail` payload as returned by the backend (string, object, array…). */
  readonly detail: unknown;
  /** Seconds from the `Retry-After` header (e.g. 429 lockout), when present. */
  readonly retryAfter?: number;

  constructor(
    message: string,
    opts: { status: number; detail?: unknown; code?: string; retryAfter?: number },
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = opts.status;
    this.detail = opts.detail;
    if (opts.code !== undefined) this.code = opts.code;
    if (opts.retryAfter !== undefined) this.retryAfter = opts.retryAfter;
    // Keep `instanceof` reliable when the TS target is ES5-ish.
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /** Build from a non-OK fetch Response, reading the JSON body once. */
  static async fromResponse(res: Response): Promise<ApiError> {
    const body = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    const detail = body && typeof body === 'object' && 'detail' in body
      ? (body as { detail: unknown }).detail
      : body;
    const msg = formatApiErrorDetail(detail) || `HTTP ${res.status}`;
    return new ApiError(msg, {
      status: res.status,
      detail,
      code: extractApiErrorCode(detail),
      retryAfter: parseRetryAfter(res),
    });
  }
}

/** Legacy export — only honoured by the obsolete employee-impersonation
 * flow which still hands a token between users. New auth uses HttpOnly
 * cookies; nothing else should reference this. */
export const ADMIN_TOKEN_KEY = 'admin_token';

class AdminApi {
  /** Optional bearer for legacy impersonation. The real session lives
   * in the HttpOnly `fx_admin` cookie set by the backend on /login. */
  private token: string | null = null;

  setToken(t: string) {
    this.token = t;
  }

  getToken(): string | null {
    return this.token;
  }

  clearToken() {
    this.token = null;
  }

  private async req<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string>,
  ): Promise<T> {
    const base = getAdminApiBase();
    const p = path.startsWith('/') ? path : `/${path}`;
    const url = new URL(`${base}${p}`);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    // credentials:'include' tells the browser to attach the HttpOnly
    // admin cookie on every request — that's our primary auth surface
    // now. Without it the cookie is dropped on cross-origin proxies.
    const res = await fetch(url.toString(), {
      method, headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
    });

    if (res.status === 401) {
      // Keep the server's own message ("Incorrect email or password.",
      // "Session revoked, please sign in again", the MFA challenge code…).
      // A bare "Unauthorized" told the admin nothing and hid the MFA prompt.
      const err = await ApiError.fromResponse(res);
      const onLogin = typeof window !== 'undefined' && window.location.pathname.startsWith('/login');
      if (!onLogin) {
        this.clearToken();
        if (typeof window !== 'undefined') window.location.href = '/login';
      }
      throw err;
    }

    if (!res.ok) {
      throw await ApiError.fromResponse(res);
    }

    return res.json();
  }

  get<T>(path: string, params?: Record<string, string>) {
    return this.req<T>('GET', path, undefined, params);
  }
  post<T>(path: string, body?: unknown) {
    return this.req<T>('POST', path, body);
  }
  put<T>(path: string, body?: unknown) {
    return this.req<T>('PUT', path, body);
  }
  patch<T>(path: string, body?: unknown) {
    return this.req<T>('PATCH', path, body);
  }
  delete<T>(path: string) {
    return this.req<T>('DELETE', path);
  }

  /** Multipart upload (do not set Content-Type — browser sets boundary). */
  async postForm<T>(path: string, formData: FormData, method: 'POST' | 'PUT' = 'POST'): Promise<T> {
    const base = getAdminApiBase();
    const p = path.startsWith('/') ? path : `/${path}`;
    const url = `${base}${p}`;
    const headers: Record<string, string> = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const res = await fetch(url, {
      method, headers, body: formData,
      credentials: 'include',
    });

    if (res.status === 401) {
      const err = await ApiError.fromResponse(res);
      this.clearToken();
      if (typeof window !== 'undefined') window.location.href = '/login';
      throw err;
    }

    if (!res.ok) {
      throw await ApiError.fromResponse(res);
    }

    return res.json();
  }
}

export const adminApi = new AdminApi();
