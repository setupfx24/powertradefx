import type { Metadata } from 'next';
import PortalPage, { type PortalContent } from '@/components/portal/PortalPage';
import { portalFontClass } from '@/components/portal/fonts';

/**
 * Nocturne — the reference build of the portal design system.
 *
 * Kept alongside the marketing home so the design can be reviewed on
 * neutral content. Both routes render the SAME component; only this
 * object differs, so the two cannot drift apart.
 *
 * Content rule: only the label's own catalogue, roster and dates. No
 * press quotes, chart positions, streaming counts or award badges. The
 * release codes, dates and per-artist counts are internally consistent,
 * and PortalPage asserts the roster/catalogue tally in development.
 */

export const metadata: Metadata = {
  title: 'Nocturne — Record Label',
  description: 'Nocturne is an independent record label. Catalogue, roster and live dates.',
};

const content: PortalContent = {
  wordmark: { a: 'NOCT', b: 'URNE' },

  nav: {
    links: [
      { label: 'Catalogue', href: '#catalogue' },
      { label: 'Roster', href: '#roster' },
      { label: 'Dates', href: '#dates' },
    ],
    cta: { label: 'Send a demo', href: '#demos' },
  },

  hero: {
    cornerTL: 'Est. 2023',
    cornerTR: 'Independent record label',
    cornerBLa: 'Six releases',
    cornerBLb: 'Four artists',
    cornerBR: 'Scroll to open',
  },

  statement: {
    label: '01 — The label',
    lead: 'We press short runs of records that ',
    amber: 'reward a second listen',
    tail: ', and we leave the room in the recording.',
    index: '01',
  },

  deck: {
    id: 'catalogue',
    label: '02 — Catalogue',
    heading: 'Six records, in order.',
    lede:
      'Everything we have put out since 2023, newest last. Each one was cut from live takes and pressed in a single run — when a run is gone, it stays gone.',
    actions: [
      { label: 'See the dates', href: '#dates' },
      { label: 'Meet the roster', href: '#roster' },
    ],
    hint: 'Drag, or use ← → to flip',
    items: [
      { tag: 'NOC-001', meta: 'LP', title: 'Salt Flats', sub: 'Vela Ruiz — Mar 2023', group: 'Vela Ruiz' },
      { tag: 'NOC-002', meta: '12"', title: 'Low Country', sub: 'Ost & Nyre — Sep 2023', group: 'Ost & Nyre' },
      { tag: 'NOC-003', meta: 'LP', title: 'Nightjar', sub: 'Juno Fell — Feb 2024', group: 'Juno Fell' },
      { tag: 'NOC-004', meta: 'EP', title: 'Second Wind', sub: 'Vela Ruiz — Jun 2024', group: 'Vela Ruiz' },
      { tag: 'NOC-005', meta: 'LP', title: 'Paper Anchor', sub: 'Kessler Trio — Nov 2024', group: 'Kessler Trio' },
      { tag: 'NOC-006', meta: '12"', title: 'Hollow Season', sub: 'Juno Fell — Apr 2025', group: 'Juno Fell' },
    ],
  },

  roster: {
    id: 'roster',
    label: '03 — Four artists',
    heading: 'Roster',
    rows: [
      { tag: 'Lisbon', name: 'Vela Ruiz', count: 2, unit: 'release' },
      { tag: 'Leeds', name: 'Juno Fell', count: 2, unit: 'release' },
      { tag: 'Oslo', name: 'Ost & Nyre', count: 1, unit: 'release' },
      { tag: 'Ghent', name: 'Kessler Trio', count: 1, unit: 'release' },
    ],
  },

  table: {
    id: 'dates',
    label: '04 — Autumn 2026',
    heading: 'Live dates',
    headers: ['Date', 'City', 'Venue', 'Tickets'],
    rows: [
      { a: '12 Sep 2026', b: 'Berlin', c: 'Halle Nord', d: 'On sale' },
      { a: '19 Sep 2026', b: 'Amsterdam', c: 'De Kade', d: 'On sale' },
      { a: '03 Oct 2026', b: 'Copenhagen', c: 'Saltroom', d: 'On sale' },
      { a: '17 Oct 2026', b: 'Paris', c: 'La Fonderie', d: 'Few left', tone: 'low' },
      { a: '07 Nov 2026', b: 'London', c: 'The Lantern', d: 'Sold out', tone: 'out' },
      { a: '21 Nov 2026', b: 'Glasgow', c: 'Union Hall', d: 'On sale' },
    ],
  },

  close: {
    id: 'demos',
    label: '05 — Demos',
    heading: 'Send us a tape.',
    fine:
      'Two tracks is plenty. We listen to everything that arrives and reply either way, though it can take a few weeks. No stems, no pitch deck — just the songs.',
    actions: [
      { label: 'demos@', href: 'mailto:demos@example.com' },
      { label: 'Back to catalogue', href: '#catalogue' },
    ],
    footLeft: 'Nocturne — independent since 2023',
    footRight: 'Lisbon · Leeds · Oslo · Ghent',
    mark: 'NOCTURNE.',
  },

  art: { hero: '/label/hero.svg', plate: '/label/plate.svg' },
};

export default function NocturnePage() {
  return (
    <div className={portalFontClass}>
      <PortalPage content={content} />
    </div>
  );
}
