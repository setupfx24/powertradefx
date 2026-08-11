import * as Sentry from '@sentry/nextjs'

/**
 * Next.js 15+ instrumentation hook. Loads the right Sentry config per
 * runtime (Node vs Edge) so the SDK is registered before any handler
 * runs. App Router automatically calls register() once at startup.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

/* Surface request errors raised inside React Server Components to
 * Sentry — Next 15.0+ calls this hook from server-action / RSC
 * failure paths automatically. */
export const onRequestError = Sentry.captureRequestError
