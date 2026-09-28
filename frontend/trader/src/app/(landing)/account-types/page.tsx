'use client';

/**
 * Account types — the destination of the primary `Trading` nav item.
 *
 * Layout kept from the 2026-09-02 reference: hero + wide product shot,
 * platform surfaces, a tabbed "key features" block, trading conditions,
 * the Demo / Standard / Pro specification table, FAQs and a "try these
 * next" row. Copy speaks to the trader; every figure is either a verified
 * platform fact or a tier figure already published on the tier pages.
 */
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { Section, SectionHeading, PageHero, CtaBanner, FaqAccordion } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

const RISK_LINE =
  'Trading leveraged products such as forex and CFDs carries a high level of risk and may not be suitable for all investors. You could lose more than your initial deposit.';

/** Our own platform surfaces — all browser-based, nothing to install. */
const PLATFORMS = [
  {
    name: 'Web terminal',
    href: '/platforms/web',
    body: 'The full terminal in any modern browser: TradingView charts, order ticket, positions and account panel. Nothing to install.',
    image: '/marketing/screens/dashboard.png',
    alt: `${BRAND_NAME} dashboard in a desktop browser`,
    portrait: false,
  },
  {
    name: 'Mobile trading',
    href: '/download',
    body: 'The same terminal in a phone browser, with a mobile order sheet. Add it to your home screen and it opens like an app.',
    image: '/marketing/screens/terminal-phone.png',
    alt: `${BRAND_NAME} in a phone browser`,
    portrait: true,
  },
];

/* ── Key features, as a tab set ────────────────────────────────────── */
const FEATURE_TABS: { label: string; lead: string; points: string[]; image: string; alt: string }[] = [
  {
    label: 'Charts',
    lead: 'TradingView charts with live pricing.',
    points: [
      '100+ indicators, drawing tools and timeframes from 1 minute to 1 month',
      'Watchlist with live bid, ask and spread',
      'One-click trading widget on the chart',
      'Stop-loss and take-profit editable straight from the chart',
    ],
    image: '/marketing/screens/terminal.png',
    alt: `${BRAND_NAME} web terminal, dark theme`,
  },
  {
    label: 'Orders',
    lead: 'Your orders keep working when your browser is closed.',
    points: [
      'Market, limit, stop and stop-limit orders',
      'Stop-loss and take-profit on every order, executed server-side',
      'Limits fill at the limit price; a stop-limit converts to a limit when the stop is hit',
      'Positions, pending orders and closed-trade history panels',
    ],
    image: '/marketing/screens/terminal-light.png',
    alt: `${BRAND_NAME} web terminal, light theme`,
  },
  {
    label: 'Accounts',
    lead: 'Run more than one account from a single login.',
    points: [
      'Live and demo accounts side by side',
      'Standard and Pro live accounts, opened from inside the app',
      'A $10,000 demo account in one click, no email',
      'Transfer funds between your accounts and your wallet at any time',
    ],
    image: '/marketing/screens/accounts.png',
    alt: `${BRAND_NAME} accounts page showing a demo account and the Open Account button`,
  },
];

/* ── Trading conditions ────────────────────────────────────────────── */
const CONDITIONS = [
  { q: 'Spreads and commission', a: 'Standard accounts are commission-free and pay only the spread. Pro accounts get tighter spreads with a fixed per-lot commission. The cost of every order is shown on the ticket before you confirm.' },
  { q: 'Leverage and margin',    a: 'Leverage is flexible up to 1:500; the default is 1:100. Required margin is calculated per position and your balance, equity, margin, free margin and margin level are always visible in the terminal. Higher leverage increases both potential gains and potential losses.' },
  { q: 'Execution',              a: 'Orders, stop-loss and take-profit are executed server-side by our engine, so they stay active whether or not you are signed in. Pending orders fill at the requested price.' },
  { q: 'Market hours',           a: 'Crypto trades 24/7. Forex, metals, indices and energy follow their market hours, shown on each instrument in the terminal.' },
];

