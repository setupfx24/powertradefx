import { createContext, useContext, useState, useEffect } from 'react'
import Link from 'next/link'
import { X, ArrowRight, Wallet, FlaskConical } from 'lucide-react'
import { BRAND_NAME } from '@/lib/brand'

/**
 * "Get started" modal shared by the legacy landing pages.
 *
 * Opened by `Button.jsx` (via TradingPageTemplate) and mounted once by
 * the (landing) layout. It offers the two real entry points into the
 * platform — open a live account or start the instant demo — and links
 * straight into the app. There is no lead form here: nothing is
 * collected and nobody "reaches out".
 */
const PopupContext = createContext()

export const usePopup = () => useContext(PopupContext)

export const PopupProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false)

  const openPopup = () => setIsOpen(true)
  const closePopup = () => setIsOpen(false)

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  return (
    <PopupContext.Provider value={{ openPopup, closePopup }}>
      {children}

      {isOpen && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={closePopup}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="landing-get-started-title"
            className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--fx-line)] bg-white p-8 shadow-[0_28px_70px_rgba(11,11,12,0.24)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={closePopup}
              className="absolute top-4 right-4 text-[var(--fx-text-3)] hover:text-[var(--fx-text)] transition-colors z-10"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 id="landing-get-started-title" className="text-2xl font-bold text-[var(--fx-text)] mb-2">
              Start trading with {BRAND_NAME}
            </h2>
            <p className="text-[var(--fx-text-2)] mb-6">
              Open a live account in a few minutes, or try the platform first with a free demo
              account funded with $10,000 of virtual money — no email required.
            </p>

            <div className="space-y-3">
              <Link
                href="/auth/register"
                className="btn-primary w-full inline-flex items-center justify-center gap-2"
                onClick={closePopup}
              >
                <Wallet className="w-5 h-5" />
                Open account
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/auth/login"
                className="btn-ghost w-full inline-flex items-center justify-center gap-2"
                onClick={closePopup}
              >
                <FlaskConical className="w-5 h-5" />
                Try a free demo
              </Link>
            </div>

            <p className="mt-5 text-center text-xs text-[var(--fx-text-3)]">
              Trading leveraged products such as forex and CFDs carries a high level of risk and may
              not be suitable for all investors. You could lose more than your initial deposit.
            </p>
          </div>
        </div>
      )}
    </PopupContext.Provider>
  )
}
