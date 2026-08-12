import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '@/components/portal/portal.module.css';
import {
  ASSET_CLASSES,
  INSTRUMENTS,
  classHref,
  instrumentsIn,
  countIn,
} from '@/components/portal/marketData';

export const metadata: Metadata = {
  title: 'Asset classes — PowerTradeFX',
  description:
    'The five asset classes on PowerTradeFX — forex, metals, indices, crypto and energy — and what trading each one actually means.',
};

export default function ClassesPage() {
  return (
    <>
      <header className={styles.pageHead}>
        <div className={styles.pageHeadInner}>
          <span className={styles.label}>Classes</span>
          <h1 className={styles.pageTitle}>Five asset classes.</h1>
          <p className={styles.pageLede}>
            They differ in one thing that matters day to day: when they trade. Four follow the
            weekday rail and stop for the weekend, one never stops, and one only moves while its
            exchange is open.
          </p>
        </div>
      </header>

      {ASSET_CLASSES.map((c, idx) => (
        <section key={c.name} className={styles.section}>
          <div className={styles.sectionInner}>
            <div className={styles.sectionHead} style={{ marginBottom: 26 }}>
              <div>
                <span className={`${styles.label} ${styles.labelAmber}`}>
                  {String(idx + 1).padStart(2, '0')} — {c.tag}
                </span>
                {/* The heading is the way in to the class's own page —
                    same destination as the home-page roster row. */}
                <h2 className={styles.sectionTitle}>
                  <Link className={styles.rosterLink} href={classHref(c.slug)}>
                    {c.name}
                  </Link>
                </h2>
              </div>
              <span className={styles.label}>
                {String(countIn(c.name)).padStart(2, '0')} {c.unit}
                {countIn(c.name) === 1 ? '' : 's'}
              </span>
            </div>

            <p className={styles.lede}>{c.blurb}</p>

            <div className={styles.detailList} style={{ marginTop: 30 }}>
              {instrumentsIn(c.name).map((i) => (
                <div key={i.symbol} className={styles.detailRow}>
                  <span className={`${styles.label} ${styles.labelAmber}`}>{i.kind}</span>
                  <span className={styles.detailName}>{i.symbol}</span>
                  <p className={styles.detailBlurb}>{i.name}</p>
                  <span className={styles.detailCount}>{i.hours}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <span className={styles.label}>All together</span>
          <h2 className={styles.sectionTitle}>
            {INSTRUMENTS.length} instruments, one balance.
          </h2>
          <p className={styles.lede} style={{ marginTop: 18 }}>
            Positions across every class share the same account, so margin and open orders sit on
            one screen next to the chart.
          </p>
          <div className={styles.releasesActions}>
            <Link className={styles.btn} href="/markets">
              See the full list
            </Link>
            <Link className={`${styles.btn} ${styles.btnQuiet}`} href="/sessions">
              When they trade
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
