'use client';

/**
 * Trade Insurance — coming soon. Not a live feature: this page describes
 * the intended benefit, clearly marked as upcoming, and collects
 * interest through the contact page. No pricing, tiers or promos.
 */
import { ShieldCheck, Zap, ScrollText } from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

export default function InsurancePage() {
  return (
    <main>
      <PageHero
        kicker="Coming soon"
        title={<>Trade Insurance <span style={{ color: 'var(--mk-accent)' }}>is on its way</span>.</>}
        lead={`We are building optional loss cover for individual trades on ${BRAND_NAME}. It is not available yet. Join the waitlist and we will tell you when it goes live.`}
        primary={{ label: 'Join the waitlist', href: '/company/contact' }}
        secondary={{ label: 'Open account', href: '/auth/register' }}
      />

      <Section raised>
        <SectionHeading
          kicker="What we are building"
          title="Cover you switch on per trade"
          lead="The plan, in outline. Terms, cover levels and any cost will be published before launch and shown on the order ticket before you opt in."
        />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            {
              icon: Zap,
              title: 'Planned: one toggle on the ticket',
              body: 'Choose cover as you place a trade. No forms, no separate product to set up.',
            },
            {
              icon: ShieldCheck,
              title: 'Planned: part of a loss back',
              body: 'If a covered trade closes at a loss within the policy terms, an approved claim is credited back to your account.',
            },
            {
              icon: ScrollText,
              title: 'Planned: terms up front',
              body: 'Cover percentage, cap and minimum trade duration shown before you confirm, so there is nothing to guess.',
            },
          ]}
        />
        <p className="mk-meta mt-8 text-center mx-auto max-w-2xl">
          Trade Insurance is in development and is not offered on any account today. Details above may change before launch.
        </p>
      </Section>

      <CtaBanner
        title="Want to know when it launches?"
        lead="Leave your details and we will email you when Trade Insurance is available on your account."
        primary={{ label: 'Join the waitlist', href: '/company/contact' }}
        secondary={{ label: 'Try a free demo', href: '/auth/login' }}
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
