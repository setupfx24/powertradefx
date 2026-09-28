import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Link2, Network, DollarSign, ClipboardCheck, BarChart2, Users, Check, ArrowUpRight, Building2,
} from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Platforms → IB Programme. The partner programme of the live platform
 * (/business in the app): referral link, multi-level network, per-lot
 * commission accrued at fill and released at close, admin-approved
 * payouts, live dashboard. The tier table lives on /products/ib-referral.
 * The single partner-brand side offer allowed on the marketing site sits here, as
 * a side offer to partners who run their own brand.
 */

export const metadata: Metadata = {
  title: `IB Programme | ${BRAND_NAME}`,
  description: `Refer traders to ${BRAND_NAME} and earn a per-lot commission on every trade they close. Multi-level network, live dashboard, payouts approved by our team.`,
};

const RISK_LINE =
  'Trading leveraged products such as forex and CFDs carries a high level of risk and may not be suitable for all investors. You could lose more than your initial deposit.';

const TIERS = [
  { name: 'Bronze',   rebate: '$5 / lot' },
  { name: 'Silver',   rebate: '$7 / lot' },
  { name: 'Gold',     rebate: '$10 / lot', featured: true },
  { name: 'Platinum', rebate: '$12 / lot' },
];

const DASHBOARD_FEATURES = [
  'Your referral link and referral code',
  'Every trader in your network, by level',
  'Traded volume in lots, updated as trades fill',
  'Commission accrued and commission released',
  'Payout requests and their approval status',
  'History of every credit to your balance',
];

function NetworkIllustration() {
  return (
    <svg
      viewBox="0 0 240 170"
      role="img"
      aria-label="A partner at the top, two sub-partners below, and the traders each of them referred"
      className="w-full h-auto"
      style={{ maxWidth: 360 }}
    >
      {/* level 1 → level 2 */}
      <path d="M120 40 C120 70, 70 60, 70 88" fill="none" stroke="var(--mk-accent)" strokeWidth="1.5" strokeOpacity="0.7" />
      <path d="M120 40 C120 70, 170 60, 170 88" fill="none" stroke="var(--mk-accent)" strokeWidth="1.5" strokeOpacity="0.7" />
      {/* level 2 → traders */}
      {[40, 70, 100].map((x) => (
        <path key={`l${x}`} d={`M70 112 C70 130, ${x} 125, ${x} 140`} fill="none" stroke="var(--mk-accent)" strokeWidth="1.2" strokeOpacity="0.5" />
      ))}
      {[140, 170, 200].map((x) => (
        <path key={`r${x}`} d={`M170 112 C170 130, ${x} 125, ${x} 140`} fill="none" stroke="var(--mk-accent)" strokeWidth="1.2" strokeOpacity="0.5" />
      ))}
      <rect x="84" y="10" width="72" height="30" rx="8" fill="var(--mk-ink)" />
      <text x="120" y="29" textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">YOU</text>
      {[70, 170].map((x) => (
        <g key={x}>
          <rect x={x - 34} y="88" width="68" height="24" rx="7" fill="var(--mk-accent)" />
          <text x={x} y="104" textAnchor="middle" fontSize="9" fontWeight="700" fill="#fff">SUB-PARTNER</text>
        </g>
      ))}
      {[40, 70, 100, 140, 170, 200].map((x) => (
        <g key={x}>
          <circle cx={x} cy="150" r="11" fill="var(--mk-surface-2)" stroke="var(--mk-accent)" strokeWidth="1.5" />
          <text x={x} y="153" textAnchor="middle" fontSize="7" fontWeight="700" fill="var(--mk-ink)">T</text>
        </g>
      ))}
    </svg>
  );
}

