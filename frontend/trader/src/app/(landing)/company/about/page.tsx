import Link from 'next/link';
import {
  Scale, ServerCog, ShieldCheck, Headphones, Cpu, LifeBuoy, Handshake, Lock,
} from 'lucide-react';
import { CtaBanner } from '@/marketing/components';
import { BRAND_NAME, BRAND_SUPPORT_EMAIL } from '@/lib/brand';

/**
 * Company → About Us.
 *
 * Layout: an inset dark hero card with the page title over it, a
 * "Principles" band (two-tone statement + cards with dark icon tiles),
 * a role grid, and the shared closing CTA.
 *
 * Copy describes {BRAND_NAME} as what it is — an online multi-asset
 * broker / trading platform for traders. No founding year, no invented
 * history, no client counts: every fact here is something the live
 * platform actually does.
 */

const RISK_LINE =
  'Trading leveraged products such as forex and CFDs carries a high level of risk and may not be suitable for all investors. You could lose more than your initial deposit.';

const PRINCIPLES = [
  {
    icon: Scale,
    title: 'Transparent pricing',
    body: 'Live bid, ask and spread on every instrument in the watchlist. Standard accounts are commission-free; Pro accounts trade on tighter spreads. No hidden charges on deposits or withdrawals from our side.',
  },
  {
    icon: ServerCog,
    title: 'Server-side execution',
    body: 'Orders, stop-loss and take-profit are held and executed by the engine, not your browser. Close the tab, lose signal, switch device — your protection keeps working.',
  },
  {
    icon: ShieldCheck,
    title: 'Security first',
    body: 'Password plus optional two-factor authentication, Google sign-in, session protection and encrypted connections. Funds and trading data live on segregated infrastructure.',
  },
  {
    icon: Headphones,
    title: 'Real support',
    body: `In-app support tickets from your dashboard, or email ${BRAND_SUPPORT_EMAIL}. Questions about deposits, KYC or a trade go to a person, not a bot.`,
  },
];

/**
 * Role grid. Deliberately role-only: there is no roster to publish, and
 * inventing names and headshots would be fabricating credibility. Each
 * card carries an inline icon instead of a portrait.
 */
const TEAM = [
  { icon: Cpu,       role: 'Trading & execution', body: 'The engine, market data and the web terminal — pricing, order routing, margin and risk checks.' },
  { icon: LifeBuoy,  role: 'Client support',      body: 'Onboarding, KYC review, deposits and withdrawals, and every ticket that lands in the support queue.' },
  { icon: Handshake, role: 'Partnerships',        body: 'The IB and referral programme — partner approvals, commission reviews and payouts.' },
  { icon: Lock,      role: 'Security & platform', body: 'Infrastructure, account security, uptime and the tooling behind it all.' },
];

