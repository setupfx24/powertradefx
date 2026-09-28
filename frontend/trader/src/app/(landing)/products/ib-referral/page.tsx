'use client';

import Link from 'next/link';
import {
  Users, BarChart3, Wallet, Zap, Award, Layers, Share2, Crown, Gem, Sparkles, Link2, Building2,
} from 'lucide-react';
import {
  Section, SectionHeading, PageHero, FeatureGrid, CtaBanner, FaqAccordion,
} from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Products → IB programme. The Introducing Broker / affiliate programme
 * for partners who bring traders to PowerTradeFX. Partners apply
 * in-app at /business after registering.
 */

/**
 * Commission tiers. Each tier is reached at an active-trader count and
 * carries a per-lot commission plus a one-off tier reward. Platinum is
 * the entry point for custom deals (up to $15 / lot).
 */
const IB_TIERS = [
  { tier: 'Bronze',   traders: '5+',   commission: '$5',  amount: '$500',    tone: '#cd7f32', Icon: Award },
  { tier: 'Silver',   traders: '20+',  commission: '$7',  amount: '$5,000',  tone: '#c0c0c0', Icon: Award },
  { tier: 'Gold',     traders: '50+',  commission: '$10', amount: '$20,000', tone: '#e8b923', Icon: Crown, featured: true },
  { tier: 'Platinum', traders: '100+', commission: '$12', amount: '$50,000', tone: '#e5e4e2', Icon: Gem },
];

function StatRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span
        style={{
          fontSize: 'var(--mk-text-label)',
          letterSpacing: 'var(--mk-tracking-label)',
          textTransform: 'uppercase',
          color: 'var(--mk-text-faint)',
        }}
      >
        {label}
      </span>
      <span className="font-bold tabular-nums" style={{ color: accent || 'var(--mk-text)' }}>
        {value}
      </span>
    </div>
  );
}

/** Inline network-tree illustration: you at the top, your traders and
 *  sub-partners below. Decorative; the copy beside it carries the meaning. */
