'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  Bitcoin,
  Calculator,
  CandlestickChart,
  Check,
  Coins,
  Fuel,
  Gauge,
  LineChart,
  ListOrdered,
  Newspaper,
  ShieldCheck,
  SlidersHorizontal,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { LiveChartSection } from '@/home/components/LiveChartSection';
import { Section, SectionHeading, PageHero } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

const SIGNUP_HREF = '/auth/register';
const DEMO_HREF = '/auth/login';

/* ── Content ─────────────────────────────────────────────────────────
   The instrument directory is the page. Every symbol below is one the
   platform actually quotes; the per-class pages carry the detail. */

type MarketClass = {
  key: string;
  Icon: LucideIcon;
  title: string;
  hours: string;
  href: string;
  blurb: string;
  instruments: { symbol: string; name: string }[];
};

const CLASSES: MarketClass[] = [
  {
    key: 'forex',
    Icon: LineChart,
    title: 'Forex',
    hours: '24h, Mon–Fri',
    href: '/trading/forex',
    blurb: 'Majors, crosses and yen pairs.',
    instruments: [
      { symbol: 'EURUSD', name: 'Euro / US Dollar' },
      { symbol: 'GBPUSD', name: 'British Pound / US Dollar' },
      { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen' },
      { symbol: 'AUDUSD', name: 'Australian Dollar / US Dollar' },
      { symbol: 'USDCAD', name: 'US Dollar / Canadian Dollar' },
      { symbol: 'USDCHF', name: 'US Dollar / Swiss Franc' },
      { symbol: 'NZDUSD', name: 'New Zealand Dollar / US Dollar' },
      { symbol: 'EURGBP', name: 'Euro / British Pound' },
      { symbol: 'EURJPY', name: 'Euro / Japanese Yen' },
      { symbol: 'GBPJPY', name: 'British Pound / Japanese Yen' },
      { symbol: 'EURCHF', name: 'Euro / Swiss Franc' },
      { symbol: 'GBPCHF', name: 'British Pound / Swiss Franc' },
      { symbol: 'AUDJPY', name: 'Australian Dollar / Japanese Yen' },
      { symbol: 'CADJPY', name: 'Canadian Dollar / Japanese Yen' },
      { symbol: 'NZDJPY', name: 'New Zealand Dollar / Japanese Yen' },
      { symbol: 'USDHKD', name: 'US Dollar / Hong Kong Dollar' },
    ],
  },
  {
    key: 'metals',
    Icon: Coins,
    title: 'Metals',
    hours: 'Market hours, Mon–Fri',
    href: '/trading/commodities',
    blurb: 'Gold, silver, platinum and palladium against the dollar.',
    instruments: [
      { symbol: 'XAUUSD', name: 'Gold / US Dollar' },
      { symbol: 'XAGUSD', name: 'Silver / US Dollar' },
      { symbol: 'XPTUSD', name: 'Platinum / US Dollar' },
      { symbol: 'XPDUSD', name: 'Palladium / US Dollar' },
    ],
  },
  {
    key: 'indices',
    Icon: CandlestickChart,
    title: 'Indices',
    hours: 'Market hours, Mon–Fri',
    href: '/trading/indices',
    blurb: 'Wall Street, the Nasdaq, Frankfurt and London.',
    instruments: [
      { symbol: 'US30', name: 'Dow Jones Industrial Average' },
      { symbol: 'NAS100', name: 'Nasdaq 100' },
      { symbol: 'GER40', name: 'DAX 40' },
      { symbol: 'UK100', name: 'FTSE 100' },
    ],
  },
  {
    key: 'energy',
    Icon: Fuel,
    title: 'Energy',
    hours: 'Market hours, Mon–Fri',
    href: '/trading/commodities',
    blurb: 'The two crude benchmarks.',
    instruments: [
      { symbol: 'USOIL', name: 'WTI Crude Oil' },
      { symbol: 'UKOIL', name: 'Brent Crude Oil' },
    ],
  },
  {
    key: 'crypto',
    Icon: Bitcoin,
    title: 'Crypto',
    hours: '24/7',
    href: '/trading/crypto',
    blurb: 'Five coins against the dollar, every day of the week.',
    instruments: [
      { symbol: 'BTCUSD', name: 'Bitcoin / US Dollar' },
      { symbol: 'ETHUSD', name: 'Ethereum / US Dollar' },
      { symbol: 'LTCUSD', name: 'Litecoin / US Dollar' },
      { symbol: 'SOLUSD', name: 'Solana / US Dollar' },
      { symbol: 'XRPUSD', name: 'XRP / US Dollar' },
    ],
  },
];

/** Band 5 — the checklist inside the accent panel. */
const ACCOUNT_POINTS = [
  {
    title: 'One login, every market',
    body: 'Forex, metals, indices, energy and crypto in one terminal, with one balance, one history and one set of risk numbers.',
  },
  {
    title: 'Trade from any browser',
    body: 'The web terminal runs on desktop and phone browsers, and orders are executed server-side so they keep working when you close the tab.',
  },
  {
    title: 'Cost shown before you confirm',
    body: 'Live bid, ask and spread on the watchlist; margin, leverage and stop-loss / take-profit on the ticket.',
  },
];

/** Band 6 — trading conditions, three icon columns over a shared button. */
const CONDITIONS: { Icon: LucideIcon; title: string; body: string }[] = [
  {
    Icon: Gauge,
    title: 'Variable spreads, shown live',
    body: 'Spreads are variable and appear next to every symbol on the watchlist, so you see the cost before you trade.',
  },
  {
    Icon: SlidersHorizontal,
    title: 'Leverage up to 1:500',
    body: 'Default 1:100, set per account group up to 1:500. Lot sizes start at 0.01 on every instrument.',
  },
  {
    Icon: ListOrdered,
    title: 'Market, limit, stop, stop-limit',
    body: 'Four order types, each with a stop-loss and take-profit you can edit from the chart. Pending orders fill at your requested price.',
  },
];

/** Band 7 — supporting tools, split 3 + 2. */
type ToolItem = { Icon: LucideIcon; title: string; body: string; href: string };

const TOOLS_PRIMARY: ToolItem[] = [
  {
    Icon: CandlestickChart,
    title: 'TradingView charts',
    body: '100+ indicators, drawing tools and timeframes from one minute to one month on every instrument.',
    href: '/platforms/web',
  },
  {
    Icon: Calculator,
    title: 'Risk calculators',
    body: 'Margin, profit and loss, lot size and swap calculators, so you size a trade before you place it.',
    href: '/how-it-works',
  },
  {
    Icon: Newspaper,
    title: 'Economic calendar and news',
    body: 'Releases with impact levels plus live headlines, in the terminal and on their own page.',
    href: '/education/news',
  },
];

const TOOLS_SECONDARY: ToolItem[] = [
  {
    Icon: Zap,
    title: 'Copy trading',
    body: 'Follow master traders ranked by return, followers or Sharpe ratio, and mirror their trades with the allocation you choose.',
    href: '/platforms/copy-trading',
  },
  {
    Icon: ShieldCheck,
    title: 'Server-side protection',
    body: 'Stop-loss, take-profit and pending orders are executed by the engine, not your browser.',
    href: '/risk',
  },
];

/** Band 9 — the closing link list. */
const INTERESTED = [
  { title: 'How it works', body: 'From opening an account to placing your first trade, step by step.', href: '/how-it-works' },
  { title: 'Account types', body: 'Compare Standard and Pro accounts and the free $10,000 demo.', href: '/account-types' },
  { title: 'Deposits and withdrawals', body: 'Fund with USDT or local banking, withdraw to crypto or bank/UPI.', href: '/deposit-withdrawal' },
  { title: 'Risk management', body: 'How margin, stop-out and stop-loss orders work on the platform.', href: '/risk' },
  { title: `Why ${BRAND_NAME}`, body: 'What the platform gives you that a spreadsheet and a chart do not.', href: '/company/why-powertradefx' },
  { title: 'Frequently asked questions', body: 'Answers to the questions traders ask most before opening an account.', href: '/faq' },
];

/* ── Presentational pieces ─────────────────────────────────────────── */

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 'var(--mk-text-label)',
  letterSpacing: 'var(--mk-tracking-label)',
  textTransform: 'uppercase',
};

