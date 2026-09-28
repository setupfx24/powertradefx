'use client';

import {
  Users, BarChart3, Wallet, ShieldCheck, Award, Layers, FileText, Target, Percent, Eye,
} from 'lucide-react';
import {
  Section, SectionHeading, PageHero, FeatureGrid, CtaBanner, FaqAccordion,
} from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Services → PAMM — managed accounts.
 *
 * Two audiences: investors who want to allocate to an approved manager,
 * and traders who want to manage a pool. Only what the /pamm page does
 * is described: approved managers sorted by ROI, in-app applications
 * that are reviewed, performance-fee based. No minimums, fee rates or
 * lock-ups are quoted because none are fixed on the marketing side.
 */

const RISK_LINE =
  'Trading leveraged products such as forex and CFDs carries a high level of risk and may not be suitable for all investors. You could lose more than your initial deposit.';

const INVESTOR_POINTS = [
  'Browse approved managers, sorted by ROI',
  'Allocate an amount you choose from a live account',
  'Gains and losses are shared in proportion to your share of the pool',
  'Pay a performance fee only — set by the manager and shown up front',
  'Track the manager and your allocation from your dashboard',
];

const MANAGER_POINTS = [
  'Apply in-app from the PAMM page',
  'Applications are reviewed before a manager is listed',
  'Trade one pooled account; allocation is handled by the platform',
  'Earn a performance fee on the returns you generate',
  'Your ROI is visible to investors on the PAMM page',
];

/** Inline illustration: several investor wallets feeding one pooled
 *  account run by a manager. Brand colours only; no external image. */
function PoolArt() {
  const ink = 'var(--mk-ink)';
  const accent = 'var(--mk-accent)';
  const line = 'var(--mk-line-strong)';
  const investors = [40, 120, 200, 280, 360];
  return (
    <svg viewBox="0 0 400 240" role="img" aria-label="Investors allocating into one pooled PAMM account" className="w-full h-auto">
      {investors.map((x) => (
        <g key={x}>
          <rect x={x - 22} y={20} width={44} height={30} rx={6} fill="var(--mk-surface-2)" stroke={line} />
          <rect x={x - 12} y={30} width={24} height={4} rx={2} fill={ink} opacity={0.5} />
          <rect x={x - 12} y={38} width={16} height={4} rx={2} fill={ink} opacity={0.3} />
          <path d={`M ${x} 50 C ${x} 90, 200 90, 200 128`} fill="none" stroke={accent} strokeWidth={1.5} opacity={0.7} />
        </g>
      ))}
      <rect x={120} y={128} width={160} height={72} rx={10} fill={ink} />
      <rect x={136} y={144} width={56} height={6} rx={3} fill="#fff" opacity={0.85} />
      <rect x={136} y={158} width={96} height={5} rx={2.5} fill="#fff" opacity={0.4} />
      <polyline points="136,190 156,182 172,186 190,172 210,176 232,164 262,168" fill="none" stroke={accent} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={262} cy={168} r={3.5} fill={accent} />
      <text x={200} y={226} textAnchor="middle" fontSize="11" fill="var(--mk-text-faint)" fontFamily="var(--mk-font-mono)">investors → pooled account → manager</text>
    </svg>
  );
}

