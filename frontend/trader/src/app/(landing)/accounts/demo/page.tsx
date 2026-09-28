'use client';

/**
 * Demo Account — an account SPECIFICATION page, not a pricing plan.
 * The demo is real: one click on "Try with demo" on the login page creates
 * a $10,000 demo account instantly, with no email. Demo accounts trade the
 * live price feed on the full terminal; they cannot deposit, and copy
 * trading needs a live account.
 */
import { Check, GraduationCap, BarChart3, MousePointerClick } from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components';

const RISK_LINE =
  'Trading leveraged products such as forex and CFDs carries a high level of risk and may not be suitable for all investors. You could lose more than your initial deposit.';

const FEATURES = [
  'The same web terminal as a live account',
  'Live prices on 40+ instruments across forex, metals, indices, energy and crypto',
  'Market, limit, stop and stop-limit orders with stop-loss and take-profit',
  'Try the AI Strategy Builder and the Algo Connector API',
  'No email, no card, no deposit',
  'Leverage up to 1:500, lots from 0.01',
  'Test strategies before you put money on them',
  'Learn where everything is in the terminal',
];

const SPECS = [
  { label: 'Virtual funds', value: '$10,000' },
  { label: 'Cost', value: 'Free' },
  { label: 'Sign-up', value: 'One click' },
  { label: 'Terminal', value: 'Full' },
];

const STEPS = [
  { n: '1', title: 'Go to the login page', body: 'Press “Try with demo”. No email or password is needed.' },
  { n: '2', title: 'Land in the terminal', body: 'A $10,000 demo account is created instantly and opened for you.' },
  { n: '3', title: 'Trade', body: 'Place orders on live prices. When you are ready, open a live account from the same login.' },
];

export default function DemoAccountPage() {
  return (
    <main>
      <PageHero
        kicker="Demo account"
        title="A $10,000 demo, one click away"
        lead="Trade the full terminal on live prices with virtual funds. No email, no card, no deposit — press one button and you are in."
        primary={{ label: 'Try a free demo', href: '/auth/login' }}
        secondary={{ label: 'Open a live account', href: '/auth/register' }}
      />

      <Section raised>
        <SectionHeading kicker="Specifications" title="Demo account conditions" />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mt-12">
          {SPECS.map((s) => (
            <div key={s.label} className="mk-card text-center">
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
          <h3 className="mk-h2 text-center">What the demo includes</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
            {FEATURES.map((feature) => (
              <div key={feature} className="flex items-start gap-3">
                <Check size={18} className="mt-1 shrink-0" style={{ color: 'var(--mk-accent)' }} />
                <span className="mk-body">{feature}</span>
              </div>
            ))}
          </div>
          <p className="mk-body text-center mt-8" style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text-muted)' }}>
            Demo accounts cannot deposit or withdraw, and copy trading is available on live
            accounts only.
          </p>
        </div>
      </Section>

      <Section>
        <SectionHeading kicker="Why start on a demo" title="Practise before you fund" />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            {
              icon: GraduationCap,
              title: 'Learn without losing',
              body: 'Try order types, stop-loss and take-profit, and the one-click widget with virtual money.',
            },
            {
              icon: BarChart3,
              title: 'Real prices',
              body: 'The demo uses the same live feed and the same server-side execution as a live account.',
            },
            {
              icon: MousePointerClick,
              title: 'No forms',
              body: 'One button on the login page. Come back later and open a live account when you are ready.',
            },
          ]}
        />
      </Section>

      <Section raised>
        <SectionHeading kicker="Getting started" title="Three steps" />
        <ol className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-12">
          {STEPS.map((s) => (
            <li key={s.n} className="mk-card mk-card--hover flex flex-col items-center text-center gap-3">
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl shrink-0 font-bold"
                style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
              >
                {s.n}
              </span>
              <h3 className="mk-h3">{s.title}</h3>
              <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{s.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section className="mk-section--tight">
        <p
          className="mk-body mx-auto text-center"
          style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text-muted)', maxWidth: '70ch' }}
        >
          <strong>Risk warning:</strong> {RISK_LINE} Results on a demo account do not guarantee
          results on a live account.
        </p>
      </Section>

      <CtaBanner
        title="Try the terminal now"
        lead="One click on the login page gives you a $10,000 demo. When you are ready, open a live Standard or Pro account."
        primary={{ label: 'Try a free demo', href: '/auth/login' }}
        secondary={{ label: 'Compare live accounts', href: '/account-types' }}
      />
    </main>
  );
}
