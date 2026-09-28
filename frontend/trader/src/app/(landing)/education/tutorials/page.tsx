'use client';

/**
 * Education → Platform tutorials. Step-by-step walkthroughs of things a
 * trader does on the live platform. No course hours or lesson counts —
 * each tutorial is a short list of steps you can follow on a demo.
 */
import { useState } from 'react';
import Link from 'next/link';
import {
  ListOrdered, Crosshair, Wallet, Bot, Cable, Users, GraduationCap, Smartphone, Trophy, ArrowRight,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

type Level = 'Beginner' | 'Intermediate' | 'Advanced';

const RISK_LINE =
  'Trading leveraged products such as forex and CFDs carries a high level of risk and may not be suitable for all investors. You could lose more than your initial deposit.';

const TUTORIALS: Array<{
  title: string; description: string; level: Level; icon: LucideIcon; steps: string[]; needs: 'Demo or live' | 'Live account';
}> = [
  {
    title: 'Place your first order',
    description: 'From the watchlist to an open position with a stop-loss and take-profit.',
    level: 'Beginner',
    icon: ListOrdered,
    needs: 'Demo or live',
    steps: [
      'Sign in and open the terminal. Click an instrument in the watchlist — it loads on the chart and in the ticket.',
      'In the order ticket choose Market, enter a lot size (0.01 is the minimum), and set a stop-loss and take-profit.',
      'Press Buy or Sell. The position appears in the Positions panel and as a line on the chart.',
      'Watch balance, equity, margin, free margin and margin level update in the account panel.',
    ],
  },
  {
    title: 'Set and move stop-loss and take-profit',
    description: 'Protect a trade from the ticket, then adjust it by dragging on the chart.',
    level: 'Beginner',
    icon: Crosshair,
    needs: 'Demo or live',
    steps: [
      'Open a position with SL and TP filled in the ticket, or add them afterwards from the Positions panel.',
      'On the chart, drag the SL or TP line to a new level. The change saves to the server immediately.',
      'Close the browser tab. The stop-loss and take-profit are held by the engine and keep working.',
    ],
  },
  {
    title: 'Place a limit or stop-limit order',
    description: 'Wait for your price instead of taking the one on screen.',
    level: 'Intermediate',
    icon: ListOrdered,
    needs: 'Demo or live',
    steps: [
      'In the ticket switch Market to Limit (or Stop / Stop-limit). Enter the price you want.',
      'Add lot size, SL and TP, then Buy or Sell. The order goes to the Pending orders panel.',
      'When price reaches your level the order fills at the limit price and moves to Positions. A stop-limit converts to a limit when the stop is hit.',
      'Cancel a pending order any time from the panel.',
    ],
  },
  {
    title: 'Fund your account with USDT',
    description: 'Deposit on TRC20, BEP20 or ERC20 and move funds to a trading account.',
    level: 'Beginner',
    icon: Wallet,
    needs: 'Live account',
    steps: [
      'Open Wallet → Deposit → USDT and choose the network that matches the wallet you are sending from.',
      'Copy the address, send the USDT, and wait for confirmations. It appears in your transaction history once credited.',
      'Use Internal transfer to move the funds from your main wallet to the trading account you want.',
      'Complete KYC (ID, selfie, proof of address) before you need to withdraw.',
    ],
  },
  {
    title: 'Follow a master trader',
    description: 'Copy trading: pick a master, choose an allocation, stop whenever you like.',
    level: 'Intermediate',
    icon: Users,
    needs: 'Live account',
    steps: [
      'Open Social. Sort the leaderboard by return, followers or Sharpe ratio and open a profile.',
      'Check the performance fee, then press Follow and enter an allocation.',
      'The master\'s trades are mirrored into your account, scaled to the allocation. See them in Positions and history.',
      'Stop following from the same page at any time.',
    ],
  },
  {
    title: 'Build a strategy with the AI builder',
    description: 'From a plain-language description to a backtested strategy on your account.',
    level: 'Advanced',
    icon: Bot,
    needs: 'Demo or live',
    steps: [
      'Open AI strategies. Pick a template — trend following, breakout, gold scalper and others — or describe your own idea.',
      'Read the rules the assistant produces. Run a backtest, adjust the description, run it again.',
      'Deploy the strategy to your account. Its trades are tagged separately from manual ones.',
      'Stop it whenever you like. Start on the demo.',
    ],
  },
  {
    title: 'Connect a bot with the Algo Connector',
    description: 'API key, REST orders and a WebSocket tick stream — same risk checks as the terminal.',
    level: 'Advanced',
    icon: Cable,
    needs: 'Demo or live',
    steps: [
      'Open Algo connector and generate an API key and secret for the account the bot should trade.',
      'Point your code at the REST endpoints for BUY / SELL / CLOSE, account and positions.',
      'Subscribe to the WebSocket stream for live ticks on the instruments you trade.',
      'Run it against a demo account first; API orders go through the same execution path and risk checks as the terminal.',
    ],
  },
];

function levelColor(level: Level): string {
  if (level === 'Beginner') return 'var(--mk-up)';
  if (level === 'Intermediate') return 'var(--mk-accent)';
  return 'var(--mk-down)';
}

export default function TutorialsPage() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <main>
      <PageHero
        kicker="Education"
        title="Platform tutorials"
        lead={`Step-by-step walkthroughs of the ${BRAND_NAME} platform — orders, stop-loss and take-profit, funding, copy trading and automation. Follow each one on a free demo.`}
        primary={{ label: 'Try a free demo', href: '/auth/login' }}
        secondary={{ label: 'Trader guides', href: '/education/blog' }}
      />

      <Section raised>
        <SectionHeading kicker="Tutorials" title="Pick one and follow along" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-12">
          {TUTORIALS.map((t) => {
            const Icon = t.icon;
            const isOpen = open === t.title;
            return (
              <article key={t.title} className="mk-card mk-card--hover flex flex-col gap-4">
                <div className="flex items-start gap-4">
                  <span
                    className="inline-flex h-14 w-14 items-center justify-center rounded-xl shrink-0"
                    style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
                    aria-hidden
                  >
                    <Icon size={26} />
                  </span>
                  <div className="flex-1 min-w-0 flex flex-col gap-2">
                    <span
                      className="self-start rounded-full px-2.5 py-1 font-bold uppercase"
                      style={{
                        fontSize: '10px',
                        letterSpacing: '0.12em',
                        border: `1px solid ${levelColor(t.level)}`,
                        color: levelColor(t.level),
                      }}
                    >
                      {t.level}
                    </span>
                    <h3 className="mk-h3">{t.title}</h3>
                  </div>
                </div>
                <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{t.description}</p>
                <div className="mk-meta" style={{ fontSize: 'var(--mk-text-xs)' }}>
                  Needs: {t.needs} · {t.steps.length} steps
                </div>
                {isOpen && (
                  <ol className="flex flex-col gap-2 pl-4" style={{ borderLeft: '2px solid var(--mk-accent-line)' }}>
                    {t.steps.map((s, i) => (
                      <li key={s} className="flex items-start gap-3 mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>
                        <span className="shrink-0 font-mono" style={{ color: 'var(--mk-accent)' }}>{String(i + 1).padStart(2, '0')}</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                )}
                <div className="flex flex-wrap gap-3 mt-auto">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : t.title)}
                    aria-expanded={isOpen}
                    className="mk-btn mk-btn--primary"
                  >
                    {isOpen ? 'Hide steps' : 'Show steps'}
                    <ArrowRight size={15} className={clsx('transition-transform', isOpen && 'rotate-90')} />
                  </button>
                  <Link href="/auth/login" className="mk-btn mk-btn--ghost">Try on a demo</Link>
                </div>
              </article>
            );
          })}
        </div>
      </Section>

      <Section>
        <SectionHeading kicker="Why learn here" title={`Why learn on ${BRAND_NAME} itself`} />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            { icon: GraduationCap, title: 'Written for the real screens', body: 'Every step names the actual panel or page, so what you read is what you see.' },
            { icon: Smartphone,    title: 'Works on your phone',          body: 'The web terminal runs in a phone browser with a mobile order sheet, so you can follow along anywhere.' },
            { icon: Trophy,        title: 'Practise with no real money',  body: 'A $10,000 demo is one click away on the sign-in page — no email, nothing to lose but time.' },
          ]}
        />
        <p className="mk-meta" style={{ marginTop: 'var(--mk-space-8)', maxWidth: '72ch' }}>{RISK_LINE}</p>
      </Section>

      <CtaBanner
        title="Follow a tutorial on a demo"
        lead="One click, $10,000, no email. Open a live account when you are ready."
        primary={{ label: 'Try a free demo', href: '/auth/login' }}
        secondary={{ label: 'Open account', href: '/auth/register' }}
      />
    </main>
  );
}