const TRADING_FAQ = [
  { q: 'Which account should I start with?', a: 'Most traders start on Standard: low minimum deposit, no commission, and every feature of the platform. If you trade often or in size, Pro’s tighter spreads with a $3.5 per-lot commission usually work out cheaper. Not sure? Start on the free $10,000 demo.' },
  { q: 'Can I hold more than one account?', a: 'Yes. You can open several live accounts under one login, keep a demo alongside them, and transfer funds between accounts and your main wallet at any time.' },
  { q: 'How do I fund my account?', a: 'Deposit by crypto — USDT on TRC20, BEP20 or ERC20 — or by local banking through a bank transfer / UPI payment link. Withdrawals go to USDT or bank / UPI; crypto is typically same-day and bank withdrawals are reviewed by our team. Demo accounts cannot deposit.' },
  { q: 'Do I need to verify my identity?', a: 'You can open an account and trade a demo without it. To withdraw, complete KYC in the app with a government ID, a selfie and proof of address.' },
  { q: 'Do I need to install anything?', a: `No. ${BRAND_NAME} runs in any modern browser on desktop, tablet or phone. You can add it to your phone’s home screen for an app-like experience, and a desktop terminal for Windows and macOS is available on request.` },
];

const NEXT_STEPS = [
  { title: 'Explore markets',  body: 'Forex, metals, indices, energy and crypto — 40+ instruments.',     href: '/markets' },
  { title: 'Try a free demo',  body: 'A $10,000 demo account in one click from the login page.',          href: '/auth/login' },
  { title: 'Copy trading',     body: 'Follow master traders and mirror their trades automatically.',       href: '/platforms/copy-trading' },
];

const INSTRUMENTS = ['Forex', 'Metals', 'Indices', 'Energy', 'Crypto'];

const COLUMN_HEADERS = ['Demo', 'Standard', 'Pro'];

const FEATURE_ROWS: Array<{ label: string; values: React.ReactNode[] }> = [
  { label: 'Minimum deposit',   values: ['None', '$100', '$5,000'] },
  { label: 'Virtual funds',     values: ['$10,000', '—', '—'] },
  { label: 'Spread',            values: ['Live spreads', 'From 1.1 pips', 'From 0.0 pips'] },
  { label: 'Commission',        values: ['None', 'None', '$3.5 / lot'] },
  { label: 'Leverage',          values: ['Up to 1:500', 'Up to 1:500', 'Up to 1:500'] },
  { label: 'Lot size from',     values: ['0.01', '0.01', '0.01'] },
  {
    label: 'Instruments',
    values: [0, 1, 2].map((i) => (
      <div key={i} className="flex flex-wrap justify-center gap-1.5 max-w-[220px] mx-auto">
        {INSTRUMENTS.map((inst) => (
          <span
            key={inst}
            className="px-2.5 py-0.5"
            style={{
              fontSize: 'var(--mk-text-xs)',
              borderRadius: 'var(--mk-radius-pill)',
              border: '1px solid var(--mk-line)',
              background: 'var(--mk-surface-2)',
              color: 'var(--mk-text-muted)',
            }}
          >
            {inst}
          </span>
        ))}
      </div>
    )),
  },
  { label: 'Order types',       values: ['Market, limit, stop, stop-limit', 'Market, limit, stop, stop-limit', 'Market, limit, stop, stop-limit'] },
  { label: 'Stop-loss / take-profit', values: ['Server-side', 'Server-side', 'Server-side'] },
  { label: 'Deposits',          values: ['Not available', 'USDT (TRC20, BEP20, ERC20), bank / UPI', 'USDT (TRC20, BEP20, ERC20), bank / UPI'] },
  { label: 'Withdrawals',       values: ['Not available', 'USDT or bank / UPI', 'USDT or bank / UPI'] },
  { label: 'Copy trading',      values: ['—', 'Yes', 'Yes'] },
  { label: 'AI Strategy Builder & Algo API', values: ['Yes', 'Yes', 'Yes'] },
  { label: 'Support',           values: ['In-app & email', 'In-app & email', 'Priority'] },
  { label: 'Sign-up',           values: ['One click, no email', 'Register, then open in-app', 'Register, then open in-app'] },
];

