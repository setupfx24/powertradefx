import Link from 'next/link';
import styles from './portal.module.css';
import { PORTAL_BRAND } from './brand';
import type { PortalLink } from './PortalNav';

/**
 * The closing fold, top to bottom: the headline and its two buttons, a
 * hairline, then a four-column directory ending in the sign-up block, a
 * second hairline carrying the copyright strip, and finally the wordmark
 * full width, sitting just clear of the page edge. An amber wash rises from
 * that bottom edge behind the mark.
 *
 * Shared by the home portal and every sub-page. The directory content is
 * read from PORTAL_BRAND rather than passed in, so the columns are identical
 * everywhere and only the headline block above them varies per surface.
 *
 * The sign-up field is a native GET form, so it works with JS disabled and
 * this file stays free of client state. It posts to the signup page rather
 * than a mailing list — see PORTAL_BRAND.updates for why.
 *
 * `closeVw` must be set by the caller (see closeVw() in PortalPage) or the
 * mark falls back to the 9.8vw default, which only fits a nine-glyph
 * wordmark.
 */

function FootLink({ link, className }: { link: PortalLink; className?: string }) {
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

export default function PortalFooter({
  label,
  heading,
  fine,
  actions,
  footLeft,
  footRight,
  mark,
  id,
}: {
  label: string;
  heading: string;
  fine: string;
  actions: PortalLink[];
  footLeft: string;
  footRight: string;
  mark: string;
  id?: string;
}) {
  const { contact, footerNav, updates, legalName } = PORTAL_BRAND;
  const year = new Date().getFullYear();

  return (
    <section id={id} className={styles.close}>
      <div className={`${styles.closeGrid} ${styles.reveal}`}>
        <div className={styles.closeLead}>
          <span className={styles.label}>{label}</span>
          <h2 className={styles.heading} style={{ marginTop: 18 }}>
            {heading}
          </h2>
        </div>
        <div className={styles.closeActions}>
          {actions.map((a, i) => {
            const cls = `${styles.btn} ${i > 0 ? styles.btnQuiet : ''}`;
            const body = (
              <>
                {a.label}
                {i === 0 && (
                  <span className={styles.btnPlus} aria-hidden="true">
                    +
                  </span>
                )}
              </>
            );
            return a.href.startsWith('/') ? (
              <Link key={a.href} className={cls} href={a.href}>
                {body}
              </Link>
            ) : (
              <a key={a.href} className={cls} href={a.href}>
                {body}
              </a>
            );
          })}
        </div>
      </div>

      <div className={styles.fineRow}>
        <p className={styles.fine}>{fine}</p>
      </div>

      <div className={styles.footCols}>
        {footerNav.map((col) => (
          <div key={col.title} className={styles.footCol}>
            <h3 className={styles.footHead}>{col.title}</h3>
            <ul className={styles.footList}>
              {col.links.map((l) => (
                <li key={l.href}>
                  <FootLink link={l} className={styles.footLink} />
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className={styles.footCol}>
          <h3 className={styles.footHead}>Contact</h3>
          <ul className={styles.footList}>
            <li>
              <a className={styles.footLink} href={`mailto:${contact.email}`}>
                {contact.email}
              </a>
            </li>
            <li>
              <Link className={styles.footLink} href="/contact">
                Contact us
              </Link>
            </li>
            <li className={styles.footMuted}>{contact.hours}</li>
          </ul>
        </div>

        <div className={`${styles.footCol} ${styles.footColWide}`}>
          <h3 className={styles.footHead}>{updates.title}</h3>
          <p className={styles.footNote}>{updates.note}</p>
          {/* suppressHydrationWarning on both controls: this is an email
              field, so form-filler extensions target it hardest, stamping an
              `fdprocessedid` attribute on before React hydrates and tripping
              the mismatch check. Both elements are entirely static markup —
              there is no client-only value here for the check to protect. */}
          <form className={styles.mailForm} action={updates.action} method="get">
            <input
              className={styles.mailInput}
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder={updates.placeholder}
              aria-label="Email address"
              suppressHydrationWarning
            />
            <button
              className={`${styles.btn} ${styles.mailBtn}`}
              type="submit"
              suppressHydrationWarning
            >
              {updates.submit}
            </button>
          </form>
        </div>
      </div>

      <div className={styles.footStrip}>
        <span className={styles.label}>
          © {year} {legalName}
        </span>
        <span className={`${styles.label} ${styles.footStripMid}`}>{footLeft}</span>
        <span className={`${styles.label} ${styles.footStripEnd}`}>{footRight}</span>
      </div>

      <p className={styles.closeMark} aria-hidden="true">
        {mark.replace(/\.$/, '')}
        <span>.</span>
      </p>
    </section>
  );
}
