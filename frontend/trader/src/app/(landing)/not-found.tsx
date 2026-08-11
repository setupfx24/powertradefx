import Link from 'next/link'
import { Home, ArrowLeft } from 'lucide-react'

export const metadata = { title: 'Page Not Found — PowerTradeFX' }

/**
 * Marketing-scope 404. Light theme + LandingHeader/Footer from the
 * (landing) layout. Catches unknown paths under the marketing route
 * group; the trader-app 404 lives at src/app/not-found.tsx.
 */
export default function LandingNotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6 py-20">
      <div className="max-w-md w-full text-center">
        <p className="text-[120px] font-bold leading-none text-accent mb-2">404</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Page not found</h1>
        <p className="text-gray-500 mb-8 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            <Home className="w-4 h-4" />
            Home
          </Link>
          <Link
            href="/auth/login"
            className="inline-flex items-center justify-center gap-2 border border-gray-300 hover:border-accent text-gray-900 font-medium px-6 py-3 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
