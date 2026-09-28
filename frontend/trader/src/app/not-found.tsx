import Link from 'next/link'
import { Home, ArrowLeft } from 'lucide-react'

export const metadata = { title: 'Page Not Found — PowerTradeFX' }

/**
 * Root-level 404 — catches any path that doesn't match a route AND
 * isn't covered by a more specific not-found.tsx. The landing route
 * group has its own light-themed variant for marketing 404s.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base text-text-primary px-6">
      <div className="max-w-md w-full text-center">
        <p className="font-mono tabular-nums text-[120px] font-bold leading-none text-accent mb-2">404</p>
        <h1 className="text-2xl font-semibold tracking-tight mb-3">Page not found</h1>
        <p className="text-sm text-text-secondary mb-8 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-accent px-5 text-md font-semibold text-text-on-accent shadow-sm transition-colors hover:bg-accent-hover"
          >
            <Home className="w-4 h-4" aria-hidden />
            Dashboard
          </Link>
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border-strong px-5 text-md font-semibold text-text-primary transition-colors hover:bg-bg-hover"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden />
            Home
          </Link>
        </div>
      </div>
    </div>
  )
}
