import type { Metadata } from 'next';
import Link from 'next/link';
import PortalHero from '@/components/portal/PortalHero';
import styles from '@/components/portal/portal.module.css';
import { ASSET_CLASSES, INSTRUMENTS, Word, countIn } from '@/components/portal/marketData';

/**
 * Platform overview — the middle entry in the three-link bar.
 *
 * Also the way in to /classes and /sessions, which came off the top nav
 * when it went to Markets · Platform · Contact. If you retire this page,
 * re-home those two links or they are footer-only.
 *
 * CONTENT RULES (same as marketData.ts — this fronts a live brokerage):
 * every row below names a surface that EXISTS in this repo. No spreads,
 * leverage, fees, execution speeds, uptime, user counts or regulator
 * names — none of them are verifiable from here.
 */

export const metadata: Metadata = {
  title: 'Platform — PowerTradeFX',
  description:
    'Charts, orders, positions and risk on one screen, across forex, metals, indices, crypto and energy.',
};

/** Each row points at a real route in this app; `where` is that route. */
const SURFACES = [
  {
    n: 'Terminal',
    name: 'Chart and ticket',
    blurb:
      'The chart and the order ticket share a screen, so a position is placed against the candle you are reading rather than a separate order window.',
    where: '/trading/terminal',
  },
  {
    n: 'Watchlist',
    name: 'Your instruments',
    blurb:
      'The symbols you actually trade, kept beside the chart. Click one and the terminal follows it.',
    where: '/trading/terminal',
  },
  {
    n: 'Portfolio',
    name: 'Positions and margin',
    blurb:
      'Open positions, margin level and working orders on the same surface as everything else, so nothing about your exposure lives on another tab.',
    where: '/portfolio',
  },
  {
    n: 'Risk',
    name: 'Position calculator',
    blurb:
      'Work a position size out before you send it, rather than after the ticket is already filled.',
    where: '/risk-calculator',
  },
];

export default function PlatformPage() {
  return (
    <>
      <PortalHero
        src="/portal/platform_banner.png"
        alt="A hand holding a phone in landscape, a candlestick chart on its screen"
        title="One screen."
        eyebrow="Charts · Orders · Risk"
        lede="The chart, the order ticket, your open positions and your margin level all sit on the same surface, so the only thing you switch between is markets."
      />

      <header className={styles.pageHead}>
        <div className={styles.pageHeadInner}>
          <span className={styles.label}>Platform</span>
          <h1 className={styles.pageTitle}>One screen, one balance.</h1>
          <p className={styles.pageLede}>
            {Word(INSTRUMENTS.length)} instruments across {Word(ASSET_CLASSES.length)} asset classes,
            traded from a single account. The chart, the order ticket, your open positions and your
            margin level all sit on the same screen — so the only thing you are switching between is
            markets.
          </p>
        </div>
      </header>

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHead} style={{ marginBottom: 26 }}>
            <div>
              <span className={`${styles.label} ${styles.labelAmber}`}>01 — What you get</span>
              <h2 className={styles.sectionTitle}>On the screen</h2>
            </div>
            <span className={styles.label}>
              {String(SURFACES.length).padStart(2, '0')} surfaces
            </span>
          </div>

          <div className={styles.detailList}>
            {SURFACES.map((s) => (
              <div key={s.name} className={styles.detailRow}>
                <span className={`${styles.label} ${styles.labelAmber}`}>{s.n}</span>
                <span className={styles.detailName}>{s.name}</span>
                <p className={styles.detailBlurb}>{s.blurb}</p>
                <span className={styles.detailCount}>Signed in</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHead} style={{ marginBottom: 26 }}>
            <div>
              <span className={`${styles.label} ${styles.labelAmber}`}>02 — Coverage</span>
              <h2 className={styles.sectionTitle}>What you can trade</h2>
            </div>
            <span className={styles.label}>
              {String(ASSET_CLASSES.length).padStart(2, '0')} classes
            </span>
          </div>

          {/* Counted from marketData, never typed — add an instrument there
              and this page follows instead of quietly going stale. */}
          <div className={styles.detailList}>
            {ASSET_CLASSES.map((c) => (
              <div key={c.name} className={styles.detailRow}>
                <span className={`${styles.label} ${styles.labelAmber}`}>{c.tag}</span>
                <span className={styles.detailName}>{c.name}</span>
                <p className={styles.detailBlurb}>{c.blurb}</p>
                <span className={styles.detailCount}>
                  {String(countIn(c.name)).padStart(2, '0')} {c.unit}
                  {countIn(c.name) === 1 ? '' : 's'}
                </span>
              </div>
            ))}
          </div>

          <div className={styles.releasesActions}>
            <Link className={styles.btn} href="/markets">
              See the instruments
            </Link>
            <Link className={`${styles.btn} ${styles.btnQuiet}`} href="/classes">
              Asset classes in detail
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <span className={styles.label}>03 — The clock</span>
          <h2 className={styles.sectionTitle}>When it all trades</h2>
          <p className={styles.lede} style={{ marginTop: 18 }}>
            Forex has no single exchange — the day is handed between Sydney, Tokyo, London and New
            York, and liquidity follows that handover. Crypto ignores the schedule and trades
            through the weekend; index CFDs only move while their own exchange is open.
          </p>
          <div className={styles.releasesActions}>
            <Link className={styles.btn} href="/sessions">
              Market sessions
            </Link>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <span className={styles.label}>04 — Before you fund</span>
          <h2 className={styles.sectionTitle}>Try it on a demo first.</h2>
          <p className={styles.lede} style={{ marginTop: 18 }}>
            A demo account runs the same terminal against the same prices with practice funds, so
            you can learn where everything is without putting real money behind it.
          </p>
          <div className={styles.releasesActions}>
            <Link className={styles.btn} href="/auth/register">
              Open account
            </Link>
            <Link className={`${styles.btn} ${styles.btnQuiet}`} href="/contact">
              Talk to the desk
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
