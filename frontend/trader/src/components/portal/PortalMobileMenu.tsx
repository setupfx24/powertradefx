'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import styles from './portal.module.css';
import type { PortalLink } from './PortalNav';

/**
 * The nav for phones and small tablets.
 *
 * Exists because `.navLinks` is `display: none` below 860px and nothing
 * replaced it — every route in the bar simply vanished on a phone, so
 * Markets, Platform and Contact were unreachable there. The CTA was the
 * only thing left, which meant the only path off the home page on mobile
 * was to open an account.
 *
 * A separate CLIENT component rather than a directive on PortalNav: that
 * component documents itself as stateless-on-purpose so it can compile as
 * a Server Component under the sub-page layouts. Keeping the one piece of
 * state here preserves that — this is the only part of the bar that ships
 * to the browser.
 *
 * Button and sheet are both hidden above 860px in CSS, so on desktop this
 * renders markup that is never shown and never interactive (the button is
 * `display: none`, so it is out of the tab order too).
 */
export default function PortalMobileMenu({
  links,
  cta,
  active,
}: {
  links: PortalLink[];
  cta: PortalLink;
  /** Route of the current page, so its row can be marked. */
  active?: string;
}) {
  const [open, setOpen] = useState(false);
  const sheetId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  /* Escape closes, and the page behind must not scroll while the sheet is
     over it — on iOS a scrollable body under a fixed overlay is what makes
     an open menu feel broken. Both are torn down together so neither can
     outlive the sheet. */
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        // Send focus back to the control that opened it, or the trigger is
        // lost and the next Tab starts from the top of the document.
        buttonRef.current?.focus();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  /* A resize past the breakpoint would otherwise leave `open` true with the
     sheet hidden by CSS — and the body still locked from the effect above. */
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 861px)');
    const onChange = () => {
      if (mq.matches) setOpen(false);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return (
    <>
      {/* suppressHydrationWarning: form-filler extensions stamp an
          `fdprocessedid` attribute onto every button before React hydrates,
          which the mismatch check then reports. Every attribute here comes
          from `open`, whose initial value is the same on both sides, so the
          check has nothing else to catch on this element. */}
      <button
        ref={buttonRef}
        type="button"
        className={styles.navBurger}
        aria-expanded={open}
        aria-controls={sheetId}
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => setOpen((v) => !v)}
        suppressHydrationWarning
      >
        {/* Two bars that cross into an X. Strokes rather than glyphs so the
            state change animates instead of swapping characters. Each bar
            names its own resting class — see the note in the stylesheet on
            why :nth-of-type would break the open state. */}
        <span
          className={`${styles.burgerBar} ${
            open ? styles.burgerBarTop : styles.burgerBarA
          }`}
        />
        <span
          className={`${styles.burgerBar} ${
            open ? styles.burgerBarBottom : styles.burgerBarB
          }`}
        />
      </button>

      {/* Rendered even when closed so the sheet can transition, and hidden
          from assistive tech and the tab order with `inert`-equivalent
          attributes rather than being unmounted. */}
      <div
        id={sheetId}
        className={`${styles.navSheet} ${open ? styles.navSheetOpen : ''}`}
        hidden={!open}
      >
        <div className={styles.navSheetInner}>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`${styles.navSheetLink} ${
                active === l.href ? styles.navSheetLinkOn : ''
              }`}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </Link>
          ))}

          <Link
            href={cta.href}
            className={`${styles.btn} ${styles.navSheetCta}`}
            onClick={() => setOpen(false)}
          >
            {cta.label}
          </Link>
        </div>
      </div>

      {/* Tap-anywhere-to-close. Below the sheet, above the page. */}
      {open && (
        <button
          type="button"
          className={styles.navScrim}
          aria-label="Close menu"
          tabIndex={-1}
          onClick={() => setOpen(false)}
        />
      )}
    </>
  );
}
