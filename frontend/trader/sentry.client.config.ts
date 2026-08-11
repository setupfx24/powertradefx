import * as Sentry from '@sentry/nextjs'

/**
 * Browser-side Sentry init. Captures uncaught exceptions, promise
 * rejections, and the errors forwarded from the App Router error
 * boundaries (src/app/error.tsx, src/app/global-error.tsx).
 *
 * Inactive until SENTRY_DSN is set in prod env. Without a DSN, Sentry
 * silently no-ops — safe to ship now and flip on by setting the env var.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  /* Lower in prod to keep transaction quotas reasonable; bump to 1.0
   * for a few days post-launch to seed perf baselines. */
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  /* Replay only on errors — full session replay is expensive. */
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0,
  environment: process.env.NODE_ENV,
  release: process.env.NEXT_PUBLIC_APP_VERSION,
  /* Don't capture local dev errors in cloud Sentry. */
  enabled: process.env.NODE_ENV === 'production' && !!process.env.NEXT_PUBLIC_SENTRY_DSN,
})
