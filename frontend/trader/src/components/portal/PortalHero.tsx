import ScrollExpand from '@/components/ScrollExpand';
import styles from './portal.module.css';

/**
 * The scroll-expanding hero shared by the portal sub-pages, so /markets,
 * /platform and /contact open the same way instead of each carrying its
 * own copy of ScrollExpand's twenty props.
 *
 * Tuning lives HERE — change the feel once and all three follow.
 *
 * Two things below are deliberate, not defaults:
 *
 *   - `useWindowScroll`. These are ordinary page sections, so the effect
 *     must track the window scroller. Without it the frame never moves.
 *   - scrollDistance/holdDistance below ScrollExpand's own defaults
 *     (1.2 / 0.35), which together cost ~2.5 viewports of scrolling
 *     before the page's real content is reachable.
 *
 * The overlay renders NO heading element. Every page that uses this puts
 * its <h1> in the .pageHead underneath, and a heading up here would sit
 * above it and invert the document outline.
 *
 * A Server Component: it only forwards props into the client component,
 * so nothing here needs to ship to the browser.
 */
export default function PortalHero({
  src,
  alt,
  title,
  eyebrow,
  lede,
  /** Falls back to nothing rather than a generic word, so a page can opt
   *  out of the hint without passing an empty string. */
  scrollHint = 'Scroll',
}: {
  src: string;
  alt: string;
  title: string;
  eyebrow: string;
  lede: string;
  scrollHint?: string;
}) {
  return (
    <ScrollExpand
      src={src}
      alt={alt}
      title={title}
      scrollHint={scrollHint}
      useWindowScroll
      startWidth={44}
      startHeight={60}
      startRadius={24}
      endRadius={0}
      mediaZoom={1.3}
      scrollDistance={0.9}
      holdDistance={0.15}
      overlayScrim={0.5}
    >
      <p className={styles.label} style={{ color: 'rgba(237, 231, 220, 0.72)' }}>
        {eyebrow}
      </p>
      <p className={styles.lede} style={{ color: '#ede7dc', maxWidth: '46ch', marginTop: 14 }}>
        {lede}
      </p>
    </ScrollExpand>
  );
}