export default function IBManagementPage() {
  return (
    <main>
      <PageHero
        kicker="Partners"
        title="IB Programme"
        lead={`Introduce traders to ${BRAND_NAME} and earn a commission on every lot they trade. Build a network under you and earn on the traders your sub-partners bring in too.`}
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'See the tiers', href: '/products/ib-referral' }}
      />

      <Section raised>
        <SectionHeading
          kicker="What you get"
          title="A partner programme that pays per lot"
          lead="Everything runs inside your trading account — apply, share, track and request payouts from one dashboard."
        />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            { icon: Link2,          title: 'Your referral link',          body: 'A personal link and referral code. Anyone who signs up through it is tied to you.' },
            { icon: Network,        title: 'Multi-level network',         body: 'Partners who join under you become your sub-partners. You earn on the traders they refer as well as your own.' },
            { icon: DollarSign,     title: 'Commission per lot',          body: 'Calculated per lot the moment a referred trade fills, and released to your balance when that trade closes.' },
            { icon: ClipboardCheck, title: 'Reviewed payouts',            body: 'Request a payout from the dashboard. Our team reviews and approves it, then it is paid to your wallet.' },
            { icon: BarChart2,      title: 'Live dashboard',              body: 'Network size, traded volume and earnings, updated as your traders trade.' },
            { icon: Users,          title: 'Real traders, real volume',   body: 'Commission comes from live trades only. Demo activity never counts, and you cannot refer yourself.' },
          ]}
        />
      </Section>

      <Section>
        <SectionHeading
          kicker="Tiers"
          title="Commission tiers"
          lead="Your tier sets the per-lot rate across your network. Full conditions and how tiers are reached are on the IB & referral page."
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-5 max-w-4xl mx-auto mt-12">
          {TIERS.map((t) => (
            <article
              key={t.name}
              className="mk-card mk-card--hover text-center flex flex-col gap-2"
              style={t.featured ? { borderColor: 'var(--mk-accent-line)' } : undefined}
            >
              <h3 className="mk-h3" style={t.featured ? { color: 'var(--mk-accent)' } : undefined}>{t.name}</h3>
              <div
                className="font-extrabold mt-2"
                style={{ fontSize: 'var(--mk-text-h2)', color: 'var(--mk-text)', lineHeight: 1.1 }}
              >
                {t.rebate}
              </div>
              <p style={{ fontSize: 'var(--mk-text-xs)', color: 'var(--mk-text-faint)' }}>
                Commission per lot
              </p>
            </article>
          ))}
        </div>
        <p className="mk-body text-center mt-6" style={{ fontSize: 'var(--mk-text-sm)' }}>
          Custom deals up to $15 / lot for high-volume partners.{' '}
          <Link href="/products/ib-referral" className="mk-link">
            See the full tier table
            <ArrowUpRight size={15} />
          </Link>
        </p>
      </Section>

      <Section raised>
        <SectionHeading kicker="Getting started" title="From sign-up to first commission" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-12">
          {[
            { step: '01', title: 'Open an account',     desc: `Register with ${BRAND_NAME} and complete verification.` },
            { step: '02', title: 'Apply in the app',    desc: 'Go to the partner section and submit your application. Our team reviews it.' },
            { step: '03', title: 'Share your link',     desc: 'Send your referral link or code to traders. Sub-partners can join under you the same way.' },
            { step: '04', title: 'Earn and withdraw',   desc: 'Commission accrues as referred trades fill and is released when they close. Request a payout from the dashboard.' },
          ].map((s) => (
            <article key={s.step} className="mk-card mk-card--hover text-center flex flex-col gap-3">
              <span
                className="font-extrabold"
                style={{ fontSize: 'var(--mk-text-h2)', color: 'var(--mk-accent)', lineHeight: 1 }}
              >
                {s.step}
              </span>
              <h3 className="mk-h3">{s.title}</h3>
              <p className="mk-body">{s.desc}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section>
        <div className="mk-card">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="flex flex-col gap-4">
              <h2 className="mk-h2">Your partner dashboard</h2>
              <ul className="flex flex-col gap-2.5">
                {DASHBOARD_FEATURES.map((item) => (
                  <li key={item} className="flex items-center gap-3 mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>
                    <Check size={16} className="shrink-0" style={{ color: 'var(--mk-accent)' }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <Link href="/auth/register" className="mk-btn mk-btn--primary self-start">Open account</Link>
            </div>
            <div className="flex justify-center">
              <NetworkIllustration />
            </div>
          </div>
        </div>
      </Section>

      <Section raised>
        <div className="mk-card mk-card--outline flex flex-col md:flex-row items-start md:items-center gap-5">
          <span
            className="inline-flex h-12 w-12 items-center justify-center rounded-xl shrink-0"
            style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
          >
            <Building2 size={22} />
          </span>
          <div className="flex-1 flex flex-col gap-1">
            <h3 className="mk-h3">Run your own brand?</h3>
            <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>
              Partners with an established audience can talk to us about a white-label
              partnership on the {BRAND_NAME} platform.
            </p>
          </div>
          <Link href="/company/contact" className="mk-btn mk-btn--ghost shrink-0">Talk to us</Link>
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
        title="Grow a network, earn per lot"
        lead="Open an account, apply as a partner in the app, and start sharing your link."
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'Sign in', href: '/auth/login' }}
      />
    </main>
  );
}
