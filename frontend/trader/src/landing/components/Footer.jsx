import Link from 'next/link'
import { Facebook, Instagram, Linkedin, Youtube, Mail, Cookie } from 'lucide-react'
import ScrollReveal from './animations/ScrollReveal'
import { openCookieSettings } from '@/home/components/CookieConsent'
import { FOOTER_COLUMNS, FOOTER_LEGAL, RISK_DISCLAIMER, COPYRIGHT } from '@/home/data'
import { BRAND_NAME, BRAND_DOMAIN, BRAND_LOGO_LIGHT, BRAND_SUPPORT_EMAIL } from '@/lib/brand'

const socials = [
  { icon: Facebook,  href: `https://${BRAND_DOMAIN}`, label: 'Facebook' },
  { icon: Instagram, href: `https://${BRAND_DOMAIN}`, label: 'Instagram' },
  { icon: Linkedin,  href: `https://${BRAND_DOMAIN}`, label: 'LinkedIn' },
  { icon: Youtube,   href: `https://${BRAND_DOMAIN}`, label: 'YouTube' },
]

/**
 * Shared footer for every (landing) page except the home page, which
 * renders its own in CtaFooter. Link columns and legal links come from
 * src/home/data.ts so the two footers and the header cannot drift apart.
 */
export default function Footer() {
  return (
    /* Solid black band, matching the homepage footer. The --fx-* text and
       surface tokens are re-pointed to their inverted values for this
       subtree so every child that reads them follows. */
    <footer
      className="relative"
      style={{
        background: '#000000',
        borderTop: '1px solid var(--fx-line)',
        '--fx-text': '#ffffff',
        '--fx-text-2': 'rgba(255, 255, 255, 0.66)',
        '--fx-text-3': 'rgba(255, 255, 255, 0.48)',
        '--fx-line': 'rgba(255, 255, 255, 0.12)',
        '--fx-line-strong': 'rgba(255, 255, 255, 0.22)',
        '--fx-bg-elev': 'rgba(255, 255, 255, 0.05)',
        '--fx-bg-elev-2': 'rgba(255, 255, 255, 0.08)',
        color: '#ffffff',
      }}
    >
      <div className="fx-divider-gold" />

      <div className="fx-container py-14 md:py-20">
        {/* Top: brand + columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-10 lg:gap-8">
          {/* Brand block — spans more on mobile */}
          <div className="col-span-2 lg:col-span-2">
            <ScrollReveal variant="fadeLeft">
              <Link href="/" className="inline-block mb-5" aria-label={`${BRAND_NAME} home`}>
                {BRAND_LOGO_LIGHT ? (
                  <img src={BRAND_LOGO_LIGHT} alt={BRAND_NAME} className="h-10 w-auto" />
                ) : (
                  <span className="text-2xl font-black tracking-tight" style={{ color: 'var(--fx-text)' }}>{BRAND_NAME}</span>
                )}
              </Link>
              <p className="text-sm leading-relaxed max-w-sm mb-6" style={{ color: 'var(--fx-text-2)' }}>
                {BRAND_NAME} is an online multi-asset broker. Trade forex, gold and
                metals, indices, oil and crypto from one account, with leverage up to
                1:500, an instant $10,000 demo and a web terminal that works on any device.
              </p>

              <div className="flex items-center gap-2 text-sm mb-5" style={{ color: 'var(--fx-text-3)' }}>
                <Mail size={14} style={{ color: 'var(--fx-gold-light)' }} />
                <a href={`mailto:${BRAND_SUPPORT_EMAIL}`} className="hover:underline" style={{ color: 'var(--fx-text-2)' }}>
                  {BRAND_SUPPORT_EMAIL}
                </a>
              </div>

              <div className="flex items-center gap-2.5">
                {socials.map(({ icon: Icon, href, label }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="w-9 h-9 rounded-full flex items-center justify-center transition-colors"
                    style={{
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid var(--fx-line-strong)',
                      color: 'var(--fx-text-2)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--fx-gold-light)'
                      e.currentTarget.style.borderColor = 'rgba(232, 93, 61,0.4)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--fx-text-2)'
                      e.currentTarget.style.borderColor = 'var(--fx-line-strong)'
                    }}
                  >
                    <Icon size={15} />
                  </a>
                ))}
              </div>
            </ScrollReveal>
          </div>

          {/* Link columns — Trading / Platform / Partners & Learn / Company */}
          {FOOTER_COLUMNS.map(({ title, links }, i) => (
            <ScrollReveal key={title} variant="fadeUp" delay={0.05 + i * 0.05}>
              <h3
                className="text-xs uppercase tracking-[0.16em] font-semibold mb-4"
                style={{ color: 'var(--fx-gold-light)' }}
              >
                {title}
              </h3>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm transition-colors"
                      style={{ color: 'var(--fx-text-2)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--fx-text)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--fx-text-2)' }}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </ScrollReveal>
          ))}
        </div>

        {/* Risk warning */}
        <div
          className="mt-12 md:mt-16 p-6 md:p-8 rounded-2xl space-y-7"
          style={{
            background: 'var(--fx-bg-elev)',
            border: '1px solid var(--fx-line)',
          }}
        >
          <div>
            <h3
              className="text-lg md:text-xl font-semibold mb-3"
              style={{ color: 'var(--fx-text)' }}
            >
              Risk warning
            </h3>
            <p className="text-xs md:text-[13px] leading-relaxed" style={{ color: 'var(--fx-text-3)' }}>
              {RISK_DISCLAIMER}
            </p>
          </div>
        </div>

        {/* Legal / policy quick-links */}
        <nav
          aria-label="Legal documents"
          className="mt-10 pt-6 flex flex-wrap gap-x-7 gap-y-3"
          style={{ borderTop: '1px solid var(--fx-line)' }}
        >
          {FOOTER_LEGAL.map((doc) => (
            <Link
              key={doc.href}
              href={doc.href}
              className="text-sm font-semibold hover:underline transition-colors"
              style={{ color: 'var(--fx-text)' }}
            >
              {doc.label}
            </Link>
          ))}
        </nav>

        {/* Bottom bar */}
        <div
          className="mt-6 pt-6 flex flex-col md:flex-row gap-3 md:gap-6 items-start md:items-center justify-between"
          style={{ borderTop: '1px solid var(--fx-line)' }}
        >
          <p className="text-xs" style={{ color: 'var(--fx-text-3)' }}>
            {COPYRIGHT}
          </p>
          {/* Cookie Settings — surfaces the consent modal even after
              the user has already accepted/saved a preference, so the
              choice stays revisable per GDPR. */}
          <button
            type="button"
            onClick={openCookieSettings}
            className="inline-flex items-center gap-1.5 text-xs hover:underline transition-colors"
            style={{ color: 'var(--fx-text-2)' }}
            aria-label="Open cookie settings"
          >
            <Cookie size={13} /> Cookie Settings
          </button>
        </div>
      </div>
    </footer>
  )
}
