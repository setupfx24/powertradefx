import Link from 'next/link';
import { Check } from 'lucide-react';
import { Section, SectionHeading, PageHero, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Platforms → Trade Insurance — coming soon. Not a live feature. Short,
 * honest page with a waitlist CTA; no tiers, caps or pricing.
 */

const PLANNED = [
  'Optional cover chosen per trade, on the order ticket',
  'Part of a covered loss credited back to your account on an approved claim',
  'Cover level, cap and minimum trade duration shown before you confirm',
  'Available on live accounts once launched',
];

export default function InsuranceMarketingPage() {
  return (
    <main>
      <PageHero
        kicker="Coming soon"
        title={<>Trade Insurance <span style={{ color: 'var(--mk-accent)' }}>coming soon</span>.</>}
        lead={`Optional loss cover for individual trades is in development at ${BRAND_NAME}. It is not available yet. Join the waitlist to hear when it goes live.`}
        primary={{ label: 'Join the waitlist', href: '/company/contact' }}
        secondary={{ label: 'Open account', href: '/auth/register' }}
      />

      <Section raised>
        <SectionHeading
          kicker="What is planned"
          title="Simple cover, clear terms"
          lead="The outline of what we are building. Final terms will be published before launch."
        />
        <ul className="grid md:grid-cols-2 gap-3 max-w-3xl mx-auto mt-12">
          {PLANNED.map((r) => (
            <li key={r} className="flex items-start gap-2 mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>
              <Check size={16} className="mt-1 shrink-0" style={{ color: 'var(--mk-accent)' }} />
              <span>{r}</span>
            </li>
          ))}
        </ul>
        <p className="mk-meta mt-8 text-center mx-auto max-w-2xl">
          Trade Insurance is not offered on any account today. Details may change before launch.
        </p>
        <div className="text-center mt-10">
          <Link href="/company/contact" className="mk-btn mk-btn--primary">Join the waitlist</Link>
        </div>
      </Section>

      <CtaBanner
        title="Trade today, add cover later"
        lead="Open an account now and we will let you know when Trade Insurance is available."
        primary={{ label: 'Open account', href: '/auth/register' }}
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