export default function PortfolioManagementPage() {
  return (
    <main>
      <PageHero
        kicker="PAMM"
        title="PAMM — managed accounts"
        lead="Invest with an approved manager who trades a pooled account, or apply to manage one yourself. Performance-fee based; sorted by ROI; run from inside your account."
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'For managers', href: '#managers' }}
      />

      {/* Investors vs managers */}
      <Section raised id="managers">
        <SectionHeading
          kicker="Two sides"
          title="For investors and for managers"
          lead="One pooled account. Investors put capital in; a reviewed manager trades it; results are shared by share of the pool."
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-12">
          <article className="mk-card mk-card--hover flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span
                className="inline-flex h-12 w-12 items-center justify-center rounded-xl shrink-0"
                style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
              >
                <Users size={22} />
              </span>
              <div>
                <h3 className="mk-h3">Investors</h3>
                <div
                  style={{
                    fontSize: 'var(--mk-text-label)',
                    letterSpacing: 'var(--mk-tracking-label)',
                    textTransform: 'uppercase',
                    color: 'var(--mk-text-faint)',
                  }}
                >
                  Allocate to a manager
                </div>
              </div>
            </div>
            <p className="mk-body">
              Pick a manager from the PAMM page, allocate from your live account, and your share of
              the pool follows their trading. You do not place trades; you choose who does.
            </p>
            <ul className="flex flex-col gap-2.5">
              {INVESTOR_POINTS.map((b) => (
                <li key={b} className="flex items-start gap-2 mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>
                  <span className="mt-2 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: 'var(--mk-accent)' }} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="mk-card mk-card--hover flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span
                className="inline-flex h-12 w-12 items-center justify-center rounded-xl shrink-0"
                style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
              >
                <BarChart3 size={22} />
              </span>
              <div>
                <h3 className="mk-h3">Managers</h3>
                <div
                  style={{
                    fontSize: 'var(--mk-text-label)',
                    letterSpacing: 'var(--mk-tracking-label)',
                    textTransform: 'uppercase',
                    color: 'var(--mk-text-faint)',
                  }}
                >
                  Trade a pooled account
                </div>
              </div>
            </div>
            <p className="mk-body">
              Already trade your own account well? Apply to manage a pool. Once reviewed and
              approved, investors can allocate to you and you earn a performance fee on what you
              return.
            </p>
            <ul className="flex flex-col gap-2.5">
              {MANAGER_POINTS.map((b) => (
                <li key={b} className="flex items-start gap-2 mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>
                  <span className="mt-2 h-1.5 w-1.5 rounded-full shrink-0" style={{ background: 'var(--mk-accent)' }} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </Section>

      {/* Illustration band */}
      <Section>
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div className="mx-auto w-full" style={{ maxWidth: 460 }}>
            <PoolArt />
          </div>
          <div className="flex flex-col gap-4 items-start">
            <span className="mk-kicker">How the pool works</span>
            <h2 className="mk-h2">One account, many shares</h2>
            <p className="mk-lead">
              Every investor&apos;s allocation becomes a share of a single pooled account. The manager
              trades that account; when it gains or loses, each investor&apos;s balance moves in
              proportion to their share. The manager&apos;s performance fee is taken from the gains they
              produce, not from your capital.
            </p>
          </div>
        </div>
      </Section>

      {/* Benefits grid */}
      <Section raised>
        <SectionHeading kicker="What you get" title="What the PAMM page handles for you" />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            { icon: Award,       title: 'Reviewed managers',      body: 'Managers apply in-app and are reviewed before they are listed. You choose from approved managers only.' },
            { icon: Eye,         title: 'ROI in the open',        body: 'The PAMM page sorts managers by ROI, so you compare like with like before you allocate.' },
            { icon: Percent,     title: 'Performance fee only',   body: 'Managers are paid a performance fee on the returns they generate. The rate is shown before you allocate.' },
            { icon: ShieldCheck, title: 'No access to your wallet', body: 'A manager trades the pool. Deposits and withdrawals on your account are always yours to make.' },
            { icon: Layers,      title: 'Allocate across managers', body: 'Nothing stops you spreading capital across more than one manager, or keeping a separate account for your own trading.' },
            { icon: BarChart3,   title: 'Track it from your dashboard', body: 'Your allocation and the manager\'s performance are visible in your account alongside your other balances.' },
          ]}
        />
      </Section>

      {/* How to start */}
      <Section>
        <SectionHeading kicker="Getting started" title="How to start as an investor" />
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-12">
          {[
            { n: '01', icon: Wallet,    title: 'Open and fund a live account', body: 'PAMM needs a live account. Deposit with USDT or bank transfer / UPI from your wallet.' },
            { n: '02', icon: Users,     title: 'Choose a manager',             body: 'Open the PAMM page, compare approved managers by ROI and read their performance-fee terms.' },
            { n: '03', icon: FileText,  title: 'Allocate',                     body: 'Choose the amount. It becomes your share of the manager\'s pooled account.' },
            { n: '04', icon: Target,    title: 'Track it',                     body: 'Follow the pool\'s performance and your share from your dashboard.' },
          ].map(({ n, icon: Icon, title, body }) => (
            <li key={n} className="mk-card mk-card--hover flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span
                  className="font-extrabold"
                  style={{ fontSize: 'var(--mk-text-h2)', color: 'var(--mk-accent)', lineHeight: 1 }}
                >
                  {n}
                </span>
                <span
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl shrink-0"
                  style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
                >
                  <Icon size={20} />
                </span>
              </div>
              <h3 className="mk-h3">{title}</h3>
              <p className="mk-body">{body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* FAQ */}
      <Section raised id="faq">
        <SectionHeading kicker="Questions" title="FAQ" />
        <div className="mt-12 mx-auto max-w-3xl">
          <FaqAccordion
            items={[
              {
                q: 'Can a manager withdraw my funds?',
                a: <>No. A manager trades the pooled account; they have no access to your wallet. Deposits and withdrawals on your account can only be made by you.</>,
              },
              {
                q: 'How is the performance fee charged?',
                a: <>Each manager sets a performance fee, shown on their listing before you allocate. It is taken from the returns the manager generates for the pool. There is no fee on losses.</>,
              },
              {
                q: 'How is PAMM different from copy trading?',
                a: <>With copy trading you follow a master and their trades are mirrored into your own account, with an allocation you control per trade. With PAMM your capital joins a pooled account that the manager trades directly, and results are shared by your share of the pool. Both need a live account.</>,
              },
              {
                q: 'How do I become a manager?',
                a: <>Apply from the PAMM page inside your account. Applications are reviewed; approved managers are listed with their ROI and fee terms for investors to compare.</>,
              },
              {
                q: 'Can I lose money in a PAMM?',
                a: <>Yes. A pooled account is traded with leverage like any other. If the manager loses, your share of the pool falls with it. Allocate only what you can afford to lose.</>,
              },
            ]}
          />
        </div>
        <p className="mk-meta mx-auto text-center" style={{ marginTop: 'var(--mk-space-8)', maxWidth: '72ch' }}>{RISK_LINE}</p>
      </Section>

      <CtaBanner
        title="See the managers"
        lead={`Open a ${BRAND_NAME} account and go to the PAMM page — approved managers, sorted by ROI.`}
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'Compare with copy trading', href: '/platforms/copy-trading' }}
      />
    </main>
  );
}