function NetworkTree() {
  const nodes = {
    you: { x: 300, y: 48 },
    l1: [{ x: 140, y: 150 }, { x: 300, y: 150 }, { x: 460, y: 150 }],
    l2: [{ x: 80, y: 252 }, { x: 200, y: 252 }, { x: 400, y: 252 }, { x: 520, y: 252 }],
  };
  return (
    <svg viewBox="0 0 600 300" aria-hidden className="w-full h-auto" style={{ borderRadius: 'var(--mk-radius-lg)', display: 'block' }}>
      <rect x="0" y="0" width="600" height="300" fill="var(--mk-surface-2)" />
      {nodes.l1.map((n, i) => (
        <line key={`a${i}`} x1={nodes.you.x} y1={nodes.you.y} x2={n.x} y2={n.y} stroke="var(--mk-line-strong)" strokeWidth="2" />
      ))}
      {([[0, 0], [0, 1], [2, 2], [2, 3]] as const).map(([a, b]) => {
        const from = nodes.l1[a]!;
        const to = nodes.l2[b]!;
        return (
          <line key={`b${a}${b}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="var(--mk-line-strong)" strokeWidth="2" />
        );
      })}
      {/* you */}
      <circle cx={nodes.you.x} cy={nodes.you.y} r="22" fill="var(--mk-accent)" />
      <text x={nodes.you.x} y={nodes.you.y + 4} textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="700" fontFamily="var(--mk-font-mono)">YOU</text>
      {/* level 1: sub-partners and direct traders */}
      {nodes.l1.map((n, i) => (
        <g key={`n1${i}`}>
          <circle cx={n.x} cy={n.y} r="18" fill="var(--mk-bg)" stroke="var(--mk-ink)" strokeWidth="2" />
          <text x={n.x} y={n.y + 4} textAnchor="middle" fill="var(--mk-text)" fontSize="10" fontWeight="700" fontFamily="var(--mk-font-mono)">{i === 1 ? 'TRADER' : 'SUB-IB'}</text>
        </g>
      ))}
      {/* level 2: traders brought by sub-partners */}
      {nodes.l2.map((n, i) => (
        <g key={`n2${i}`}>
          <circle cx={n.x} cy={n.y} r="16" fill="var(--mk-bg)" stroke="var(--mk-text-faint)" strokeWidth="2" />
          <text x={n.x} y={n.y + 4} textAnchor="middle" fill="var(--mk-text-muted)" fontSize="9" fontWeight="700" fontFamily="var(--mk-font-mono)">TRADER</text>
        </g>
      ))}
      <text x="24" y="284" fill="var(--mk-text-faint)" fontSize="11" fontFamily="var(--mk-font-mono)">Commission on every lot in your network</text>
    </svg>
  );
}

export default function IbReferralPage() {
  return (
    <main>
      <PageHero
        kicker="IB programme"
        title="Earn on every lot your network trades"
        lead={`Become a ${BRAND_NAME} Introducing Broker. Share your link, bring traders and sub-partners on board, and earn a per-lot commission on every trade they place, tracked live in your partner dashboard.`}
        primary={{ label: 'Create your account', href: '/auth/register' }}
        secondary={{ label: 'See the tiers', href: '#tiers' }}
      />

      {/* How it works */}
      <Section raised id="how-it-works">
        <SectionHeading
          kicker="How it works"
          title={<>Three steps. <span style={{ color: 'var(--mk-accent)' }}>Then it runs itself.</span></>}
        />
        <ol className="grid sm:grid-cols-3 gap-5 mt-12" aria-label="How the IB programme works">
          {[
            { n: '01', icon: Users,  title: 'Register and apply', body: `Open a ${BRAND_NAME} account, then apply to the partner programme from the Business page inside the platform. Applications are reviewed by our team.` },
            { n: '02', icon: Share2, title: 'Share your link',     body: 'Once approved you get a personal referral link and code. Anyone who registers through it is attributed to you, permanently.' },
            { n: '03', icon: Wallet, title: 'Earn per lot',        body: 'Commission is calculated per lot the moment a referred trade fills and released to your balance when the trade closes. Request a payout whenever you like.' },
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

      {/* Multi-level network */}
      <Section>
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div className="flex flex-col gap-4">
            <span className="mk-kicker">Multi-level network</span>
            <h2 className="mk-h2">Your sub-partners grow your income too</h2>
            <p className="mk-lead">
              The programme is multi-level. Bring in another partner and you also earn on the traders they
              introduce, so your network compounds instead of capping out at the people you reach yourself.
            </p>
            <p className="mk-body">
              Your partner dashboard shows the whole tree: who is in your network, the volume they trade and what
              you have earned from it, updated live.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/auth/register" className="mk-btn mk-btn--primary">Create your account</Link>
              <Link href="/auth/login" className="mk-btn mk-btn--ghost">Already registered? Sign in</Link>
            </div>
          </div>
          <NetworkTree />
        </div>
      </Section>

      {/* Commission tiers */}
      <Section raised id="tiers">
        <SectionHeading
          kicker="Commission tiers"
          title={<>Bronze. Silver. <span style={{ color: 'var(--mk-accent)' }}>Gold.</span> Platinum.</>}
          lead={
            <>
              Your per-lot commission rises with the number of active traders in your network. Tiers are
              upgraded as you qualify. Top partners can unlock custom deals up to{' '}
              <span style={{ color: 'var(--mk-accent)', fontWeight: 700 }}>$15 per lot</span>.
            </>
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-12">
          {IB_TIERS.map(({ tier, traders, commission, amount, tone, Icon, featured }) => (
            <div key={tier} className={`relative ${featured ? 'mt-3 lg:mt-0' : ''}`}>
              {featured && (
                <div
                  className="absolute -top-3 right-6 z-10 inline-flex items-center gap-1 rounded-full px-3 py-1 font-bold uppercase whitespace-nowrap"
                  style={{ background: tone, color: '#0a0a0a', fontSize: '10px', letterSpacing: '0.12em' }}
                >
                  <Sparkles size={12} /> Most popular
                </div>
              )}
              <article
                className="mk-card mk-card--hover flex flex-col h-full gap-3"
                style={{ borderColor: `${tone}55` }}
              >
                <span
                  className="inline-flex h-12 w-12 items-center justify-center rounded-xl shrink-0"
                  style={{ background: `${tone}22`, border: `1px solid ${tone}55`, color: tone }}
                >
                  <Icon size={20} />
                </span>

                <div>
                  <h3 className="mk-h3" style={{ color: tone }}>{tier}</h3>
                  <div
                    style={{
                      fontSize: 'var(--mk-text-label)',
                      letterSpacing: 'var(--mk-tracking-label)',
                      textTransform: 'uppercase',
                      color: 'var(--mk-text-faint)',
                    }}
                  >
                    Commission tier
                  </div>
                </div>

                <div
                  className="flex flex-col gap-3 flex-1 pt-4 mt-1"
                  style={{ borderTop: '1px solid var(--mk-line)' }}
                >
                  <StatRow label="Active traders"       value={traders} />
                  <StatRow label="Commission (per lot)" value={commission} accent={tone} />
                  <StatRow label="Tier reward"          value={amount} />
                </div>

                <Link
                  href="/auth/register"
                  className="mk-btn mt-4"
                  style={{ background: tone, color: '#0a0a0a' }}
                >
                  Get started
                </Link>
              </article>
            </div>
          ))}
        </div>

        {/* Custom-deals callout */}
        <div
          className="mt-8 mx-auto max-w-3xl flex items-start gap-4"
          style={{
            background: 'var(--mk-accent-soft)',
            border: '1px solid var(--mk-accent-line)',
            borderRadius: 'var(--mk-radius)',
            padding: 'var(--mk-space-5)',
          }}
        >
          <Sparkles size={20} className="shrink-0 mt-0.5" style={{ color: 'var(--mk-accent)' }} />
          <p className="mk-body" style={{ color: 'var(--mk-text)' }}>
            <span style={{ color: 'var(--mk-accent)', fontWeight: 700 }}>Custom deals up to $15 per lot.</span>{' '}
            Partners with consistent volume above Platinum can ask for a bespoke rate. Contact us once you are
            there and we will talk.
          </p>
        </div>

        <p
          className="mt-6 text-center mx-auto max-w-2xl"
          style={{ fontSize: 'var(--mk-text-xs)', lineHeight: 'var(--mk-leading-body)', color: 'var(--mk-text-faint)' }}
        >
          Commission accrues at fill and is released when the referred trade closes. Payout requests are reviewed
          and approved by our team. Demo trades do not earn commission, and you cannot refer yourself.
        </p>
      </Section>

      {/* Benefits grid */}
      <Section id="benefits">
        <SectionHeading kicker="What you get" title={`Why partner with ${BRAND_NAME}`} />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            { icon: Link2,      title: 'Personal link and code',  body: 'A referral link and a code that work on the sign-up page. Every registration through them is yours.' },
            { icon: Layers,     title: 'Multi-level network',     body: 'Earn on the traders your sub-partners bring in, not only the ones you introduce directly.' },
            { icon: Zap,        title: 'Accrued at fill, paid at close', body: 'Commission is calculated per lot the moment a referred trade fills and released when it closes. No month-end reconciliation.' },
            { icon: BarChart3,  title: 'Live partner dashboard',  body: 'Your network, its trading volume and your earnings in one panel, updated as trades happen.' },
            { icon: Wallet,     title: 'Payouts on request',      body: 'Request a payout from your partner balance whenever you like. Requests are reviewed and approved by our team.' },
            { icon: Users,      title: 'Five asset classes',      body: 'Commission is earned on forex, metals, indices, energy and crypto lots alike, on every account type.' },
            { icon: Award,      title: 'No cap on your network',  body: 'Five traders or five thousand: the programme scales, and your tier only moves up.' },
          ]}
        />
      </Section>

      {/* Partner with us — the one B2B side note */}
      <Section raised>
        <div className="mk-card mx-auto max-w-3xl flex flex-col sm:flex-row gap-5 sm:items-center">
          <span
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
            style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
          >
            <Building2 size={22} />
          </span>
          <div className="flex-1">
            <h3 className="mk-h3">Run a brand of your own?</h3>
            <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>
              Beyond the IB programme, {BRAND_NAME} works with a small number of partners on white-label arrangements.
              Get in touch and tell us about your business.
            </p>
          </div>
          <Link href="/company/contact" className="mk-btn mk-btn--ghost shrink-0">Contact us</Link>
        </div>
      </Section>

      {/* FAQ */}
      <Section id="faq">
        <SectionHeading kicker="Questions" title="IB FAQ" />
        <div className="mt-12 mx-auto max-w-3xl">
          <FaqAccordion
            items={[
              {
                q: 'How do I become a partner?',
                a: <>Register a {BRAND_NAME} account, then open the Business page inside the platform and submit the partner application. Our team reviews it and, once approved, your referral link and code are ready in the dashboard.</>,
              },
              {
                q: 'When is commission credited?',
                a: <>Commission is calculated per lot at the moment a referred trade fills, and released to your partner balance when that trade closes. Trades on demo accounts never earn commission.</>,
              },
              {
                q: 'How are payouts made?',
                a: <>Request a payout from your partner balance in the dashboard. Each request is reviewed and approved by our team before it is paid.</>,
              },
              {
                q: 'Which markets count?',
                a: <>Every lot on the platform: forex, metals, indices, energy and crypto, on any live account type.</>,
              },
              {
                q: 'How does the multi-level network work?',
                a: <>If a partner you introduced brings in their own traders, those traders sit in your network too and you earn on their volume. Your dashboard shows the full tree.</>,
              },
              {
                q: 'Does a referred trader stay linked to me?',
                a: <>Yes. Attribution is permanent: a trader who registers through your link or code stays in your network for the life of their account. You cannot refer yourself.</>,
              },
            ]}
          />
        </div>
      </Section>

      <CtaBanner
        title="Start building your network"
        lead={`Create your ${BRAND_NAME} account, apply from the Business page, and share your link the same day.`}
        primary={{ label: 'Create your account', href: '/auth/register' }}
        secondary={{ label: 'Sign in', href: '/auth/login' }}
      />

      <div className="mk-container" style={{ paddingTop: 'var(--mk-space-6)', paddingBottom: 'var(--mk-space-8)' }}>
        <p className="mk-meta mx-auto max-w-3xl text-center">
          Trading leveraged products such as forex and CFDs carries a high level of risk and may not be suitable
          for all investors. You could lose more than your initial deposit.
        </p>
      </div>
    </main>
  );
}
