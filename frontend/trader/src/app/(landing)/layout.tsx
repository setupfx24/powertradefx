'use client';

/**
 * Landing shell — deep-navy animated marketing look (see landing-fx.css).
 * The home page is dark; legal/contact pages keep a white reading surface
 * (long legal text on dark is hostile), so the nav flips variant per path.
 * All brand color flows from the accent tokens in globals.css.
 */
import { usePathname } from 'next/navigation';
import LandingNav from '@/components/landing/LandingNav';
import SiteFooter from '@/components/landing/SiteFooter';
import { LandingLangProvider } from '@/components/landing/i18n';
import SmoothScroll from '@/components/landing/SmoothScroll';
import '@/components/landing/landing-fx.css';

const LIGHT_PATHS = new Set([
  '/contact', '/privacy', '/terms', '/risk', '/policy', '/account-deletion',
]);

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const light = LIGHT_PATHS.has(pathname);
  const isHome = pathname === '/';
  return (
    <LandingLangProvider>
      <SmoothScroll />
      <div className={light ? 'min-h-screen bg-white' : 'min-h-screen lx-canvas'}>
        {!isHome && <LandingNav dark={!light} />}
        <main>{children}</main>
        <SiteFooter />
      </div>
    </LandingLangProvider>
  );
}
