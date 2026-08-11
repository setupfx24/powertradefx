'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { RefreshCw, Home } from 'lucide-react'
import * as Sentry from '@sentry/nextjs'

/**
 * Marketing-scope error boundary. Light theme matches the
 * PowerTradeFX landing chrome (nav / footer render
 * around this from the layout). Trader-app errors are caught by
 * src/app/error.tsx instead.
 */
export default function LandingError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
    console.error('[(landing)/error]', error)
  }, [error])

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6 py-20">
      <div className="max-w-md w-full text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-gray-500 mb-4">Error 500</p>
        <h1 className="text-3xl font-bold text-gray-900 mb-3">Something went wrong.</h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          We hit a snag loading this page. The error has been logged.
          You can retry or return home.
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 font-mono mb-6">Reference: {error.digest}</p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            type="button"
            className="inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 border border-gray-300 hover:border-accent text-gray-900 font-medium px-6 py-3 rounded-lg transition-colors"
          >
            <Home className="w-4 h-4" />
            Home
          </Link>
        </div>
      </div>
    </div>
  )
}
