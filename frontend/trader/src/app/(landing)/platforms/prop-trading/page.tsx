import type { Metadata } from 'next';
import { Target, ShieldCheck, TrendingUp, Bell } from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Platforms → Prop Trading. NOT a live feature. This page says so plainly,
 * sketches the intended trader benefit as upcoming, and sends interested
 * traders to the contact page to join the waitlist. The old fake
 * "Notify me" form (it only raised an alert) is gone.
 */

export const metadata: Metadata = {
  title: `Prop Trading — Coming Soon | ${BRAND_NAME}`,
  description: `Funded trading accounts on ${BRAND_NAME} are in development. Join the waitlist to hear when they launch.`,
};

const RISK_LINE =
  'Trading leveraged products such as forex and CFDs carries a high level of risk and may not be suitable for all investors. You could lose more than your initial deposit.';

export default function PropTradingPage() {
  return (
    <main>
      <PageHero
        kicker="Coming soon"
        title={<>Prop Trading <span style={{ color: 'var(--mk-accent)' }}>— Coming soon</span></>}
        lead={`Funded trading accounts are not available on ${BRAND_NAME} yet. We are building them. If you would like to trade our capital once they launch, join the waitlist and we will email you when it opens.`}
        primary={{ label: 'Join the waitlist', href: '/company/contact' }}
        secondary={{ label: 'Trade a live account today', href: '/auth/register' }}
      />

      <Section raised>
        <SectionHeading
          kicker="What we are building"
          title="What to expect at launch"
          lead="Plans, not promises. Details below are the intended design and may change before release."
        />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            { icon: Target,      title: 'An evaluation you can pass', body: 'Upcoming: a profit target and clear drawdown limits, shown on your dashboard the whole time.' },
            { icon: ShieldCheck, title: 'Rules in plain sight',       body: 'Upcoming: daily and total loss limits visible in the terminal, with the same server-side execution as every other account.' },
            { icon: TrendingUp,  title: 'A share of the profit',      body: 'Upcoming: keep an agreed share of what you make on a funded account, paid to your wallet.' },
          ]}
        />
      </Section>

      <Section>
        <div className="mk-card flex flex-col md:flex-row items-start md:items-center gap-5">
          <span
            className="inline-flex h-12 w-12 items-center justify-center rounded-xl shrink-0"
            style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
          >
            <Bell size={22} />
          </span>
          <div className="flex-1 flex flex-col gap-1">
            <h3 className="mk-h3">Want to hear first?</h3>
            <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>
              Send us a message with the subject “Prop trading waitlist”. One email when it
              launches, nothing else. In the meantime the full terminal is open on a $10,000
              demo.
            </p>
          </div>
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
        title="Join the waitlist"
        lead="Tell us you are interested and we will let you know when funded accounts go live."
        primary={{ label: 'Join the waitlist', href: '/company/contact' }}
        secondary={{ label: 'Try a free demo', href: '/auth/login' }}
      />
    </main>
  );
}
