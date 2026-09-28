'use client';

/**
 * Public marketing page — How It Works.
 *
 * The trader journey on the live platform: Register → Try the demo →
 * Verify (KYC) → Fund → Trade → Withdraw. The comparison blocks name only
 * things the platform verifiably does; the "typical broker" column is
 * phrased as questions to ask, not claims about anyone else.
 */
import Image from 'next/image';
import {
  ServerCog, ShieldCheck, Headphones, Check, MonitorSmartphone, Layers, Users, Bot, BarChart3, Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

const RISK_LINE =
  'Trading leveraged products such as forex and CFDs carries a high level of risk and may not be suitable for all investors. You could lose more than your initial deposit.';

const STEPS = [
  { eyebrow: 'Step', title: 'Register',        body: 'Email and password, or sign in with Google. Have a referral code? Enter it at sign-up.' },
  { eyebrow: 'Step', title: 'Try the demo',    body: 'One click on the sign-in page provisions a $10,000 demo account — no email, no waiting.' },
  { eyebrow: 'Step', title: 'Verify (KYC)',    body: 'Upload a government ID, a selfie and proof of address. Required before your first withdrawal.' },
  { eyebrow: 'Step', title: 'Fund',            body: 'Deposit USDT on TRC20, BEP20 or ERC20, or by bank transfer / UPI through a payment link.' },
  { eyebrow: 'Step', title: 'Trade',           body: 'Open the web terminal: charts, watchlist, order ticket with SL/TP, positions and history — in any browser.' },
  { eyebrow: 'Step', title: 'Withdraw',        body: 'Request a withdrawal to USDT or bank/UPI from your wallet. Crypto is typically same-day; bank withdrawals are reviewed by our team.' },
];

const SCREENS = [
  { src: '/marketing/screens/register.png', alt: `${BRAND_NAME} sign-up page`,               caption: 'Register' },
  { src: '/marketing/screens/kyc.png',      alt: `${BRAND_NAME} KYC verification page`,      caption: 'Verify' },
  { src: '/marketing/screens/terminal.png', alt: `${BRAND_NAME} web trading terminal`,       caption: 'Trade' },
];

/** [feature, what PowerTradeFX does, what to ask any other broker]. The
 *  third column deliberately makes no claim about anyone else. */
const COMPARE: Array<[string, string, string]> = [
  ['Demo account',      '$10,000 in one click, no email',                                   'Is a form, email or call needed first?'],
  ['Order execution',   'Server-side; SL/TP keep working with the browser closed',          'Do pending orders live on the server or in the app?'],
  ['Order types',       'Market, limit, stop, stop-limit — SL/TP on every order',           'Which order types are available on web?'],
  ['Funding',           'USDT (TRC20 / BEP20 / ERC20), bank transfer / UPI',                'Which rails and currencies are supported?'],
  ['Copy trading',      'Built in — follow, allocate, stop any time',                       'Is it native or a third-party add-on?'],
  ['Bots and APIs',     'Algo Connector API + AI strategy builder included',                'Is API access included, and at what cost?'],
  ['Support',           'In-app tickets linked to your account, plus email',                'How do you reach a person?'],
];

const WHY: Array<{ icon: LucideIcon; title: string; sub: string }> = [
  { icon: MonitorSmartphone, title: 'Web terminal, any device', sub: 'TradingView charts, 100+ indicators, phone-friendly' },
  { icon: Layers,            title: '40+ instruments',          sub: 'forex, metals, indices, energy, crypto' },
  { icon: BarChart3,         title: 'Advanced order types',     sub: 'limit, stop, stop-limit, one-click trading' },
  { icon: Users,             title: 'Copy trading & PAMM',      sub: 'follow masters or invest with managers' },
  { icon: Bot,               title: 'AI & algo trading',        sub: 'strategy builder, backtests, bot API' },
  { icon: Wallet,            title: 'Multiple accounts',        sub: 'one login, internal transfers, full history' },
];

export default function HowItWorksPage() {
  return (
    <main>
      <PageHero
        kicker={`How ${BRAND_NAME} works`}
        title={<>From sign-up<br /><span style={{ color: 'var(--mk-accent)' }}>to your first withdrawal.</span></>}
        lead={`Six steps. Start on a demo in one click, verify when you are ready to withdraw, and trade from a web terminal that runs in any browser.`}
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'Try a free demo', href: '/auth/login' }}
      />

      {/* Demo vs live */}
      <Section raised>
        <SectionHeading
          align="left"
          kicker="Two ways in"
          title="Demo first, or straight to live"
          lead="Both use the same terminal, the same instruments and the same execution engine."
        />
        <div className="grid md:grid-cols-2 gap-5 mt-12">
          <ComparisonCard
            title="Demo account"
            tone="accent"
            items={[
              '$10,000 virtual balance, provisioned in one click',
              'No email, no KYC — just press "Try with demo" on sign-in',
              'Every instrument, order type and chart tool',
              'Cannot deposit or withdraw — it is for practice',
            ]}
          />
          <ComparisonCard
            title="Live account"
            tone="ok"
            items={[
              'Standard (commission-free) or Pro (tighter spreads, priority support)',
              'Open in-app; hold several accounts under one login',
              'Fund with USDT or bank transfer / UPI; low minimum deposit',
              'Complete KYC to unlock withdrawals',
            ]}
          />
        </div>
      </Section>

      {/* 6-step flow */}
      <Section id="flow">
        <SectionHeading
          align="left"
          kicker="The flow"
          title="Register, demo, verify, fund, trade, withdraw"
          lead="Each step happens inside your account — nothing is handled by email back-and-forth."
        />
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-12">
          {STEPS.map((s, i) => (
            <li key={s.title} className="mk-card mk-card--hover flex flex-col gap-2">
              <div className="mk-kicker">
                <span style={{ fontFamily: 'var(--mk-font-mono)' }}>{String(i + 1).padStart(2, '0')}</span>
                <span>{s.eyebrow}</span>
              </div>
              <h3 className="mk-h3">{s.title}</h3>
              <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{s.body}</p>
            </li>
          ))}
        </ol>

        {/* Real screens of the three steps that have a page of their own. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-12">
          {SCREENS.map((s) => (
            <figure key={s.src} className="flex flex-col gap-3">
              <Image
                src={s.src}
                alt={s.alt}
                width={1600}
                height={1000}
                sizes="(max-width: 768px) 100vw, 33vw"
                className="block h-auto w-full"
                style={{ borderRadius: 'var(--mk-radius)', border: '1px solid var(--mk-line)' }}
              />
              <figcaption className="mk-kicker">{s.caption}</figcaption>
            </figure>
          ))}
        </div>
      </Section>

      {/* What stays the same at every step */}
      <Section raised>
        <SectionHeading
          align="left"
          kicker="At every step"
          title="Three things that never change"
          lead="Whether you are on the demo or a funded Pro account."
        />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            { icon: ServerCog,   title: 'Server-side execution', body: 'Orders, stop-loss and take-profit are held by the engine, not your browser. Pending orders fill at the price you set.' },
            { icon: ShieldCheck, title: 'Account security',      body: 'Password plus optional two-factor authentication, Google sign-in, session protection and encrypted connections.' },
            { icon: Headphones,  title: 'Support in-app',        body: 'Open a ticket from your dashboard and it arrives linked to your account. Or email us — a person replies.' },
          ]}
        />
      </Section>

      {/* Comparison table */}
      <Section>
        <SectionHeading
          align="left"
          kicker="Side by side"
          title={`${BRAND_NAME} vs a typical broker`}
          lead="We can only vouch for our own column. The right-hand column is the list of questions worth asking anyone else."
        />
        <div
          className="mt-12 overflow-x-auto"
          style={{ border: '1px solid var(--mk-line)', borderRadius: 'var(--mk-radius-lg)' }}
        >
          <table className="w-full min-w-[560px]" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Feature', BRAND_NAME, 'A typical broker — what to ask'].map((h) => (
                  <th
                    key={h}
                    className="text-left px-5 py-4"
                    style={{
                      background: 'var(--mk-surface)',
                      color: 'var(--mk-accent)',
                      fontSize: 'var(--mk-text-label)',
                      letterSpacing: 'var(--mk-tracking-label)',
                      textTransform: 'uppercase',
                      fontWeight: 700,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((r) => (
                <tr key={r[0]} style={{ borderTop: '1px solid var(--mk-line)' }}>
                  <td className="px-5 py-4 font-semibold" style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text)' }}>{r[0]}</td>
                  <td className="px-5 py-4" style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text)' }}>{r[1]}</td>
                  <td className="px-5 py-4" style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text-muted)' }}>{r[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Why trade here */}
      <Section raised>
        <SectionHeading kicker="Why here" title={`What you get with ${BRAND_NAME}`} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-12">
          {WHY.map(({ icon: Icon, title, sub }) => (
            <div key={title} className="mk-card mk-card--hover flex items-center gap-4">
              <span
                className="inline-flex h-12 w-12 items-center justify-center rounded-xl shrink-0"
                style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
              >
                <Icon size={22} />
              </span>
              <div className="min-w-0">
                <h3 className="mk-h3" style={{ fontSize: 'var(--mk-text-body)' }}>{title}</h3>
                <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text-faint)' }}>{sub}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mk-meta" style={{ marginTop: 'var(--mk-space-8)', maxWidth: '72ch' }}>{RISK_LINE}</p>
      </Section>

      <CtaBanner
        title="Start with the demo"
        lead="One click, $10,000, no email. Open a live account when you are ready."
        primary={{ label: 'Try a free demo', href: '/auth/login' }}
        secondary={{ label: 'Open account', href: '/auth/register' }}
      />
    </main>
  );
}

function ComparisonCard({
  title, items, tone,
}: { title: string; items: string[]; tone: 'ok' | 'accent' }) {
  const accent = tone === 'ok' ? 'var(--mk-up)' : 'var(--mk-accent)';
  return (
    <div className="mk-card flex flex-col gap-4">
      <h3 className="mk-h3" style={{ color: accent }}>{title}</h3>
      <ul className="flex flex-col gap-2.5">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2 mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>
            <Check size={15} className="mt-1 shrink-0" style={{ color: accent }} />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
