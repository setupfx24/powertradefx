'use client';

import Link from 'next/link';
import { Gem, ShieldCheck, Layers, Users, Lock, Bell, Sparkles } from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Services → Token launches (coming soon).
 *
 * Not a live feature. The page describes the intended trader benefit,
 * clearly marked as upcoming, and sends the waitlist to the contact
 * page. The old on-page notify form was removed: it stored nothing, so
 * "you're on the list" was not true.
 */

const RISK_LINE =
  'Trading leveraged products such as forex and CFDs carries a high level of risk and may not be suitable for all investors. You could lose more than your initial deposit.';

const WAITLIST_HREF = '/company/contact';

export default function IcoComingSoonPage() {
  return (
    <main>
      <PageHero
        kicker="Coming soon"
        title={<>Token launches <span style={{ color: 'var(--mk-accent)' }}>from your account</span></>}
        lead={`We are building early access to vetted token sales for ${BRAND_NAME} account holders. It is not live yet. Join the waitlist and we will email you when it opens.`}
      >
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link href={WAITLIST_HREF} className="mk-btn mk-btn--primary mk-btn--lg">
            Join the waitlist <Bell size={16} />
          </Link>
          <Link href="/auth/register" className="mk-btn mk-btn--ghost mk-btn--lg">
            Open account
          </Link>
        </div>
        <p className="mt-2" style={{ fontSize: 'var(--mk-text-xs)', color: 'var(--mk-text-faint)' }}>
          Pick &quot;Something else&quot; on the contact form and mention token launches. One email when it opens.
        </p>
      </PageHero>

      {/* What is planned */}
      <Section raised>
        <SectionHeading
          kicker="Planned"
          title="What we are building"
          lead="Everything below is the intent, not a live feature. Details may change before launch."
        />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            { icon: ShieldCheck, title: 'Vetted projects only',  body: 'A review of team, tokenomics, audit and legal standing before a sale is listed. Quality over quantity.' },
            { icon: Layers,      title: 'Clear rounds and pricing', body: 'Each sale shows its stage, price and vesting schedule before you commit anything.' },
            { icon: Lock,        title: 'Allocations you can see', body: 'Your allocation, its vesting and its unlock dates, visible from your account.' },
          ]}
        />
      </Section>

      {/* What to expect */}
      <Section>
        <SectionHeading kicker="At launch" title="What to expect when it opens" />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            { icon: Sparkles,    title: 'A short list',            body: 'A handful of reviewed sales, not a daily firehose.' },
            { icon: Users,       title: 'Account holders first',   body: 'Access from an existing, KYC-verified account — the same login you trade with.' },
            { icon: Gem,         title: 'Terms up front',          body: 'Price, vesting and unlock schedule published before the sale opens.' },
            { icon: ShieldCheck, title: 'Audit requirements',      body: 'A contract audit as a listing condition.' },
            { icon: Lock,        title: 'Vesting transparency',    body: 'Team and investor unlocks visible before anyone commits.' },
            { icon: Layers,      title: 'Funded from your wallet', body: 'Participate with the balance you already hold — no separate sign-up.' },
          ]}
        />
        <p className="mk-meta mx-auto text-center" style={{ marginTop: 'var(--mk-space-8)', maxWidth: '72ch' }}>
          Token sales carry their own risks, including total loss. {RISK_LINE}
        </p>
      </Section>

      <CtaBanner
        title="Be first to hear"
        lead="Join the waitlist through the contact page, or open an account now so you are verified when it opens."
        primary={{ label: 'Join the waitlist', href: WAITLIST_HREF }}
        secondary={{ label: 'Open account', href: '/auth/register' }}
      />
    </main>
  );
}
