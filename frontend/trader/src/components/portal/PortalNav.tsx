import Link from 'next/link';
import Image from 'next/image';
import styles from './portal.module.css';
import PortalMobileMenu from './PortalMobileMenu';

/**
 * The fixed 58px bar, shared by the home portal and every sub-page so the
 * chrome is identical across the site.
 *
 * No 'use client' directive on purpose: this component holds no state, so
 * it compiles as a Server Component under the sub-page layouts and is
 * pulled into the client bundle when the home page's client component
 * imports it. Both work.
 *
 * Route links go through next/link for client-side navigation; in-page
 * anchors stay plain <a> so the browser handles the hash itself.
 */

export type PortalLink = { label: string; href: string };

function NavItem({ link, className }: { link: PortalLink; className: string }) {
  if (link.href.startsWith('/')) {
    return (
      <Link className={className} href={link.href}>
        {link.label}
      </Link>
    );
  }
  return (
    <a className={className} href={link.href}>
      {link.label}
    </a>
  );
}

export default function PortalNav({
  mark,
  links,
  cta,
  /** Wordmark lockup image. Given one, it stands in for the type mark —
   *  `mark` then only supplies the link's accessible name. */
  logo,
  /** Where the wordmark points. '#top' on the home page, '/' elsewhere. */
  homeHref = '/',
  /** Route of the current page, so its nav link can be marked active. */
  active,
}: {
  mark: string;
  links: PortalLink[];
  cta: PortalLink;
  logo?: string;
  homeHref?: string;
  active?: string;
}) {
  const bare = mark.replace(/\.$/, '');
  /* The lockup is wide (roughly 6.5:1), so it is sized by HEIGHT and left to
     find its own width — see .navLogo. Intrinsic dimensions are the file's
     real ones so next/image can reason about the aspect ratio.

     `sizes` is not optional here: without it, next/image builds the srcset
     from the width prop and ships a 1920px variant for a bar that renders
     the mark ~137px wide. With it, the browser picks a variant sized for the
     box it actually occupies. */
  const brand = logo ? (
    <Image
      className={styles.navLogo}
      src={logo}
      alt={bare}
      width={1536}
      height={236}
      sizes="160px"
      priority
    />
  ) : (
    <>
      {bare}
      <span>.</span>
    </>
  );
  return (
    <nav className={styles.nav}>
      {homeHref.startsWith('/') ? (
        <Link className={styles.navMark} href={homeHref}>
          {brand}
        </Link>
      ) : (
        <a className={styles.navMark} href={homeHref}>
          {brand}
        </a>
      )}

      <div className={styles.navLinks}>
        {links.map((l) => (
          <NavItem
            key={l.href}
            link={l}
            className={`${styles.navLink} ${active === l.href ? styles.navLinkOn : ''}`}
          />
        ))}
      </div>

      {/* CSS-module lookups are `string | undefined` under this project's
          noUncheckedIndexedAccess; NavItem's prop is a plain string. */}
      <NavItem link={cta} className={styles.btn ?? ''} />

      {/* Carries the same routes below 860px, where .navLinks is hidden.
          The only client component in the bar — see its header. */}
      <PortalMobileMenu links={links} cta={cta} active={active} />
    </nav>
  );
}
