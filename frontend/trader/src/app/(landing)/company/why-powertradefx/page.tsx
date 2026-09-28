import Image from 'next/image';
import {
  MonitorSmartphone, ServerCog, Layers, Gauge, Wallet, Users, Handshake, Bot, ShieldCheck, Headphones,
} from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Company → Why PowerTradeFX (route: /company/why-powertradefx).
 *
 * Ten reasons a trader picks the platform, each one a thing the live
 * platform actually does. No testimonials — there is no verified set of
 * client quotes to publish, and inventing them would be fabricating
 * social proof. No regulator, licence or office claims either.
 */

const RISK_LINE =
  'Trading leveraged products such as forex and CFDs carries a high level of risk and may not be suitable for all investors. You could lose more than your initial deposit.';

export default function WhyUsPage() {
  return (
    <main>
      <PageHero
        kicker={`Why ${BRAND_NAME}`}
        title={`Why traders choose ${BRAND_NAME}`}
        lead="One account, five asset classes, a terminal that runs in any browser — and execution that keeps working after you close the tab."
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'Try a free demo', href: '/auth/login' }}
        image={{
          src: '/marketing/screens/terminal.png',
          alt: `${BRAND_NAME} web terminal with chart, watchlist, order ticket and open positions`,
          width: 1600,
          height: 1000,
          priority: true,
        }}
      />

      {/* Ten reasons */}
      <Section raised>
        <SectionHeading kicker="The platform" title="Ten reasons, all of them on the platform today" />
        <FeatureGrid
          className="mt-12"
          columns={2}
          items={[
            { icon: MonitorSmartphone, title: 'A full web terminal',          body: 'TradingView-powered charts with 100+ indicators and drawing tools, timeframes from 1m to 1M, a live watchlist with bid/ask and spread, one-click trading on the chart, and positions, pending orders and history panels. Dark and light themes. Works in a phone browser too.' },
            { icon: ServerCog,         title: 'Server-side execution',        body: 'Market, limit, stop and stop-limit orders, with stop-loss and take-profit on every one. The engine holds and executes them — close the browser and they keep working. Limits fill at the limit price; a stop-limit converts to a limit when the stop is hit.' },
            { icon: Layers,            title: '40+ instruments, five classes', body: 'Forex majors and crosses, gold, silver, platinum and palladium, US30, NAS100, GER40 and UK100, US and UK oil, and BTC, ETH, LTC, SOL and XRP. Crypto trades 24/7; the rest follow market hours.' },
            { icon: Gauge,             title: 'Flexible leverage',            body: 'Up to 1:500, default 1:100, set per account group. Lot sizes from 0.01, so you can size a position to your risk rather than to a minimum. Margin, P/L, lot-size and swap calculators are built in.' },
            { icon: Wallet,            title: 'Simple funding',               body: 'Deposit with USDT on TRC20, BEP20 or ERC20, or by bank transfer / UPI via a payment link. Withdraw to USDT or bank/UPI. Hold several accounts under one login and move funds between them and your wallet.' },
            { icon: Users,             title: 'Copy trading and PAMM',        body: 'Follow master traders from a leaderboard sorted by return, followers or Sharpe ratio, with an allocation you choose and the option to stop any time. Or invest in reviewed PAMM managers, sorted by ROI, on a performance-fee basis.' },
            { icon: Handshake,         title: 'A partner programme',          body: 'Apply in-app, get a referral link and code, and build a multi-level network. Commission is calculated per lot when a referred trade fills and released when it closes, with a live dashboard of your network, volume and earnings.' },
            { icon: Bot,               title: 'AI and algo trading',          body: 'Describe a strategy in plain language, let the assistant turn it into rules, backtest it and deploy it on your account. Or connect your own bot through the Algo Connector: per-account API key, REST orders, WebSocket ticks, the same risk checks as the terminal.' },
            { icon: ShieldCheck,       title: 'Security by default',          body: 'Password plus optional TOTP two-factor authentication, Google sign-in, session protection and encrypted connections. Your funds and trading data sit on segregated infrastructure.' },
            { icon: Headphones,        title: 'Support that knows your account', body: 'Open a ticket from your dashboard and it arrives linked to your account, so we can look at the exact deposit, document or trade you mean. Or email us — a person replies.' },
          ]}
        />
      </Section>

      {/* Day-one facts */}
      <Section>
        <SectionHeading
          kicker="Day one"
          title="What you get the moment you sign up"
          lead="No sales call, no waiting for an approval to look around."
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5 mt-12">
          {[
            { n: '$10,000', label: 'demo balance in one click — no email' },
            { n: '40+',     label: 'instruments from one account' },
            { n: '1:500',   label: 'maximum leverage, default 1:100' },
            { n: '0.01',    label: 'minimum lot size' },
          ].map((s) => (
            <div key={s.label} className="mk-card flex flex-col gap-1">
              <span className="mk-num" style={{ fontSize: 'var(--mk-text-h2)', color: 'var(--mk-accent)' }}>{s.n}</span>
              <span className="mk-meta">{s.label}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Security & honesty block */}
      <Section raised>
        <div className="mk-card max-w-4xl mx-auto text-center flex flex-col gap-5">
          <h2 className="mk-h2">What we will and will not tell you</h2>
          <p className="mk-lead">
            We will show you the live spread before you trade, fill your order at the price you asked
            for, and tell you what a withdrawal needs before you request one. We will not promise
            profits, guaranteed returns or a risk-free anything.
          </p>
          <div className="grid md:grid-cols-2 gap-5 mt-2">
            <div
              style={{
                background: 'var(--mk-surface-2)',
                border: '1px solid var(--mk-line)',
                borderRadius: 'var(--mk-radius)',
                padding: 'var(--mk-space-5)',
              }}
            >
              <h3 className="mk-h3">Your account, protected</h3>
              <p className="mk-body">Two-factor authentication, Google sign-in, session protection and encrypted connections.</p>
            </div>
            <div
              style={{
                background: 'var(--mk-surface-2)',
                border: '1px solid var(--mk-line)',
                borderRadius: 'var(--mk-radius)',
                padding: 'var(--mk-space-5)',
              }}
            >
              <h3 className="mk-h3">Your money, traceable</h3>
              <p className="mk-body">Every deposit, withdrawal and internal transfer is in your wallet history. KYC is required before a withdrawal.</p>
            </div>
          </div>
          <p className="mk-meta" style={{ maxWidth: '72ch', margin: '0 auto' }}>{RISK_LINE}</p>
        </div>
      </Section>

      {/* Terminal on a phone */}
      <Section>
        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-10 items-center">
          <div className="flex flex-col gap-4 items-start">
            <span className="mk-kicker">Anywhere</span>
            <h2 className="mk-h2">The same terminal on your phone</h2>
            <p className="mk-lead">
              Open the web terminal in a phone browser and you get the chart, the watchlist and a
              mobile order sheet. Because execution is server-side, a trade you place on the train
              is managed exactly like one you place at a desk. An Android app is coming soon; a
              native desktop terminal for Windows and macOS is available on request.
            </p>
          </div>
          <div className="mx-auto" style={{ maxWidth: 300 }}>
            <Image
              src="/marketing/screens/terminal-phone.png"
              alt={`${BRAND_NAME} web terminal open in a phone browser`}
              width={390}
              height={844}
              className="block h-auto w-full"
              style={{ borderRadius: 'var(--mk-radius-lg)', border: '1px solid var(--mk-line)' }}
            />
          </div>
        </div>
      </Section>

      <CtaBanner
        title={`See ${BRAND_NAME} for yourself`}
        lead="Open a live account, or start on a $10,000 demo in one click."
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'Try a free demo', href: '/auth/login' }}
      />
    </main>
  );
}
