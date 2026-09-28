import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  Sparkles, Bot, KeyRound, Radio, ShieldCheck, Braces, Check, Tag,
} from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Platforms → AI & Algo Trading. This route (/platforms/super-admin) used
 * to describe a back-office console; it now presents the two automation
 * features of the live platform: the AI Strategy Builder (/ai-strategies
 * in the app) and the Algo Connector API (/algo-connector in the app).
 */

export const metadata: Metadata = {
  title: `AI & Algo Trading | ${BRAND_NAME}`,
  description: `Describe a strategy in plain language and let the ${BRAND_NAME} AI Strategy Builder turn it into rules you can backtest and deploy — or connect your own bot through the Algo Connector API.`,
};

const RISK_LINE =
  'Trading leveraged products such as forex and CFDs carries a high level of risk and may not be suitable for all investors. You could lose more than your initial deposit.';

const AI_TEMPLATES = ['Trend following', 'Mean reversion', 'Breakout', 'Conservative risk', 'London open', 'Gold scalper'];

const ALGO_POINTS = [
  'Per-account API key and secret, generated in the app',
  'REST endpoints to place BUY, SELL and CLOSE orders',
  'Read your account balance, margin and open positions',
  'WebSocket tick stream for live prices',
  'Same execution path and risk checks as the terminal',
  'Works with Python and MT-style bots',
];

export default function AiAlgoTradingPage() {
  return (
    <main>
      <PageHero
        kicker="AI & algo trading"
        title="Automate the way you trade"
        lead="Build a rules-based strategy from a plain-language description and run it on your account, or plug your own bot into the same engine the terminal uses."
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'Try a free demo', href: '/auth/login' }}
      />

      {/* AI Strategy Builder */}
      <Section raised>
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div className="flex flex-col gap-4 items-start">
            <span className="mk-kicker">AI Strategy Builder</span>
            <h2 className="mk-h2">Describe it. Backtest it. Deploy it.</h2>
            <p className="mk-lead">
              Tell the assistant what you want in plain words — “buy gold on a breakout above
              the London open high, risk 1% per trade”. It turns that into a rules-based strategy
              you can read, backtest it against historical prices, then deploy it to run on your
              account.
            </p>
            <ul className="flex flex-col gap-2.5">
              {[
                'Start from a template or from a blank prompt',
                'Every rule is written out so you can inspect and refine it',
                'Backtest before you risk a cent',
                'AI trades are tagged separately from your manual trades in your history',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 mk-body">
                  <Check size={18} className="shrink-0 mt-1" style={{ color: 'var(--mk-accent)' }} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2 mt-2">
              {AI_TEMPLATES.map((t) => (
                <span key={t} className="mk-badge">
                  <Tag size={12} />
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="mk-card overflow-hidden" style={{ padding: 0 }}>
            <Image
              src="/marketing/screens/ai-strategies.png"
              alt={`${BRAND_NAME} AI Strategy Builder with the six starter templates`}
              width={1600}
              height={1000}
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="block h-auto w-full"
            />
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeading kicker="How it works" title="From idea to a running strategy" />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            { icon: Sparkles, title: '1. Describe',  body: 'Write the strategy in your own words, or pick a template such as trend following or mean reversion.' },
            { icon: Braces,   title: '2. Review and backtest', body: 'The assistant returns explicit entry, exit and risk rules. Run them against past prices and read the results.' },
            { icon: Bot,      title: '3. Deploy',    body: 'Switch the strategy on for one of your accounts. It trades on our engine with the same server-side checks as a manual order.' },
          ]}
        />
      </Section>

      {/* Algo Connector */}
      <Section raised>
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div className="mk-card overflow-hidden order-2 lg:order-1" style={{ padding: 0 }}>
            <Image
              src="/marketing/screens/algo-connector.png"
              alt={`${BRAND_NAME} Algo Connector: generate an API key for a trading account and connect a bot`}
              width={1600}
              height={1000}
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="block h-auto w-full"
            />
          </div>
          <div className="flex flex-col gap-4 items-start order-1 lg:order-2">
            <span className="mk-kicker">Algo Connector API</span>
            <h2 className="mk-h2">Bring your own bot</h2>
            <p className="mk-lead">
              Generate an API key and secret for any of your trading accounts, point your bot at
              the REST endpoints, and subscribe to live ticks over WebSocket. Orders go through the
              same execution path and risk checks as the terminal.
            </p>
            <ul className="flex flex-col gap-2.5">
              {ALGO_POINTS.map((item) => (
                <li key={item} className="flex items-start gap-3 mk-body">
                  <Check size={18} className="shrink-0 mt-1" style={{ color: 'var(--mk-accent)' }} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section>
        <FeatureGrid
          columns={3}
          items={[
            { icon: KeyRound,    title: 'Keys per account',   body: 'Each trading account gets its own key and secret. Revoke one without touching the others.' },
            { icon: Radio,       title: 'Live tick stream',   body: 'A WebSocket feed of bid and ask for every instrument your bot trades.' },
            { icon: ShieldCheck, title: 'Same risk checks',   body: 'Margin, leverage and stop-out rules apply to API orders exactly as they do to orders from the terminal.' },
          ]}
        />
        <p className="mk-body text-center mt-8" style={{ fontSize: 'var(--mk-text-sm)' }}>
          Both features live inside your account — under <strong>AI Strategies</strong> and{' '}
          <strong>Algo Connector</strong> once you{' '}
          <Link href="/auth/login" className="mk-link">sign in</Link>.
        </p>
      </Section>

      <Section className="mk-section--tight">
        <p
          className="mk-body mx-auto text-center"
          style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text-muted)', maxWidth: '70ch' }}
        >
          <strong>Risk warning:</strong> {RISK_LINE} Backtested results do not guarantee future
          performance; an automated strategy can lose money while you are away.
        </p>
      </Section>

      <CtaBanner
        title="Let a strategy do the clicking"
        lead="Open an account to build with AI or connect your bot. Try both on a $10,000 demo first."
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'Try a free demo', href: '/auth/login' }}
      />
    </main>
  );
}
