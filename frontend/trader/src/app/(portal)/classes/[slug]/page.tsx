import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import styles from '@/components/portal/portal.module.css';
import {
  ASSET_CLASSES,
  INSTRUMENTS,
  classBySlug,
  classHref,
  countIn,
  instrumentsIn,
} from '@/components/portal/marketData';

/**
 * One page per asset class, reached by clicking a row in the home-page
 * roster or on /classes.
 *
 * Everything on the page comes from ASSET_CLASSES — there is no per-slug
 * markup here, so adding a sixth class to marketData.ts gives it a page,
 * a sitemap entry and a linked roster row with no edit to this file.
 *
 * CONTENT RULES: the copy describes how these MARKETS work, which is
 * public knowledge. It says nothing about how this venue prices them —
 * no spreads, leverage, fees, execution claims or regulator names. See
 * the note on the AssetClass type.
 */

/* Five known slugs, so these render as static HTML at build time and an
   unknown slug 404s instead of being generated on demand. */
export const dynamicParams = false;

export function generateStaticParams() {
  return ASSET_CLASSES.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const klass = classBySlug(slug);
  if (!klass) return {};
  return {
    title: `${klass.name} — PowerTradeFX`,
    description: klass.blurb,
    alternates: { canonical: classHref(klass.slug) },
  };
}

export default async function AssetClassPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const klass = classBySlug(slug);
  /* dynamicParams=false already blocks unknown slugs, but this keeps the
     page honest if that flag is ever relaxed. */
  if (!klass) notFound();

  const rows = instrumentsIn(klass.name);
  const count = countIn(klass.name);

  /* Previous/next around the ring, so a reader can walk the whole set
     without going back to the index. */
  const idx = ASSET_CLASSES.findIndex((c) => c.slug === klass.slug);
  const prev = ASSET_CLASSES[(idx - 1 + ASSET_CLASSES.length) % ASSET_CLASSES.length]!;
  const next = ASSET_CLASSES[(idx + 1) % ASSET_CLASSES.length]!;

  return (
    <>
      <header className={styles.pageHead}>
        <div className={styles.pageHeadInner}>
          <span className={`${styles.label} ${styles.labelAmber}`}>
            {klass.tag} · {String(count).padStart(2, '0')} {klass.unit}
            {count === 1 ? '' : 's'}
          </span>
          <h1 className={styles.pageTitle}>{klass.name}</h1>
          <p className={styles.pageLede}>{klass.blurb}</p>
        </div>
      </header>

      {/* ── 1. What it is ─────────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <span className={styles.label}>01 — What it is</span>
          <h2 className={styles.sectionTitle}>How {klass.name.toLowerCase()} trades</h2>
          <p className={styles.lede} style={{ marginTop: 18 }}>
            {klass.how}
          </p>
          <p className={styles.lede} style={{ marginTop: 14 }}>
            <span className={`${styles.label} ${styles.labelAmber}`}>Clock — </span>
            {klass.clock}
          </p>
        </div>
      </section>

      {/* ── 2. The instruments ────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHead} style={{ marginBottom: 26 }}>
            <div>
              <span className={styles.label}>02 — On the platform</span>
              <h2 className={styles.sectionTitle}>
                What you can trade
              </h2>
            </div>
            <span className={styles.label}>
              {String(count).padStart(2, '0')} of {String(INSTRUMENTS.length).padStart(2, '0')}
            </span>
          </div>

          <div className={styles.detailList}>
            {rows.map((i) => (
              <div key={i.symbol} className={styles.detailRow}>
                <span className={`${styles.label} ${styles.labelAmber}`}>{i.kind}</span>
                <span className={styles.detailName}>{i.symbol}</span>
                <p className={styles.detailBlurb}>{i.name}</p>
                <span className={styles.detailCount}>{i.hours}</span>
              </div>
            ))}
          </div>

          <div className={styles.releasesActions}>
            <Link className={styles.btn} href="/markets">
              See every instrument
            </Link>
            <Link className={`${styles.btn} ${styles.btnQuiet}`} href="/sessions">
              When it trades
            </Link>
          </div>
        </div>
      </section>

      {/* ── 3. What moves it ──────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <div className={styles.sectionHead} style={{ marginBottom: 26 }}>
            <div>
              <span className={styles.label}>03 — What moves it</span>
              <h2 className={styles.sectionTitle}>Worth watching</h2>
            </div>
          </div>

          <div className={styles.detailList}>
            {klass.drivers.map((d, i) => (
              <div key={d.label} className={styles.detailRow}>
                {/* Index in the small column, not the label again — the
                    name already carries it in the display face. */}
                <span className={`${styles.label} ${styles.labelAmber}`}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className={styles.detailName}>{d.label}</span>
                <p className={styles.detailBlurb}>{d.text}</p>
                <span className={styles.detailCount} />
              </div>
            ))}
          </div>

          <p className={styles.lede} style={{ marginTop: 30 }}>
            None of the above is a signal, and none of it is advice — it is a list of what tends to
            be in the room when this market moves.
          </p>

          <div className={styles.releasesActions}>
            <Link className={styles.btn} href="/auth/register">
              Open account
            </Link>
            <Link className={`${styles.btn} ${styles.btnQuiet}`} href="/classes">
              All asset classes
            </Link>
          </div>
        </div>
      </section>

      {/* ── Walk the ring ─────────────────────────────────── */}
      <section className={styles.section}>
        <div className={styles.sectionInner}>
          <span className={styles.label}>More classes</span>
          <div className={styles.releasesActions}>
            <Link className={`${styles.btn} ${styles.btnQuiet}`} href={classHref(prev.slug)}>
              ← {prev.name}
            </Link>
            <Link className={`${styles.btn} ${styles.btnQuiet}`} href={classHref(next.slug)}>
              {next.name} →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
