'use client';

/**
 * Standard Account — an account SPECIFICATION page, not a pricing plan.
 * PowerTradeFX's entry-level live account: commission-free, competitive
 * spreads, low minimum deposit. Every CTA opens an account (no checkout,
 * no plan selection).
 */
import { Check } from 'lucide-react';
import { Section, SectionHeading, PageHero, CtaBanner } from '@/marketing/components';

const RISK_LINE =
  'Trading leveraged products such as forex and CFDs carries a high level of risk and may not be suitable for all investors. You could lose more than your initial deposit.';

const FEATURES = [
  'No commission — the spread is the only cost',
  'Leverage up to 1:500, lots from 0.01',
  '40+ instruments: forex, metals, indices, energy and crypto',
  'Full web terminal with TradingView charts and one-click trading',
  'Stop-loss and take-profit executed server-side',
  'Deposit by USDT (TRC20, BEP20, ERC20) or bank transfer / UPI',
  'Copy trading, AI Strategy Builder and Algo Connector API',
  'In-app support tickets and email support',
];

const SPECS = [
  { label: 'Min deposit', value: '$100' },
  { label: 'Spreads from', value: '1.1 pips' },
  { label: 'Leverage', value: 'Up to 1:500' },
  { label: 'Commission', value: 'None' },
];

const COMPARISON = [
  { feature: 'Minimum deposit', standard: '$100', pro: '$5,000', demo: 'None' },
  { feature: 'Spreads from', standard: '1.1 pips', pro: '0.0 pips', demo: 'Live spreads' },
  { feature: 'Commission', standard: 'None', pro: '$3.5 / lot', demo: 'None' },
  { feature: 'Leverage', standard: 'Up to 1:500', pro: 'Up to 1:500', demo: 'Up to 1:500' },
  { feature: 'Lot size from', standard: '0.01', pro: '0.01', demo: '0.01' },
  { feature: 'Copy trading', standard: 'Yes', pro: 'Yes', demo: 'Live accounts only' },
  { feature: 'Deposits & withdrawals', standard: 'USDT, bank / UPI', pro: 'USDT, bank / UPI', demo: 'Not available' },
  { feature: 'Support', standard: 'In-app & email', pro: 'Priority', demo: 'In-app & email' },
];

export default function StandardAccountPage() {
  return (
    <main>
      <PageHero
        kicker="Account types"
        title="Standard Account"
        lead="The account most traders start on. Low minimum deposit, competitive spreads, no commission, and every feature of the platform."
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'Try a free demo', href: '/auth/login' }}
      />

      <Section raised>
        <SectionHeading kicker="Specifications" title="Account conditions" />

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
        <SectionHeading kicker="Side by side" title="Compare account types" />

        <div className="mt-12 overflow-x-auto">
          <div
            className="min-w-[560px] overflow-hidden"
            style={{ border: '1px solid var(--mk-line)', borderRadius: 'var(--mk-radius-lg)' }}
          >
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Feature', 'Standard', 'Pro', 'Demo'].map((h, i) => (
                    <th
                      key={h}
                      className={i === 0 ? 'text-left px-5 py-4' : 'text-center px-5 py-4'}
                      style={{
                        background: 'var(--mk-surface-2)',
                        color: 'var(--mk-accent)',
                        fontSize: 'var(--mk-text-label)',
                        letterSpacing: 'var(--mk-tracking-label)',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.feature} style={{ borderTop: '1px solid var(--mk-line)' }}>
                    <td className="px-5 py-4" style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text-muted)', background: 'var(--mk-surface-2)' }}>
                      {row.feature}
                    </td>
                    <td className="px-5 py-4 text-center font-semibold" style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text)', background: 'var(--mk-surface)' }}>
                      {row.standard}
                    </td>
                    <td className="px-5 py-4 text-center" style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text-muted)', background: 'var(--mk-surface)' }}>
                      {row.pro}
                    </td>
                    <td className="px-5 py-4 text-center" style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text-muted)', background: 'var(--mk-surface)' }}>
                      {row.demo}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="mk-body text-center mt-6" style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text-muted)' }}>
          You can hold more than one account under a single login and move funds between them
          and your wallet at any time.
        </p>
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
        title="Open a Standard account"
        lead="Register in minutes, verify your identity, fund by USDT or bank transfer, and trade."
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'See the Pro account', href: '/accounts/pro' }}
      />
    </main>
  );
}
