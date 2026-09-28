'use client';

/**
 * Education → Market news.
 *
 * A preview of the layout of the News page inside the platform — an
 * economic calendar with impact levels plus live headlines. The cards
 * below are labelled examples with no dates or times: the live feed and
 * calendar are inside the platform after sign-in, and this page says so
 * rather than presenting stale headlines as news.
 */
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Calendar, TrendingUp, Info } from 'lucide-react';
import { Section, SectionHeading, PageHero, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

type Impact = 'High' | 'Medium' | 'Low';

const RISK_LINE =
  'Trading leveraged products such as forex and CFDs carries a high level of risk and may not be suitable for all investors. You could lose more than your initial deposit.';

/** Example rows — the kinds of headline the feed carries. No dates, no
 *  times, no figures: these are not news. */
const EXAMPLES: Array<{ title: string; category: string; summary: string; impact: Impact }> = [
  { title: 'Central bank rate decision',      category: 'Economy',     summary: 'A scheduled policy decision. Usually the highest-impact event of the week for the currency concerned.', impact: 'High' },
  { title: 'Inflation release (CPI)',         category: 'Economy',     summary: 'A monthly price-index print. Watch the pairs of the currency that reports, and the metals.',              impact: 'High' },
  { title: 'Employment report',               category: 'Economy',     summary: 'Monthly jobs data. Tends to move the reporting currency and the indices in the minutes after release.',  impact: 'High' },
  { title: 'Gold reacts to yields',           category: 'Commodities', summary: 'Example of a headline on XAUUSD tracking a move in real yields or the dollar.',                          impact: 'Medium' },
  { title: 'Oil inventories',                 category: 'Commodities', summary: 'A weekly stockpile release that touches USOIL and UKOIL.',                                               impact: 'Medium' },
  { title: 'Crypto market headline',          category: 'Crypto',      summary: 'BTC, ETH, LTC, SOL and XRP trade 24/7, so crypto headlines arrive outside forex hours too.',              impact: 'Medium' },
  { title: 'Major-pair technical note',       category: 'Forex',       summary: 'Example of a headline flagging a level on a pair such as EURUSD or GBPJPY.',                             impact: 'Low' },
  { title: 'Index earnings season',           category: 'Forex',       summary: 'Headlines that move US30, NAS100, GER40 and UK100 around company results.',                             impact: 'Low' },
];

const CATEGORIES = ['all', 'Forex', 'Commodities', 'Crypto', 'Economy'];

const CALENDAR_EXAMPLES = [
  { when: 'Example · morning',   title: 'Inflation release',   impact: 'High' as Impact },
  { when: 'Example · midday',    title: 'Central bank speech', impact: 'Medium' as Impact },
  { when: 'Example · afternoon', title: 'Rate decision',       impact: 'High' as Impact },
];

const QUICK_LINKS: { label: string; href: string }[] = [
  { label: 'Trader guides',                  href: '/education/blog' },
  { label: 'Market news & calendar overview', href: '/services/market-research' },
  { label: 'Learn to trade',                 href: '/services/education' },
  { label: 'The web terminal',               href: '/platforms/web' },
];

function impactColor(impact: Impact): string {
  if (impact === 'High') return 'var(--mk-down)';
  if (impact === 'Medium') return 'var(--mk-accent)';
  return 'var(--mk-up)';
}

export default function MarketNewsPage() {
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all' ? EXAMPLES : EXAMPLES.filter((item) => item.category === filter);

  return (
    <main>
      <PageHero
        kicker="Market news"
        title="Market news"
        lead="Live headlines and an economic calendar with impact levels are inside the platform, on the News page and in the terminal. This page shows the layout with example entries."
        primary={{ label: 'Try a free demo', href: '/auth/login' }}
        secondary={{ label: 'Open account', href: '/auth/register' }}
        image={{
          src: '/marketing/screens/news.png',
          alt: `${BRAND_NAME} news page with the economic calendar and live headlines`,
          width: 1600,
          height: 1000,
          priority: true,
        }}
      />

      <Section raised>
        <SectionHeading kicker="Layout preview" title="What the News page looks like" />

        {/* Honest note */}
        <div
          className="mx-auto mt-8 flex items-start gap-3"
          style={{
            maxWidth: '48rem',
            background: 'var(--mk-surface-2)',
            border: '1px solid var(--mk-line)',
            borderRadius: 'var(--mk-radius)',
            padding: 'var(--mk-space-4) var(--mk-space-5)',
          }}
        >
          <Info size={18} className="mt-0.5 shrink-0" style={{ color: 'var(--mk-accent)' }} />
          <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>
            The entries below are <strong>examples</strong> of the kinds of headline and calendar
            event the feed carries — they are not live and carry no dates. The live headlines and
            the calendar are inside the platform: sign in and open <strong>News</strong>, or use the
            news panel in the terminal.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 justify-center mt-10">
          {CATEGORIES.map((category) => {
            const active = filter === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setFilter(category)}
                aria-pressed={active}
                className="mk-btn"
                style={
                  active
                    ? { background: 'var(--mk-accent)', color: '#fff' }
                    : { border: '1px solid var(--mk-line-strong)', color: 'var(--mk-text-muted)' }
                }
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            );
          })}
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mt-10">
          <div className="lg:col-span-2 flex flex-col gap-5">
            {filtered.map((item) => (
              <article key={item.title} className="mk-card mk-card--hover flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span
                      className="rounded-full px-2.5 py-1 font-bold uppercase"
                      style={{
                        fontSize: '10px',
                        letterSpacing: '0.12em',
                        background: 'var(--mk-accent-soft)',
                        color: 'var(--mk-accent)',
                      }}
                    >
                      {item.category}
                    </span>
                    <span
                      className="rounded-full px-2.5 py-1 font-bold uppercase"
                      style={{
                        fontSize: '10px',
                        letterSpacing: '0.12em',
                        border: '1px solid var(--mk-line)',
                        color: 'var(--mk-text-faint)',
                      }}
                    >
                      Example
                    </span>
                  </div>
                  <span className="font-bold" style={{ fontSize: 'var(--mk-text-sm)', color: impactColor(item.impact) }}>
                    {item.impact} impact
                  </span>
                </div>
                <h3 className="mk-h3">{item.title}</h3>
                <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{item.summary}</p>
              </article>
            ))}
          </div>

          <aside className="flex flex-col gap-5" aria-label="Sidebar">
            <div className="mk-card flex flex-col gap-4">
              <h3 className="mk-h3 flex items-center gap-2">
                <TrendingUp size={18} style={{ color: 'var(--mk-accent)' }} />
                Economic calendar
              </h3>
              <div className="flex flex-col gap-4">
                {CALENDAR_EXAMPLES.map((c) => (
                  <div key={c.title} className="pb-4" style={{ borderBottom: '1px solid var(--mk-line)' }}>
                    <div className="flex items-center gap-1.5" style={{ fontSize: 'var(--mk-text-xs)', color: 'var(--mk-text-faint)' }}>
                      <Calendar size={12} /> {c.when}
                    </div>
                    <div className="font-bold mt-1" style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text)' }}>{c.title}</div>
                    <div style={{ fontSize: 'var(--mk-text-xs)', color: impactColor(c.impact) }}>{c.impact} impact</div>
                  </div>
                ))}
              </div>
              <p className="mk-meta" style={{ fontSize: 'var(--mk-text-xs)' }}>
                The live calendar, with real times and impact levels, is on the News page after sign-in.
              </p>
            </div>

            <div className="mk-card flex flex-col gap-4">
              <h3 className="mk-h3">Quick links</h3>
              <div className="flex flex-col gap-3">
                {QUICK_LINKS.map((l) => (
                  <Link key={l.href} href={l.href} className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>
                    → {l.label}
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </Section>

      {/* Inside the terminal */}
      <Section>
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div className="flex flex-col gap-4 items-start">
            <span className="mk-kicker">In the terminal</span>
            <h2 className="mk-h2">The same feed next to your chart</h2>
            <p className="mk-lead">
              Open the news panel in the web terminal and the calendar sits beside the chart and the
              order ticket. Set stop-loss and take-profit before a release and the engine holds them
              server-side through it.
            </p>
            <Link href="/trade" className="mk-btn mk-btn--ghost">Open the terminal</Link>
          </div>
          <Image
            src="/marketing/screens/terminal.png"
            alt={`${BRAND_NAME} web terminal with the economic-news panel`}
            width={1600}
            height={1000}
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="block h-auto w-full"
            style={{ borderRadius: 'var(--mk-radius-lg)', border: '1px solid var(--mk-line)' }}
          />
        </div>
        <p className="mk-meta" style={{ marginTop: 'var(--mk-space-8)', maxWidth: '72ch' }}>{RISK_LINE}</p>
      </Section>

      <CtaBanner
        title="See the live feed"
        lead="Sign in — or start on a $10,000 demo in one click — and open News."
        primary={{ label: 'Try a free demo', href: '/auth/login' }}
        secondary={{ label: 'Trader guides', href: '/education/blog' }}
      />
    </main>
  );
}
