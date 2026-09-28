'use client';

/**
 * Pro Account — an account SPECIFICATION page, not a pricing plan.
 * PowerTradeFX's higher tier for active traders: tighter spreads with a
 * per-lot commission, priority support, everything the platform offers.
 * Every CTA opens an account.
 */
import { Check, Headphones, Zap, Bot } from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components';

const RISK_LINE =
  'Trading leveraged products such as forex and CFDs carries a high level of risk and may not be suitable for all investors. You could lose more than your initial deposit.';

const FEATURES = [
  'Priority support — your tickets go to the front of the queue',
  'Tighter spreads with a fixed per-lot commission',
  'Leverage up to 1:500, lots from 0.01',
  '40+ instruments: forex, metals, indices, energy and crypto',
  'Full web terminal with TradingView charts and one-click trading',
  'AI Strategy Builder and Algo Connector API',
  'Copy trading — follow masters or trade as one',
  'Deposit by USDT (TRC20, BEP20, ERC20) or bank transfer / UPI',
];

const SPECS = [
  { label: 'Min deposit', value: '$5,000' },
  { label: 'Spreads from', value: '0.0 pips' },
  { label: 'Leverage', value: 'Up to 1:500' },
  { label: 'Commission', value: '$3.5 / lot' },
];

export default function ProAccountPage() {
  return (
    <main>
      <PageHero
        kicker="Account types"
        title="Pro Account"
        lead="For traders who trade size or trade often. Tighter spreads with a fixed per-lot commission, priority support, and every feature of the platform."
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'Compare account types', href: '/account-types' }}
      />

      <Section raised>
        <SectionHeading kicker="Specifications" title="Account conditions" />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mt-12">
          {SPECS.map((s) => (
            <div key={s.label} className="mk-card text-center" style={{ borderColor: 'var(--mk-accent-line)' }}>
              <div
                style={{
                  fontSize: 'var(--mk-text-label)',
                  letterSpacing: 'var(--mk-tracking-label)',
                  textTransform: 'uppercase',
                  color: 'var(--mk-text-faint)',
                }}
              >
                {s.label}
              </div>
              <div
                className="mt-2 font-extrabold"
                style={{ fontSize: 'var(--mk-text-h3)', color: 'var(--mk-accent)', lineHeight: 1.15 }}
              >
                {s.value}
              </div>
            </div>
          ))}
        </div>

        <div className="mx-auto max-w-4xl mt-14">
          <h3 className="mk-h2 text-center">What you get</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
            {FEATURES.map((feature) => (
              <div key={feature} className="flex items-start gap-3">
                <Check size={18} className="mt-1 shrink-0" style={{ color: 'var(--mk-accent)' }} />
                <span className="mk-body">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeading kicker="Why Pro" title="Built for active traders" />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            {
              icon: Zap,
              title: 'Tighter spreads',
              body: 'Spreads from 0.0 pips on majors with a fixed $3.5 per lot. If you trade often, the maths usually favours Pro over commission-free.',
            },
            {
              icon: Headphones,
              title: 'Priority support',
              body: 'Tickets from Pro accounts are handled first, in-app or by email at support@powertradefx.com.',
            },
            {
              icon: Bot,
              title: 'Automation included',
              body: 'Build strategies with the AI Strategy Builder or connect your own bot through the Algo Connector API. Same engine, same risk checks.',
            },
          ]}
        />
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
        title="Open a Pro account"
        lead="Register, verify your identity, and open a Pro account from inside the app. You can hold it alongside a Standard account under the same login."
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'Compare account types', href: '/account-types' }}
      />
    </main>
  );
}