/** One summary tile per asset class. */
function ClassCard({ Icon, title, hours, href, blurb, instruments }: MarketClass) {
  return (
    <Link href={href} className="mk-card mk-card--hover flex h-full flex-col gap-3">
      <span
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl"
        style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
      >
        <Icon size={20} />
      </span>
      <div>
        <h3 className="mk-h3">{title}</h3>
        <p className="mt-1" style={{ ...LABEL_STYLE, color: 'var(--mk-text-faint)' }}>
          {instruments.length} instrument{instruments.length === 1 ? '' : 's'} · {hours}
        </p>
      </div>
      <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{blurb}</p>
      <span className="mk-link mt-auto pt-2" style={{ fontSize: 'var(--mk-text-sm)' }}>
        See {title.toLowerCase()}
        <ArrowUpRight size={14} />
      </span>
    </Link>
  );
}

/** The directory table, one group per class. */
function DirectoryTable() {
  const cell: React.CSSProperties = { fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text-muted)' };
  return (
    <div className="overflow-x-auto">
      <div
        className="min-w-[640px] overflow-hidden"
        style={{ border: '1px solid var(--mk-line)', borderRadius: 'var(--mk-radius-lg)' }}
      >
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Symbol', 'Instrument', 'Max leverage', 'Min lot', 'Trading hours'].map((h, i) => (
                <th
                  key={h}
                  className={i < 2 ? 'text-left px-5 py-4' : 'text-right px-5 py-4'}
                  style={{ ...LABEL_STYLE, background: 'var(--mk-surface-2)', color: 'var(--mk-accent)', fontWeight: 700 }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CLASSES.map((cls) => (
              <Fragment key={cls.key}>
                <tr style={{ borderTop: '1px solid var(--mk-line)', background: 'var(--mk-bg-raised)' }}>
                  <td colSpan={4} className="px-5 py-3 font-bold" style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text)' }}>
                    {cls.title}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link href={cls.href} className="mk-link" style={{ fontSize: 'var(--mk-text-xs)' }}>
                      Details
                      <ArrowUpRight size={12} />
                    </Link>
                  </td>
                </tr>
                {cls.instruments.map((ins) => (
                  <tr key={ins.symbol} style={{ borderTop: '1px solid var(--mk-line)', background: 'var(--mk-surface)' }}>
                    <td className="px-5 py-3 font-semibold" style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text)', fontFamily: 'var(--mk-font-mono)' }}>{ins.symbol}</td>
                    <td className="px-5 py-3" style={cell}>{ins.name}</td>
                    <td className="px-5 py-3 text-right" style={{ ...cell, fontFamily: 'var(--mk-font-mono)' }}>1:500</td>
                    <td className="px-5 py-3 text-right" style={{ ...cell, fontFamily: 'var(--mk-font-mono)' }}>0.01</td>
                    <td className="px-5 py-3 text-right" style={cell}>{cls.hours}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 mk-meta">
        Spreads are variable and shown live on the watchlist. Maximum leverage depends on your account group
        (default 1:100, up to 1:500). Crypto trades 24/7; forex, metals, indices and energy follow market hours.
      </p>
    </div>
  );
}

/** Icon, title, copy, with an optional "Find out more" underneath. */
function IconColumn({ Icon, title, body, href, cta }: {
  Icon: LucideIcon;
  title: string;
  body: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="flex h-full flex-col items-center gap-3 text-center">
      <span
        className="inline-flex h-11 w-11 items-center justify-center rounded-xl"
        style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
      >
        <Icon size={20} />
      </span>
      <h3 className="mk-h3">{title}</h3>
      <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{body}</p>
      {href && cta && (
        <div className="mt-auto pt-3">
          <Link href={href} className="mk-btn mk-btn--ghost mk-btn--sm">
            {cta}
            <ArrowUpRight size={14} />
          </Link>
        </div>
      )}
    </div>
  );
}

const TOTAL = CLASSES.reduce((n, c) => n + c.instruments.length, 0);

export default function MarketsPage() {
  return (
    <main>
      {/* ── 1. Hero ─────────────────────────────────────────────────── */}
      <PageHero
        kicker="Markets"
        title="Every market, one account"
        lead={`${TOTAL} instruments across forex, metals, indices, energy and crypto, traded from one ${BRAND_NAME} account with leverage up to 1:500 and lots from 0.01.`}
        primary={{ label: 'Open account', href: SIGNUP_HREF }}
        secondary={{ label: 'Try a free demo', href: DEMO_HREF }}
        image={{
          src: '/marketing/screens/terminal-light.png',
          alt: `The ${BRAND_NAME} web terminal in light mode, showing the watchlist, a chart and the order ticket`,
          width: 1600,
          height: 1000,
          priority: true,
        }}
      >
        <p className="mk-meta" style={{ marginTop: 'var(--mk-space-2)' }}>
          Already have an account?{' '}
          <Link href="/auth/login" className="underline underline-offset-2">Sign in</Link>
          {' '}and open the{' '}
          <Link href="/trade" className="underline underline-offset-2">terminal</Link>.
        </p>
      </PageHero>

      {/* ── 2. Asset classes ────────────────────────────────────────── */}
      <Section id="classes" raised>
        <SectionHeading
          title="Five asset classes"
          lead="Pick a class for its instruments, hours and the conditions that apply."
        />
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CLASSES.map((cls) => (
            <ClassCard {...cls} key={cls.key} />
          ))}
        </div>
      </Section>

      {/* ── 3. The instrument directory ─────────────────────────────── */}
      <Section id="directory">
        <SectionHeading
          kicker="Directory"
          title="Every instrument on the platform"
          lead="All of them are available on live and demo accounts, with the same charts, order types and margin rules."
        />
        <div className="mt-12">
          <DirectoryTable />
        </div>
      </Section>

      {/* ── 4. Live pricing, straight from the tape ─────────────────── */}
      <LiveChartSection />

      {/* ── 5. Split conversion panel ───────────────────────────────── */}
      <section className="mk-surface--accent">
        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* Stylised watchlist in place of a photo: a few live-style rows
              in brand colours, self-contained. Decorative. */}
          <div className="relative flex items-center justify-center" style={{ minHeight: 'clamp(260px, 30vw, 480px)', padding: 'var(--mk-space-7) var(--mk-space-5)' }}>
            <svg viewBox="0 0 520 320" aria-hidden className="w-full max-w-[520px] h-auto" style={{ display: 'block' }}>
              <rect x="0" y="0" width="520" height="320" rx="16" fill="rgba(255,255,255,0.10)" />
              <text x="24" y="36" fill="#ffffff" fontSize="13" fontWeight="700" fontFamily="var(--mk-font-mono)">WATCHLIST</text>
              <text x="496" y="36" textAnchor="end" fill="rgba(255,255,255,0.7)" fontSize="11" fontFamily="var(--mk-font-mono)">BID · ASK · SPREAD</text>
              {[
                ['EURUSD', '1.0842', '1.0843', '0.1'],
                ['XAUUSD', '2,318.40', '2,318.70', '0.3'],
                ['NAS100', '18,240.5', '18,241.7', '1.2'],
                ['USOIL', '78.42', '78.46', '0.04'],
                ['BTCUSD', '64,120', '64,150', '30'],
                ['GBPJPY', '196.12', '196.15', '0.3'],
              ].map(([sym, bid, ask, spr], i) => {
                const y = 64 + i * 40;
                return (
                  <g key={sym}>
                    <rect x="16" y={y - 14} width="488" height="32" rx="8" fill={i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.10)'} />
                    <text x="28" y={y + 5} fill="#ffffff" fontSize="12" fontWeight="700" fontFamily="var(--mk-font-mono)">{sym}</text>
                    <text x="300" y={y + 5} textAnchor="end" fill="rgba(255,255,255,0.9)" fontSize="12" fontFamily="var(--mk-font-mono)">{bid}</text>
                    <text x="400" y={y + 5} textAnchor="end" fill="rgba(255,255,255,0.9)" fontSize="12" fontFamily="var(--mk-font-mono)">{ask}</text>
                    <text x="492" y={y + 5} textAnchor="end" fill="rgba(255,255,255,0.7)" fontSize="12" fontFamily="var(--mk-font-mono)">{spr}</text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div
            className="flex flex-col justify-center"
            style={{
              padding: 'clamp(2rem, 1rem + 3.5vw, 4rem) clamp(1.5rem, 0.5rem + 3vw, 3.5rem)',
              gap: 'var(--mk-space-5)',
            }}
          >
            <h2 className="mk-h2">Everything from one account</h2>

            <ul className="flex flex-col" style={{ gap: 'var(--mk-space-4)' }}>
              {ACCOUNT_POINTS.map(({ title, body }) => (
                <li key={title} className="flex items-start" style={{ gap: 'var(--mk-space-3)' }}>
                  <span
                    aria-hidden
                    className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                    style={{ background: 'rgba(255, 255, 255, 0.2)', color: '#ffffff' }}
                  >
                    <Check size={12} strokeWidth={3} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-bold" style={{ fontSize: 'var(--mk-text-body)' }}>
                      {title}
                    </span>
                    <span
                      className="block"
                      style={{
                        fontSize: 'var(--mk-text-sm)',
                        lineHeight: 'var(--mk-leading-body)',
                        color: 'rgba(255, 255, 255, 0.82)',
                        marginTop: 2,
                      }}
                    >
                      {body}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex flex-wrap items-center" style={{ gap: 'var(--mk-space-3)' }}>
              <Link href={DEMO_HREF} className="mk-btn mk-btn--ghost">Try a free demo</Link>
              <Link href={SIGNUP_HREF} className="mk-btn mk-btn--primary">Open account</Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. Trading conditions ───────────────────────────────────── */}
      <Section raised>
        <SectionHeading
          title="Trading conditions"
          lead="The same rules on every instrument, shown on the order ticket before you confirm."
        />
        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
          {CONDITIONS.map((item) => (
            <IconColumn key={item.title} {...item} />
          ))}
        </div>
        <div className="mt-10 text-center">
          <Link href="/account-types" className="mk-btn mk-btn--ghost">
            Compare account types
            <ArrowUpRight size={16} />
          </Link>
        </div>
      </Section>

      {/* ── 7. Supporting tools (3 + 2) ─────────────────────────────── */}
      <Section>
        <SectionHeading title="Tools that come with the account" />
        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
          {TOOLS_PRIMARY.map((item) => (
            <IconColumn key={item.title} {...item} cta="Find out more" />
          ))}
        </div>
        <div className="mx-auto mt-10 grid max-w-[760px] grid-cols-1 gap-8 sm:grid-cols-2">
          {TOOLS_SECONDARY.map((item) => (
            <IconColumn key={item.title} {...item} cta="Find out more" />
          ))}
        </div>
      </Section>

      {/* ── 8. Full-width conversion band ───────────────────────────── */}
      <section className="mk-surface--accent mk-section">
        <div className="mk-container flex flex-col items-center gap-6 text-center">
          <h2 className="mk-h2">Trade all of it on one platform</h2>

          <div className="grid max-w-3xl grid-cols-1 gap-6 text-left sm:grid-cols-2">
            {[
              `${TOTAL} instruments across forex, metals, indices, energy and crypto, with leverage up to 1:500 and lots from 0.01.`,
              'A free $10,000 demo account in one click, no email needed, so you can try every market before you fund.',
            ].map((line) => (
              <p key={line} className="flex items-start" style={{ gap: 'var(--mk-space-3)' }}>
                <span
                  aria-hidden
                  className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                  style={{ background: 'rgba(255, 255, 255, 0.2)', color: '#ffffff' }}
                >
                  <Check size={12} strokeWidth={3} />
                </span>
                <span
                  style={{
                    fontSize: 'var(--mk-text-sm)',
                    lineHeight: 'var(--mk-leading-body)',
                    color: 'rgba(255, 255, 255, 0.9)',
                  }}
                >
                  {line}
                </span>
              </p>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center" style={{ gap: 'var(--mk-space-3)' }}>
            <Link href={SIGNUP_HREF} className="mk-btn mk-btn--primary mk-btn--lg">Open account</Link>
            <Link href={DEMO_HREF} className="mk-btn mk-btn--ghost mk-btn--lg">Try a free demo</Link>
          </div>
        </div>
      </section>

      {/* ── 9. Related reading ──────────────────────────────────────── */}
      <Section raised>
        <SectionHeading title="You might be interested in…" align="left" />
        <div className="mt-10 grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {INTERESTED.map(({ title, body, href }) => (
            <div key={title} className="flex flex-col gap-2">
              <Link href={href} className="mk-link">
                {title}
                <ArrowUpRight size={15} />
              </Link>
              <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{body}</p>
            </div>
          ))}
        </div>
      </Section>

      <div className="mk-container" style={{ paddingTop: 'var(--mk-space-6)', paddingBottom: 'var(--mk-space-8)' }}>
        <p className="mk-meta mx-auto max-w-3xl text-center">
          Trading leveraged products such as forex and CFDs carries a high level of risk and may not be suitable
          for all investors. You could lose more than your initial deposit.
        </p>
      </div>
    </main>
  );
}
