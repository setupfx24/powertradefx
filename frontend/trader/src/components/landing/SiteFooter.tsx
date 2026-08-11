'use client';

import Link from 'next/link';
import { Mail } from 'lucide-react';
import { useLandingLang } from './i18n';

export default function SiteFooter() {
  const { t } = useLandingLang();
  const year = new Date().getFullYear();
  return (
    <footer className="lx-canvas border-t border-white/5">
      <div className="max-w-7xl mx-auto px-5 lg:px-8 py-14">
        <div className="grid md:grid-cols-3 gap-10">
          <div>
            <span className="inline-flex items-center gap-2.5 mb-4">
              <svg viewBox="0 0 32 32" aria-hidden="true" className="w-7 h-7">
                <rect width="32" height="32" rx="7" className="fill-accent" />
                <path fillRule="evenodd" d="M11 6.5 H19.2 C23.3 6.5 26.2 9.3 26.2 13.2 C26.2 17.1 23.3 19.9 19.2 19.9 H15.2 V25.5 H11 Z M15.2 10.2 V16.2 H18.9 C20.9 16.2 22 15 22 13.2 C22 11.4 20.9 10.2 18.9 10.2 Z" fill="#ffffff" />
              </svg>
              <span className="inline-flex items-baseline font-display font-bold tracking-tight text-lg">
                <span className="text-white">PowerTrade</span>
                <span className="text-accent">FX</span>
              </span>
            </span>
            <p className="text-sm text-gray-400 leading-relaxed max-w-xs mb-5">{t('foot.tagline')}</p>
            <a
              href="mailto:support@powertradefx.com"
              className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-accent transition-colors"
            >
              <Mail className="w-4 h-4 text-accent" />
              support@powertradefx.com
            </a>
          </div>
          <div>
            <h3 className="text-xs uppercase tracking-[0.18em] font-semibold text-accent mb-4">
              {t('foot.legal')}
            </h3>
            <ul className="space-y-2.5 text-sm text-gray-400">
              <li><Link href="/privacy" className="hover:text-white transition-colors">{t('foot.privacy')}</Link></li>
              <li><Link href="/terms" className="hover:text-white transition-colors">{t('foot.terms')}</Link></li>
              <li><Link href="/risk" className="hover:text-white transition-colors">{t('foot.risk')}</Link></li>
              <li><Link href="/policy" className="hover:text-white transition-colors">{t('foot.policy')}</Link></li>
              <li><Link href="/account-deletion" className="hover:text-white transition-colors">{t('foot.deletion')}</Link></li>
            </ul>
          </div>
          <div className="rounded-2xl lx-card p-5">
            <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-accent mb-2">
              {t('foot.risk')}
            </p>
            <p className="text-xs leading-relaxed text-gray-400">{t('foot.riskwarn')}</p>
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-500">© {year} PowerTradeFX Ltd. All rights reserved.</p>
          <Link href="/contact" className="text-xs text-gray-400 hover:text-accent transition-colors">
            {t('nav.contact')}
          </Link>
        </div>
      </div>
    </footer>
  );
}