export default function AboutUsPage() {
  return (
    <main>
      {/* ── Hero: inset dark card with the title over it ──────────────── */}
      <section style={{ paddingTop: 'clamp(5.5rem, 4rem + 5vw, 7.5rem)' }}>
        <div className="mk-container">
          <div
            className="relative overflow-hidden flex flex-col items-center justify-center text-center"
            style={{
              background: 'var(--mk-ink)',
              borderRadius: 'var(--mk-radius-lg)',
              minHeight: 'clamp(18rem, 12rem + 22vw, 30rem)',
              padding: 'clamp(2rem, 1rem + 5vw, 5rem)',
            }}
          >
            <span
              className="mk-badge"
              style={{ color: 'rgba(255,255,255,0.72)', borderColor: 'rgba(255,255,255,0.22)' }}
            >
              Who we are
            </span>
            <h1
              className="mk-display"
              style={{ color: '#ffffff', marginTop: '1rem', maxWidth: '18ch' }}
            >
              A trading platform built for traders.
            </h1>
            <p
              className="mk-lead"
              style={{ color: 'rgba(255,255,255,0.7)', marginTop: '1rem', maxWidth: '52ch' }}
            >
              {BRAND_NAME} is an online multi-asset broker. You trade forex, metals, indices,
              energy and crypto from one account, in a web terminal that runs in any browser —
              with copy trading, PAMM, an AI strategy builder and a partner programme built in.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3" style={{ marginTop: '1.5rem' }}>
              <Link href="/auth/register" className="mk-btn mk-btn--primary mk-btn--lg">Open account</Link>
              <Link
                href="/auth/login"
                className="mk-btn mk-btn--lg"
                style={{ color: '#fff', border: '1px solid rgba(255,255,255,0.28)' }}
              >
                Try a free demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Principles ────────────────────────────────────────────────── */}
      <section className="mk-section">
        <div className="mk-container">
          <span className="mk-badge">Principles</span>

          {/* Two-tone statement: the emphasis carries in ink, the
              connective copy drops to muted. */}
          <p
            className="mk-display"
            style={{
              marginTop: 'var(--mk-space-5)',
              maxWidth: '26ch',
              fontSize: 'clamp(1.6rem, 1.1rem + 2.2vw, 2.75rem)',
              lineHeight: 1.18,
              letterSpacing: '-0.028em',
              color: 'var(--mk-text-muted)',
            }}
          >
            <span style={{ color: 'var(--mk-text)' }}>{BRAND_NAME} is built on a simple idea:</span>{' '}
            you should always know{' '}
            <span style={{ color: 'var(--mk-text)' }}>
              what you pay, how your order fills, and who to ask when something is unclear.
            </span>
          </p>

          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
            style={{ gap: 'var(--mk-space-5)', marginTop: 'var(--mk-space-8)' }}
          >
            {PRINCIPLES.map(({ icon: Icon, title, body }) => (
              <article key={title} className="mk-card flex flex-col" style={{ gap: 'var(--mk-space-5)' }}>
                <span
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center"
                  style={{
                    background: 'var(--mk-ink)',
                    color: 'var(--mk-text-invert)',
                    borderRadius: 'var(--mk-radius-sm)',
                  }}
                  aria-hidden
                >
                  <Icon size={19} />
                </span>
                <div className="flex flex-col" style={{ gap: 'var(--mk-space-2)' }}>
                  <h3 className="mk-h3">{title}</h3>
                  <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── What you can trade ────────────────────────────────────────── */}
      <section className="mk-section mk-section--tight-top">
        <div className="mk-container">
          <div
            className="grid grid-cols-2 md:grid-cols-4"
            style={{
              gap: 'var(--mk-space-5)',
              padding: 'var(--mk-space-6)',
              border: '1px solid var(--mk-line)',
              borderRadius: 'var(--mk-radius-lg)',
              background: 'var(--mk-surface)',
            }}
          >
            {[
              { n: '5',        label: 'asset classes — forex, metals, indices, energy, crypto' },
              { n: '40+',      label: 'instruments from one account' },
              { n: '1:500',    label: 'maximum leverage (default 1:100)' },
              { n: '$10,000',  label: 'instant demo balance, one click, no email' },
            ].map((s) => (
              <div key={s.label} className="flex flex-col" style={{ gap: 'var(--mk-space-1)' }}>
                <span className="mk-num" style={{ fontSize: 'var(--mk-text-h2)', color: 'var(--mk-accent)' }}>{s.n}</span>
                <span className="mk-meta">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Our team ──────────────────────────────────────────────────── */}
      <section className="mk-section mk-section--raised">
        <div className="mk-container">
          <span className="mk-badge">Our Team</span>

          <h2
            className="mk-h2"
            style={{ marginTop: 'var(--mk-space-5)', maxWidth: '20ch' }}
          >
            The people behind the platform
          </h2>
          <p className="mk-lead" style={{ marginTop: 'var(--mk-space-3)', maxWidth: '60ch' }}>
            Four teams, one product. Everyone here works on the platform you trade on.
          </p>

          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
            style={{ gap: 'var(--mk-space-5)', marginTop: 'var(--mk-space-7)' }}
          >
            {TEAM.map(({ icon: Icon, role, body }) => (
              <article key={role} className="mk-card mk-card--hover flex flex-col" style={{ gap: 'var(--mk-space-4)' }}>
                <span
                  className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
                  aria-hidden
                >
                  <Icon size={22} />
                </span>
                <div className="flex flex-col" style={{ gap: 'var(--mk-space-1)' }}>
                  <h3 className="mk-h3">{role}</h3>
                  <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{body}</p>
                </div>
              </article>
            ))}
          </div>

          <p className="mk-meta" style={{ marginTop: 'var(--mk-space-7)', maxWidth: '72ch' }}>
            {RISK_LINE}
          </p>
        </div>
      </section>

      <CtaBanner
        title="Trade with us"
        lead="Open a live account in minutes, or start on a $10,000 demo with one click."
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'Try a free demo', href: '/auth/login' }}
      />
    </main>
  );
}
