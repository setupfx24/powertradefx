import type { Metadata } from 'next';
import PortalPage, { type PortalContent } from '@/components/portal/PortalPage';
import { portalFontClass } from '@/components/portal/fonts';
import { PORTAL_BRAND } from '@/components/portal/brand';
import {
  INSTRUMENTS,
  FEATURED_INSTRUMENTS,
  ASSET_CLASSES,
  classHref,
  countIn,
  hh,
  Word,
  SESSIONS,
} from '@/components/portal/marketData';

/**
 * Marketing home — the portal surface.
 *
 * Replaces the previous WebGL/liquid-metal landing. A server component:
 * the content below is a plain serialisable object handed to the client
 * component that owns the motion, so the page server-renders properly
 * instead of appearing only after hydration.
 *
 * CONTENT RULES for this page — it fronts a live brokerage:
 *   - No performance figures, user counts, awards, press quotes or
 *     regulator names. None of those are verifiable from this repo.
 *   - Instruments and asset classes come from what the platform actually
 *     lists (see components/trading/Watchlist.tsx).
 *   - Session times are standard market hours in UTC, not a claim.
 *   - The counts stated in the hero corners, the roster and the deck are
 *     internally consistent, and PortalPage asserts that in development.
 */

export const metadata: Metadata = {
  title: 'PowerTradeFX — Forex & CFD Trading',
  description:
    'Trade forex, metals, indices, crypto and energy from one account. Charts, orders and risk on a single screen.',
};

const content: PortalContent = {
  wordmark: PORTAL_BRAND.wordmark,

  /* Nav points at the real sub-pages, not in-page anchors — clicking a
     menu item navigates. The sections below keep their ids so the
     in-page buttons still work. */
  nav: { links: PORTAL_BRAND.links, cta: PORTAL_BRAND.cta, logo: PORTAL_BRAND.logo },

  hero: {
    cornerTL: 'Forex & CFD trading',
    cornerTR: `${Word(ASSET_CLASSES.length)} asset classes`,
    cornerBLa: `${Word(INSTRUMENTS.length)} instruments`,
    cornerBLb: '24/5 markets',
    cornerBR: 'Scroll to open',
  },

  statement: {
    label: '01 — The platform',
    lead: 'Charts, orders and risk sit on one screen, ',
    amber: 'so the only thing you are watching is the market',
    tail: '.',
    index: '01',
    /* Physics-driven words that drop on hover. The sentence is still in
       the server-rendered HTML and reduced-motion readers get it whole
       and static — see FallingText's header for how. */
    falling: true,
  },

  deck: {
    id: 'markets',
    label: '02 — Instruments',
    heading: `${Word(INSTRUMENTS.length)} markets, one account.`,
    lede:
      'Forex, metals, indices, crypto and energy, all from a single balance and one order ticket. Every position, margin level and open order stays on the same screen as the chart.',
    /* One action, deliberately. Sessions has its own fold further down
       (04) and a footer link, so a second button here competed with the
       one route this fold is actually about. */
    actions: [{ label: 'See all markets', href: '/markets' }],
    hint: 'Drag, tap the arrows, or use ← →',
    /* Three cards, not the whole catalogue — see FEATURED_CARDS, which also
       names each card's sleeve image. The heading above still counts
       INSTRUMENTS, and "See all markets" is where the full list lives. */
    items: FEATURED_INSTRUMENTS.map((i) => ({
      tag: i.klass,
      meta: i.kind,
      title: i.symbol,
      sub: i.name,
      group: i.klass,
      art: i.art,
    })),
  },

  roster: {
    id: 'classes',
    label: `03 — ${Word(ASSET_CLASSES.length)} classes`,
    heading: 'Asset classes',
    /* Counts are COUNTED, not typed — they can no longer disagree with
       the deck. PortalPage still asserts the tally in development. */
    rows: ASSET_CLASSES.map((c) => ({
      tag: c.tag,
      name: c.name,
      count: countIn(c.name),
      unit: c.unit,
      /* Makes the whole row a link to that class's page. Built from the
         shared helper so this and the route that answers it cannot drift. */
      href: classHref(c.slug),
    })),
  },

  table: {
    id: 'sessions',
    label: '04 — All times UTC',
    heading: 'Market sessions',
    headers: ['Session', 'Opens', 'Closes', 'In focus'],
    rows: SESSIONS.map((s) => ({
      a: s.city,
      b: hh(s.open),
      c: hh(s.close),
      d: s.focus,
      ...(s.peak ? { tone: 'low' as const } : {}),
    })),
  },

  close: {
    id: 'start',
    label: '05 — Get started',
    heading: 'Open an account.',
    fine: PORTAL_BRAND.riskWarning,
    actions: [
      { label: 'Open account', href: '/auth/register' },
      { label: 'Sign in', href: '/auth/login' },
    ],
    footLeft: PORTAL_BRAND.foot.left,
    footRight: PORTAL_BRAND.foot.right,
    mark: PORTAL_BRAND.mark,
  },

  /* No `plate`: the statement fold keeps its ambient wash but drops the
     circular dial. The Nocturne reference build still passes one. */
  art: { hero: '/portal/banner2.png' },
};

export default function Home() {
  /* The font class is applied HERE rather than in the route group's
     layout because that layout is a Client Component, and next/font
     loaders cannot be called from one. This page is a Server Component,
     so it is the correct place for it. */
  return (
    <div className={portalFontClass}>
      <PortalPage content={content} />
    </div>
  );
}