export default function AccountTypesPage() {
  const [tab, setTab] = useState(0);
  const active = FEATURE_TABS[tab] ?? FEATURE_TABS[0]!;

  return (
    <main>
      <PageHero
        kicker="Account types"
        title="Demo, Standard or Pro"
        lead="Start on a free $10,000 demo, trade commission-free on Standard, or take tighter spreads with Pro. Same terminal, same execution, one login."
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'Try a free demo', href: '/auth/login' }}
        image={{
          src: '/marketing/screens/accounts.png',
          alt: `${BRAND_NAME} accounts page showing an active demo account with $10,000 equity`,
          width: 1600,
          height: 1000,
          priority: true,
        }}
      />

      {/* ── Our platforms ─────────────────────────────────────────────── */}
      <Section>
        <SectionHeading title="Where you trade" />
        <div
          className="grid grid-cols-1 md:grid-cols-2"
          style={{ gap: 'var(--mk-space-5)', marginTop: 'var(--mk-space-7)' }}
        >
          {PLATFORMS.map((p) => (
            <Link key={p.name} href={p.href} className="mk-card mk-card--hover flex flex-col gap-5">
              <div
                className="relative w-full overflow-hidden"
                style={{ aspectRatio: '3 / 2', borderRadius: 'var(--mk-radius)', background: 'var(--mk-surface-2)' }}
              >
                <Image
                  src={p.image}
                  alt={p.alt}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className={p.portrait ? 'object-contain' : 'object-cover object-top'}
                />
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="mk-h3">{p.name}</h3>
                <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{p.body}</p>
                <span className="mk-link" style={{ marginTop: 'var(--mk-space-2)' }}>
                  Explore {p.name.toLowerCase()}
                  <ArrowUpRight size={15} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      {/* ── Account cards ─────────────────────────────────────────────── */}
      <Section raised>
        <SectionHeading title="Three account types" lead="Every account trades the same 40+ instruments on the same terminal." />
        <div
          className="grid grid-cols-1 md:grid-cols-3"
          style={{ gap: 'var(--mk-space-5)', marginTop: 'var(--mk-space-7)' }}
        >
          {[
            { name: 'Demo',     href: '/accounts/demo',     price: '$10,000 virtual', body: 'One click on the login page. No email, no card. Full terminal on live prices.' },
            { name: 'Standard', href: '/accounts/standard', price: 'From $100',       body: 'Commission-free, competitive spreads, leverage up to 1:500. The account most traders start on.', featured: true },
            { name: 'Pro',      href: '/accounts/pro',      price: 'From $5,000',     body: 'Spreads from 0.0 pips with $3.5 per lot, and priority support.' },
          ].map((a) => (
            <Link
              key={a.name}
              href={a.href}
              className="mk-card mk-card--hover flex flex-col gap-3"
              style={a.featured ? { borderColor: 'var(--mk-accent-line)' } : undefined}
            >
              <span className="mk-kicker">{a.name}</span>
              <span className="font-extrabold" style={{ fontSize: 'var(--mk-text-h3)', color: 'var(--mk-text)', lineHeight: 1.15 }}>
                {a.price}
              </span>
              <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{a.body}</p>
              <span className="mk-link" style={{ marginTop: 'auto' }}>
                See the {a.name} account
                <ArrowUpRight size={15} />
              </span>
            </Link>
          ))}
        </div>
      </Section>

      {/* ── Key features (tabbed) ─────────────────────────────────────── */}
      <Section>
        <SectionHeading title={`Key features of the ${BRAND_NAME} terminal`} />

        <div
          className="flex flex-wrap justify-center"
          style={{ gap: 'var(--mk-space-2)', marginTop: 'var(--mk-space-6)' }}
          role="tablist"
          aria-label="Platform features"
        >
          {FEATURE_TABS.map((t, i) => {
            const isActive = i === tab;
            return (
              <button
                key={t.label}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setTab(i)}
                className="mk-btn"
                style={
                  isActive
                    ? { background: 'var(--mk-ink)', color: '#fff' }
                    : {
                        background: '#fff',
                        color: 'var(--mk-text-muted)',
                        border: '1px solid var(--mk-line-strong)',
                      }
                }
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 'var(--mk-space-7)' }}>
          <p className="mk-lead" style={{ maxWidth: '68ch' }}>{active.lead}</p>
          <ul className="flex flex-col" style={{ gap: 'var(--mk-space-3)', marginTop: 'var(--mk-space-5)' }}>
            {active.points.map((point) => (
              <li key={point} className="flex items-start" style={{ gap: 'var(--mk-space-3)' }}>
                <CheckCircle2 size={18} style={{ color: 'var(--mk-accent)', flexShrink: 0, marginTop: 2 }} />
                <span className="mk-body" style={{ color: 'var(--mk-text)' }}>{point}</span>
              </li>
            ))}
          </ul>
          <div
            className="overflow-hidden"
            style={{
              borderRadius: 'var(--mk-radius)',
              border: '1px solid var(--mk-line)',
              marginTop: 'var(--mk-space-7)',
            }}
          >
            {/* `key` forces a fresh <img> per tab so switching tabs cannot
                show the previous image while the next one decodes. */}
            <Image
              key={active.image}
              src={active.image}
              alt={active.alt}
              width={1600}
              height={1000}
              sizes="(max-width: 1200px) 100vw, 1140px"
              className="block h-auto w-full"
            />
          </div>
        </div>
      </Section>

      {/* ── Trading conditions ────────────────────────────────────────── */}
      <Section raised>
        <SectionHeading
          title="Trading conditions"
          lead="Spreads, leverage and execution — the terms behind every position you open."
        />
        <div
          className="grid grid-cols-1 items-start lg:grid-cols-2"
          style={{ gap: 'var(--mk-space-8)', marginTop: 'var(--mk-space-7)' }}
        >
          <FaqAccordion items={CONDITIONS} />
          <div
            className="overflow-hidden"
            style={{ borderRadius: 'var(--mk-radius)', border: '1px solid var(--mk-line)' }}
          >
            <Image
              src="/marketing/screens/dashboard-light.png"
              alt={`${BRAND_NAME} dashboard, light theme`}
              width={1600}
              height={1000}
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="block h-auto w-full"
            />
          </div>
        </div>
      </Section>

      {/* ── Full specification table ──────────────────────────────────── */}
      <Section id="comparison" raised>
        <SectionHeading kicker="Specifications" title="Account comparison" />
        <div className="overflow-x-auto" style={{ marginTop: 'var(--mk-space-7)' }}>
          <table className="w-full min-w-[720px] border-collapse text-center">
            <thead>
              <tr>
                <th
                  className="text-left"
                  style={{
                    padding: 'var(--mk-space-3) var(--mk-space-4)',
                    borderBottom: '1px solid var(--mk-line)',
                    fontSize: 'var(--mk-text-sm)',
                    color: 'var(--mk-text-faint)',
                    fontWeight: 600,
                  }}
                >
                  Feature
                </th>
                {COLUMN_HEADERS.map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: 'var(--mk-space-3) var(--mk-space-4)',
                      borderBottom: '1px solid var(--mk-line)',
                      fontSize: 'var(--mk-text-body)',
                      fontWeight: 700,
                      color: 'var(--mk-text)',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FEATURE_ROWS.map((row) => (
                <tr key={row.label}>
                  <td
                    className="text-left"
                    style={{
                      padding: 'var(--mk-space-4)',
                      borderBottom: '1px solid var(--mk-line)',
                      fontSize: 'var(--mk-text-sm)',
                      color: 'var(--mk-text-muted)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.label}
                  </td>
                  {row.values.map((v, i) => (
                    <td
                      key={i}
                      style={{
                        padding: 'var(--mk-space-4)',
                        borderBottom: '1px solid var(--mk-line)',
                        fontSize: 'var(--mk-text-sm)',
                        color: 'var(--mk-text)',
                      }}
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap justify-center gap-3" style={{ marginTop: 'var(--mk-space-6)' }}>
          <Link href="/auth/register" className="mk-btn mk-btn--primary">Open account</Link>
          <Link href="/auth/login" className="mk-btn mk-btn--ghost">Try a free demo</Link>
        </div>
      </Section>

      {/* ── FAQs ──────────────────────────────────────────────────────── */}
      <Section>
        <SectionHeading title="Account FAQs" />
        <div className="mx-auto" style={{ maxWidth: 820, marginTop: 'var(--mk-space-7)' }}>
          <FaqAccordion items={TRADING_FAQ} />
        </div>
      </Section>

      {/* ── Try these next ────────────────────────────────────────────── */}
      <Section raised>
        <SectionHeading title="Try these next" />
        <div
          className="grid grid-cols-1 sm:grid-cols-3"
          style={{ gap: 'var(--mk-space-5)', marginTop: 'var(--mk-space-7)' }}
        >
          {NEXT_STEPS.map((s) => (
            <Link key={s.title} href={s.href} className="mk-card mk-card--hover flex flex-col gap-2">
              <h3 className="mk-h3">{s.title}</h3>
              <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{s.body}</p>
              <span className="mk-link" style={{ marginTop: 'var(--mk-space-2)' }}>
                Learn more
                <ArrowUpRight size={15} />
              </span>
            </Link>
          ))}
        </div>
      </Section>

      <Section className="mk-section--tight">
        <p
          className="mk-body mx-auto text-center"
          style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text-muted)', maxWidth: '70ch' }}
        >
          <strong>Risk warning:</strong> {RISK_LINE}
        </p>
      </Section>

      <CtaBanner
        title="Same terminal, your choice of account"
        lead="Open a live account in minutes, or start on a $10,000 demo with one click."
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'Try a free demo', href: '/auth/login' }}
      />
    </main>
  );
}
