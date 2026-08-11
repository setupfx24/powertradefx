import * as Sentry from '@sentry/nextjs'

/**
 * Node-side Sentry init for App Router server components, route
 * handlers (api/v1, api/algo proxies), and server actions.
 *
 * Inactive until SENTRY_DSN is set in prod env.
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  environment: process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_APP_VERSION,
  enabled: process.env.NODE_ENV === 'production' && !!process.env.SENTRY_DSN,
})
