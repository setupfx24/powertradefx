'use client';

/**
 * Landing shell.
 *
 * The HOME route is the portal surface (see ./page.tsx) and opts out of
 * three things this shell normally provides:
 *
 *   - SiteFooter — the portal page ends with its own hairline footer
 *     strip and cropped wordmark; a second footer under it reads as a
 *     mistake.
 *   - SmoothScroll (lenis) — it eases scroll over 1.3s and, by its own
 *     comment, runs unconditionally regardless of prefers-reduced-motion.
 *     The portal hero is bound to scroll POSITION, so that easing makes
 *     the panels visibly lag the wheel, and it would also smuggle motion
 *     past a reader who asked for none.
 *   - lx-canvas — the portal paints its own near-black ground.
 *
 * LandingNav was already skipped on home; the portal ships its own bar.
 *
 * Legal pages keep a white reading surface (long legal text on dark is
 * hostile), so the nav flips variant per path.
 */
import { usePathname } from 'next/navigation';
import LandingNav from '@/components/landing/LandingNav';
import SiteFooter from '@/components/landing/SiteFooter';
import { LandingLangProvider } from '@/components/landing/i18n';
import SmoothScroll from '@/components/landing/SmoothScroll';
import '@/components/landing/landing-fx.css';

/* /contact is NOT here any more — it moved to the (portal) group and
   ships the dark portal chrome with the rest of the nav. */
const LIGHT_PATHS = new Set([
  '/privacy', '/terms', '/risk', '/policy', '/account-deletion',
]);

export default function LandingLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '/';
  const light = LIGHT_PATHS.has(pathname);
  const isHome = pathname === '/';

  if (isHome) {
    return (
      <LandingLangProvider>
        <main>{children}</main>
      </LandingLangProvider>
    );
  }

  return (
    <LandingLangProvider>
      <SmoothScroll />
      <div className={light ? 'min-h-screen bg-white' : 'min-h-screen lx-canvas'}>
        <LandingNav dark={!light} />
        <main>{children}</main>
        <SiteFooter />
      </div>
    </LandingLangProvider>
  );
}
