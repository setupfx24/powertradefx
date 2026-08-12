import type { Metadata } from 'next';
import Link from 'next/link';
import styles from '@/components/portal/portal.module.css';
import { SESSIONS, hh, type Session } from '@/components/portal/marketData';

export const metadata: Metadata = {
  title: 'Market sessions — PowerTradeFX',
  description:
    'The four forex trading sessions in UTC — Sydney, Tokyo, London and New York — and where they overlap.',
};

/**
 * A session that opens at 22:00 and closes at 07:00 crosses midnight, so
 * on a 0–24 track it is TWO segments, not one. Returning a list keeps the
 * wrap-around case honest instead of drawing a bar backwards.
 */
function segments(s: Session): { left: number; width: number }[] {
  const pct = (h: number) => (h / 24) * 100;
  if (s.open < s.close) {
    return [{ left: pct(s.open), width: pct(s.close - s.open) }];
  }
  return [
    { left: pct(s.open), width: pct(24 - s.open) },
    { left: 0, width: pct(s.close) },
  ];
}

const TICKS = [0, 6, 12, 18, 24];

export default function SessionsPage() {
  return (
    <>
      <header className={styles.pageHead}>
        <div className={styles.pageHeadInner}>
          <span className={styles.label}>Sessions</span>
          <h1 className={styles.pageTitle}>The trading day.</h1>
          <p className={styles.pageLede}>
            Forex has no single exchange, so the day is handed between four regional sessions. All
            times below are UTC — check them against your own clock, and remember they shift when
            local daylight saving does.
          </p>
        </div>
      </header>

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <span className={styles.label}>Across one day</span>
          <h2 className={styles.sectionTitle}>Where each session sits</h2>
        </div>

        <div className={styles.rail} style={{ marginTop: 34 }}>
          {SESSIONS.map((s) => (
            <div key={s.city} className={styles.railRow}>
              <span className={styles.railCity}>{s.city}</span>
              <div className={styles.railTrack}>
                {segments(s).map((seg) => (
                  <span
                    key={`${s.city}-${seg.left}`}
                    className={`${styles.railSeg} ${s.peak ? styles.railSegPeak : ''}`}
                    style={{ left: `${seg.left}%`, width: `${seg.width}%` }}
                  />
                ))}
              </div>
              <span className={styles.railHours}>
                {hh(s.open)}–{hh(s.close)}
              </span>
            </div>
          ))}

          <div className={styles.railScale}>
            <div className={styles.railTicks}>
              {TICKS.map((t) => (
                <span key={t} className={styles.label}>
                  {hh(t % 24)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <span className={styles.label}>In detail</span>
          <h2 className={styles.sectionTitle}>Sessions and their focus</h2>
        </div>
        <div className={styles.sectionInner} style={{ marginTop: 30 }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Session</th>
                <th scope="col">Opens</th>
                <th scope="col">Closes</th>
                <th scope="col">In focus</th>
              </tr>
            </thead>
            <tbody>
              {SESSIONS.map((s) => (
                <tr key={s.city}>
                  <td>{s.city}</td>
                  <td>{hh(s.open)}</td>
                  <td>{hh(s.close)}</td>
                  <td>
                    <span className={`${styles.status} ${s.peak ? styles.statusLow : ''}`}>
                      {s.focus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <span className={styles.label}>Overlaps</span>
          <h2 className={styles.sectionTitle}>Where two sessions meet</h2>
          <p className={styles.lede} style={{ marginTop: 18 }}>
            London and New York are both open between 13:00 and 17:00 UTC — the one window in the
            day when the two largest sessions run at once. Tokyo and London brush past each other
            at 08:00–09:00, and Sydney hands over to Tokyo at midnight.
          </p>
          <p className={styles.lede} style={{ marginTop: 14 }}>
            Crypto ignores all of this and trades through the weekend; index CFDs only move while
            their own exchange is open.
          </p>
          <div className={styles.releasesActions}>
            <Link className={styles.btn} href="/markets">
              See the instruments
            </Link>
            <Link className={`${styles.btn} ${styles.btnQuiet}`} href="/classes">
              Asset classes
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
