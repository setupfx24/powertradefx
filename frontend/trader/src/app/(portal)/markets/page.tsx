import type { Metadata } from 'next';
import PortalHero from '@/components/portal/PortalHero';
import styles from '@/components/portal/portal.module.css';
import { INSTRUMENTS, ASSET_CLASSES, countIn, Word } from '@/components/portal/marketData';

export const metadata: Metadata = {
  title: 'Markets — PowerTradeFX',
  description:
    'Every instrument PowerTradeFX lists: forex, metals, indices, crypto and energy, with the hours each one trades.',
};

export default function MarketsPage() {
  return (
    <>
      <PortalHero
        src="/portal/market_banner.png"
        alt="A fan of dark coins carrying currency symbols, lit in orange"
        title={`${Word(INSTRUMENTS.length)} markets.`}
        eyebrow="One account · One balance"
        lede="Forex, metals, indices, crypto and energy — every instrument below is quoted against the US dollar and traded from the same balance."
      />

      <header className={styles.pageHead}>
        <div className={styles.pageHeadInner}>
          <span className={styles.label}>Markets</span>
          <h1 className={styles.pageTitle}>Every instrument.</h1>
          <p className={styles.pageLede}>
            {Word(INSTRUMENTS.length)} instruments across {Word(ASSET_CLASSES.length).toLowerCase()}{' '}
            asset classes, all quoted against the US dollar and all traded from a single balance.
            Hours below are the market&rsquo;s own; see the sessions page for where the liquidity
            actually sits.
          </p>
        </div>
      </header>

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Symbol</th>
                <th scope="col">Instrument</th>
                <th scope="col">Class</th>
                <th scope="col">Hours</th>
              </tr>
            </thead>
            <tbody>
              {INSTRUMENTS.map((i) => (
                <tr key={i.symbol}>
                  <td>{i.symbol}</td>
                  <td>{i.name}</td>
                  <td>{i.klass}</td>
                  <td>
                    <span className={styles.status}>{i.hours}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <span className={styles.label}>By class</span>
          <h2 className={styles.sectionTitle}>How the list breaks down</h2>
        </div>
        <div className={styles.detailList} style={{ marginTop: 34 }}>
          {ASSET_CLASSES.map((c) => (
            <div key={c.name} className={styles.detailRow}>
              <span className={`${styles.label} ${styles.labelAmber}`}>{c.tag}</span>
              <span className={styles.detailName}>{c.name}</span>
              <p className={styles.detailBlurb}>
                {INSTRUMENTS.filter((i) => i.klass === c.name)
                  .map((i) => i.symbol)
                  .join(' · ')}
              </p>
              <span className={styles.detailCount}>
                {String(countIn(c.name)).padStart(2, '0')} {c.unit}
                {countIn(c.name) === 1 ? '' : 's'}
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
