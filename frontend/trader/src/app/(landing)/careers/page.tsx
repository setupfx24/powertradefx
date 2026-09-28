/**
 * Careers.
 *
 * THERE IS INTENTIONALLY NO ROLES / JOB-LISTINGS SECTION ON THIS PAGE.
 * The platform has no jobs data source (no CMS collection, no API, no
 * static roles file), so inventing openings here would advertise
 * positions that do not exist. What we can say honestly: we are hiring
 * across engineering, support and partnerships, and applications go to
 * the support inbox. When a real jobs source lands, add a roles section
 * fed from it.
 *
 * The culture copy is deliberately generic: no headcount, office count,
 * funding, growth rate or any other figure the repo cannot back up.
 */
import type { Metadata } from 'next';
import {
  Users, Compass, GraduationCap, LineChart, Mail, Code2, Headphones, Handshake,
} from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components';
import { BRAND_NAME, BRAND_SUPPORT_EMAIL } from '@/lib/brand';

export const metadata: Metadata = {
  title: `Careers | ${BRAND_NAME}`,
  description: `Work at ${BRAND_NAME} — we are hiring across engineering, support and partnerships. Send your CV to ${BRAND_SUPPORT_EMAIL}.`,
};

const RISK_LINE =
  'Trading leveraged products such as forex and CFDs carries a high level of risk and may not be suitable for all investors. You could lose more than your initial deposit.';

const CV_MAILTO = `mailto:${BRAND_SUPPORT_EMAIL}?subject=${encodeURIComponent(
  `Careers — CV submission`,
)}&body=${encodeURIComponent(
  `Hello ${BRAND_NAME} team,\n\nI'd like to be considered for a role.\n\nName: \nLocation: \nArea (engineering / support / partnerships): \nLinks (portfolio / LinkedIn / GitHub): \n\nMy CV is attached.\n\nThank you,\n`,
)}`;

export default function CareersPage() {
  return (
    <main>
      <PageHero
        kicker="Careers"
        title={`Help build the platform traders rely on`}
        lead={`${BRAND_NAME} is an online multi-asset broker. We are hiring across engineering, support and partnerships. There is no public job board — send us your CV and tell us where you fit.`}
        primary={{ label: 'Send us your CV', href: CV_MAILTO }}
        secondary={{ label: 'About the company', href: '/company/about' }}
      />

      {/* What the company does */}
      <Section raised>
        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <SectionHeading align="left" kicker="What we do" title={`Inside ${BRAND_NAME}`} />
          <div className="flex flex-col gap-5" style={{ maxWidth: '68ch' }}>
            <p className="mk-lead">
              We run a trading platform for retail and professional traders: a web terminal with
              TradingView charts and server-side execution, 40+ instruments across forex, metals,
              indices, energy and crypto, wallet and KYC flows, copy trading and PAMM, an AI
              strategy builder, a bot API and a multi-level partner programme.
            </p>
            <p className="mk-body">
              That means the work spans real-time market data, order execution and margin, payments
              and compliance, and the client-facing product itself — engineering, support and
              partnerships all sit close together and talk to each other every day.
            </p>
          </div>
        </div>
      </Section>

      {/* Areas we hire in — areas, not fabricated openings. */}
      <Section>
        <SectionHeading
          kicker="Where we are hiring"
          title="Three areas"
          lead="Tell us which one you belong in. If it is none of them but you think you would be useful, say so."
        />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            {
              icon: Code2,
              title: 'Engineering',
              body: 'The trading engine, market data, the web terminal, wallet and KYC flows, the partner and copy-trading systems, and the infrastructure under them.',
            },
            {
              icon: Headphones,
              title: 'Support',
              body: 'Onboarding, KYC review, deposits and withdrawals, and the support tickets traders raise from their dashboard. You are the person who replies.',
            },
            {
              icon: Handshake,
              title: 'Partnerships',
              body: 'The IB and referral programme — helping partners get set up, reviewing commissions and payouts, and growing the network.',
            },
          ]}
        />
      </Section>

      {/* How we work — generic, verifiable-by-nature culture copy only. */}
      <Section raised>
        <SectionHeading
          kicker="How we work"
          title="What to expect"
          lead="No perks list, no invented numbers — just how the team actually operates."
        />
        <FeatureGrid
          className="mt-12"
          columns={2}
          items={[
            {
              icon: Users,
              title: 'Small teams, real ownership',
              body: 'You own the thing you build or run end to end — from the decision through the release to what it does for traders in production.',
            },
            {
              icon: LineChart,
              title: 'Live markets, honest feedback',
              body: 'A trading platform is judged the moment the market opens. That makes the feedback loop short and the standard for correctness high.',
            },
            {
              icon: Compass,
              title: 'Clear over clever',
              body: 'We prefer the simple approach the next person can read, debug and change over the impressive one only its author understands.',
            },
            {
              icon: GraduationCap,
              title: 'Room to learn the domain',
              body: 'Nobody arrives knowing forex, CFDs, margin and market microstructure all at once. We expect people to grow into it, and we make time for it.',
            },
          ]}
        />
      </Section>

      {/* Single application route — no listings, one inbox. */}
      <Section>
        <div className="mk-card flex flex-col gap-5 mx-auto text-center items-center" style={{ maxWidth: '48rem' }}>
          <span
            className="inline-flex h-12 w-12 items-center justify-center rounded-xl shrink-0"
            style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
          >
            <Mail size={22} />
          </span>
          <h2 className="mk-h2" style={{ fontSize: 'var(--mk-text-h3)' }}>
            Send us your CV
          </h2>
          <p className="mk-body" style={{ maxWidth: '60ch' }}>
            Email your CV with a short note on the area you want to work in and the kind of work you
            are looking for. We read every application and keep good ones on file for when the right
            role opens.
          </p>
          <a href={CV_MAILTO} className="mk-btn mk-btn--primary">
            Send us your CV
          </a>
          <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text-faint)' }}>
            Applications go to {BRAND_SUPPORT_EMAIL}
          </p>
        </div>
        <p className="mk-meta mx-auto text-center" style={{ marginTop: 'var(--mk-space-8)', maxWidth: '72ch' }}>{RISK_LINE}</p>
      </Section>

      <CtaBanner
        title="Want to see what you would be working on?"
        lead="Open the demo — it is the same terminal our traders use, provisioned in one click."
        primary={{ label: 'Try a free demo', href: '/auth/login' }}
        secondary={{ label: 'Send us your CV', href: CV_MAILTO }}
      />
    </main>
  );
}
