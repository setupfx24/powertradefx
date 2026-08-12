import { portalFontClass } from '@/components/portal/fonts';
import PortalNav from '@/components/portal/PortalNav';
import PortalFooter from '@/components/portal/PortalFooter';
import { PORTAL_BRAND } from '@/components/portal/brand';
import PortalGround from '@/components/portal/PortalGround';
import styles from '@/components/portal/portal.module.css';

/**
 * Shell for the portal sub-pages: the three in the bar (/markets,
 * /platform, /contact) plus /classes and /sessions, which /platform and
 * the footer link to.
 *
 * A route group, so it adds no path segment. Deliberately OUTSIDE the
 * `(landing)` group: that layout injects LandingNav, SiteFooter and the
 * lenis SmoothScroll wrapper, and these pages ship the portal's own bar
 * and closing fold.
 *
 * Server Component, which is why the next/font class is applied here —
 * font loaders cannot be called from a Client Component.
 *
 * Sizing note: --close-vw is set on the wrapper because the closing
 * wordmark is sized from its glyph count, and the 13-glyph PowerTradeFX
 * mark does not fit the stylesheet's nine-glyph default.
 */
const closeVw = `${(88 / PORTAL_BRAND.mark.length).toFixed(2)}vw`;

export default function PortalSubLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${portalFontClass} ${styles.page}`}
      style={{ '--close-vw': closeVw } as React.CSSProperties}
    >
      <PortalGround />
      <PortalNav
        mark={PORTAL_BRAND.mark}
        logo={PORTAL_BRAND.logo}
        links={PORTAL_BRAND.links}
        cta={PORTAL_BRAND.cta}
      />
      <main className={styles.sub}>{children}</main>
      <PortalFooter
        label="Get started"
        heading="Open an account."
        fine={PORTAL_BRAND.riskWarning}
        actions={[
          { label: 'Open account', href: '/auth/register' },
          { label: 'Sign in', href: '/auth/login' },
        ]}
        footLeft={PORTAL_BRAND.foot.left}
        footRight={PORTAL_BRAND.foot.right}
        mark={PORTAL_BRAND.mark}
      />
    </div>
  );
}
