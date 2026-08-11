/**
 * Error-narrowing helpers for catch blocks.
 *
 * Used to replace `catch (e: any)` blocks across the trader app with
 * `catch (e: unknown)` + a safe extractor. Centralizes the per-feature
 * variations of how errors arrive (gateway returns `{ detail }`, raw
 * fetch throws `Error`, our api client wraps both, etc.) so each catch
 * site is a one-liner instead of nested `?.` chains.
 *
 * Usage:
 *   try { await api.post(...); }
 *   catch (e: unknown) { toast.error(getErrorMessage(e, 'Could not save')); }
 */

interface ApiErrorShape {
  message?: string;
  status?: number;
  detail?: string;
  response?: {
    status?: number;
    data?: {
      detail?: string | { message?: string } | unknown;
      message?: string;
    };
  };
}

/** Type guard — returns true for any object-shaped error (most real errors). */
function isObjectError(e: unknown): e is Record<string, unknown> {
  return typeof e === 'object' && e !== null;
}

/**
 * Pull a user-displayable error message from an unknown caught value.
 * Tries (in order): response.data.detail (string), response.data.detail.message,
 * response.data.message, top-level detail, top-level message, fallback.
 */
export function getErrorMessage(e: unknown, fallback = 'An error occurred'): string {
  if (typeof e === 'string') return e || fallback;
  if (!isObjectError(e)) return fallback;
  const err = e as ApiErrorShape;

  const respDetail = err.response?.data?.detail;
  if (typeof respDetail === 'string') return respDetail || fallback;
  if (respDetail && typeof respDetail === 'object' && 'message' in respDetail) {
    const m = (respDetail as { message?: unknown }).message;
    if (typeof m === 'string' && m) return m;
  }

  const respMessage = err.response?.data?.message;
  if (typeof respMessage === 'string' && respMessage) return respMessage;

  if (typeof err.detail === 'string' && err.detail) return err.detail;
  if (typeof err.message === 'string' && err.message) return err.message;

  return fallback;
}

/**
 * Return the backend `detail` code if present (string), undefined otherwise.
 * Used by call sites that branch on specific error codes like
 * 'insufficient_ac' or 'position_locked'.
 */
export function getErrorDetail(e: unknown): string | undefined {
  if (!isObjectError(e)) return undefined;
  const err = e as ApiErrorShape;
  const respDetail = err.response?.data?.detail;
  if (typeof respDetail === 'string') return respDetail;
  if (typeof err.detail === 'string') return err.detail;
  return undefined;
}

/** Return the HTTP status code from an unknown error, or undefined. */
export function getErrorStatus(e: unknown): number | undefined {
  if (!isObjectError(e)) return undefined;
  const err = e as ApiErrorShape;
  return err.status ?? err.response?.status;
}
