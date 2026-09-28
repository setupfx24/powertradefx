'use client';

/**
 * Academy → Guides. Reference guides on the platform, read inline. There
 * are no PDF files to download, so nothing here offers a download; the
 * category tab filtering is carried over.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { FileText, ArrowRight, ArrowUpRight } from 'lucide-react';
import { clsx } from 'clsx';
import { Section, SectionHeading, PageHero, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

type Cat = 'Platform' | 'Basics' | 'Automation';

interface Guide {
  id: string;
  title: string;
  description: string;
  body: string[];
  category: Cat;
}

const RISK_LINE =
  'Trading leveraged products such as forex and CFDs carries a high level of risk and may not be suitable for all investors. You could lose more than your initial deposit.';

const GUIDES: Guide[] = [
  {
    id: 'p1', category: 'Platform',
    title: 'The web terminal, panel by panel',
    description: 'Watchlist, chart, order ticket, positions, pending orders, history and the account panel — what each one shows and does.',
    body: [
      'Watchlist: every instrument with live bid, ask and spread. Click one to load it on the chart and in the ticket.',
      'Chart: TradingView-powered, with 100+ indicators, drawing tools and timeframes from 1m to 1M. Open positions show as lines; drag SL/TP directly. A one-click widget on the chart buys or sells at the live price.',
      'Order ticket: market, limit, stop or stop-limit, lot size from 0.01, stop-loss and take-profit. Positions, Pending orders and History panels sit under the chart. The account panel keeps balance, equity, margin, free margin and margin level visible.',
      'Dark and light themes; an economic-news panel; share-a-trade cards for one trade, all open trades or your full history. Works in a phone browser with a mobile order sheet.',
    ],
  },
  {
    id: 'p2', category: 'Basics',
    title: 'Order types: market, limit, stop, stop-limit',
    description: 'When each order type fills, and at what price.',
    body: [
      'Market: fills now, at the live quote.',
      'Limit: waits for a better price. A buy limit sits below the market; a sell limit above. Fills at the limit price.',
      'Stop: waits for the market to move through a level. A buy stop sits above the market; a sell stop below. Used for breakouts or for exits.',
      'Stop-limit: when the stop price is hit, it becomes a limit order at your limit price, and fills at that price or better. All pending orders are held server-side and keep working with the browser closed.',
    ],
  },
  {
    id: 'p3', category: 'Basics',
    title: 'Understanding margin and leverage',
    description: 'How leverage sets the margin a trade needs, and how to read balance, equity, margin and margin level.',
    body: [
      'Leverage on the platform is flexible up to 1:500 (default 1:100), set per account group. At 1:100 a position needs 1% of its notional value as margin; at 1:500, 0.2%.',
      'Balance is your cash. Equity is balance plus open P/L. Margin is what open positions lock. Free margin is what is left. Margin level is equity ÷ margin as a percentage, and it is the number that tells you how close you are to trouble.',
      'Use the margin calculator on the Risk calculator page before you size a trade, and set the lot size from the loss you accept, not from the margin you are allowed.',
    ],
  },
  {
    id: 'p4', category: 'Basics',
    title: 'Funding your account with USDT',
    description: 'Deposit on TRC20, BEP20 or ERC20, move funds between accounts, and withdraw.',
    body: [
      'Wallet → Deposit → USDT. Choose the network that matches the sending wallet (TRC20, BEP20 or ERC20), copy the address, send, and wait for confirmations. The deposit shows in your history when credited.',
      'Funds land in your main wallet; use Internal transfer to move them to a trading account, or between your accounts.',
      'Withdrawals go to USDT or to bank/UPI and need a KYC-verified account. Crypto is typically same-day; bank and UPI withdrawals are reviewed by our team. Bank transfer and UPI deposits are also available through a payment link. Demo accounts cannot deposit.',
    ],
  },
  {
    id: 'p5', category: 'Automation',
    title: 'Using the AI strategy builder',
    description: 'From a plain-language description to a backtested strategy running on your account.',
    body: [
      'Open AI strategies. Start from a template (trend following, mean reversion, breakout, conservative risk, London open, gold scalper) or describe your own idea in plain language.',
      'The assistant turns the description into rules you can read. Backtest, refine, backtest again.',
      'Deploy it to your account. Its trades are tagged separately from your manual ones, so you always know which is which. Stop it whenever you like. Try it on the demo first.',
    ],
  },
  {
    id: 'p6', category: 'Automation',
    title: 'Connecting a bot with the Algo Connector',
    description: 'Per-account API keys, REST order endpoints and a WebSocket tick stream.',
    body: [
      'Open Algo connector and generate an API key and secret for the account the bot should trade. Keys are per account.',
      'REST: place BUY, SELL and CLOSE orders; read the account and positions. WebSocket: live ticks for the instruments you subscribe to.',
      'API orders take the same execution path and the same risk checks as the terminal. Any language that speaks HTTP and WebSocket works — Python, or a bot ported from an MT-style platform.',
    ],
  },
  {
    id: 'p7', category: 'Platform',
    title: 'Copy trading explained',
    description: 'Following a master trader, choosing an allocation, and stopping.',
    body: [
      'The Social page lists master traders on a leaderboard sorted by return, followers or Sharpe ratio. Each profile shows the performance fee the master charges.',
      'Follow with an allocation you choose. The master\'s trades are mirrored into your account automatically, scaled to that allocation, and appear in your Positions and history.',
      'Stop following at any time. Copy trading needs a live account. Losses are mirrored too — allocate only what you can afford to lose.',
    ],
  },
  {
    id: 'p8', category: 'Platform',
    title: 'Your first day: register, demo, KYC',
    description: 'The three things to do before you fund anything.',
    body: [
      'Register with email and password or Google. Enter a referral code at sign-up if you have one.',
      'On the sign-in page, press "Try with demo" for a $10,000 demo account — no email needed. Use it to learn the terminal with virtual money.',
      'Open KYC from your dashboard and upload a government ID, a selfie and proof of address. You will need a verified account before your first withdrawal, so do it early.',
    ],
  },
];

const TABS: Array<'All' | Cat> = ['All', 'Platform', 'Basics', 'Automation'];

export default function AcademyPdfsPage() {
  const [tab, setTab] = useState<'All' | Cat>('All');
  const [open, setOpen] = useState<string | null>(null);

  const list = useMemo(() => (tab === 'All' ? GUIDES : GUIDES.filter((p) => p.category === tab)), [tab]);

  return (
    <main>
      <PageHero
        kicker={`${BRAND_NAME} guides`}
        title="Trading guides"
        lead="Reference guides to the platform and the basics — read them here, no download needed. Each one describes what is actually on the screen."
        primary={{ label: 'Browse the guides', href: '#guides' }}
      />

      <Section raised id="categories">
        <SectionHeading kicker="Library" title="Platform, basics and automation" />

        {/* Category tabs */}
        <div
          className="flex flex-wrap justify-center gap-2 p-1.5 w-fit mx-auto mt-10"
          style={{ borderRadius: 'var(--mk-radius-pill)', border: '1px solid var(--mk-line)', background: 'var(--mk-surface)' }}
        >
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              className="px-4 py-2 font-bold"
              style={{
                borderRadius: 'var(--mk-radius-pill)',
                fontSize: 'var(--mk-text-sm)',
                background: tab === t ? 'var(--mk-accent)' : 'transparent',
                color: tab === t ? '#fff' : 'var(--mk-text-muted)',
                transition: 'background-color var(--mk-transition), color var(--mk-transition)',
              }}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Guide grid */}
        <div id="guides" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
          {list.map((p) => {
            const isOpen = open === p.id;
            return (
              <article key={p.id} className="mk-card mk-card--hover flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span
                    className="inline-flex h-11 w-11 items-center justify-center rounded-xl shrink-0"
                    style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
                    aria-hidden
                  >
                    <FileText size={20} />
                  </span>
                  <span
                    className="px-2 py-0.5 font-bold uppercase"
                    style={{
                      fontSize: '10px',
                      letterSpacing: '0.12em',
                      borderRadius: 'var(--mk-radius-sm)',
                      background: 'var(--mk-accent-soft)',
                      color: 'var(--mk-accent)',
                    }}
                  >
                    {p.category}
                  </span>
                </div>
                <h3 className="mk-h3">{p.title}</h3>
                <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{p.description}</p>
                {isOpen && (
                  <div className="flex flex-col gap-3 pl-4" style={{ borderLeft: '2px solid var(--mk-accent-line)' }}>
                    {p.body.map((para) => (
                      <p key={para} className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{para}</p>
                    ))}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : p.id)}
                  aria-expanded={isOpen}
                  className="mk-btn mk-btn--ghost w-full mt-auto"
                >
                  {isOpen ? 'Show less' : 'Read guide'}
                  <ArrowRight size={16} className={clsx('transition-transform', isOpen && 'rotate-90')} />
                </button>
              </article>
            );
          })}
        </div>
      </Section>

      {/* Try it */}
      <Section id="try">
        <div className="mk-card grid md:grid-cols-2 gap-8 items-center">
          <div className="flex flex-col gap-3">
            <span className="mk-kicker">Practise</span>
            <h2 className="mk-h2">Read a guide, then do it on a demo</h2>
            <p className="mk-lead">
              Every guide describes the real terminal. A $10,000 demo account is one click away on the
              sign-in page — no email, no risk to real money.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 md:justify-end">
            <Link href="/auth/login" className="mk-btn mk-btn--primary">
              Try a free demo <ArrowUpRight size={16} />
            </Link>
            <Link href="/education/tutorials" className="mk-btn mk-btn--ghost">
              Platform tutorials
            </Link>
          </div>
        </div>
        <p className="mk-meta mx-auto text-center" style={{ marginTop: 'var(--mk-space-8)', maxWidth: '72ch' }}>{RISK_LINE}</p>
      </Section>

      <CtaBanner
        title="Ready to trade for real?"
        lead="Open a live account in minutes. Standard is commission-free; Pro has tighter spreads and priority support."
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'More guides', href: '/academy/blogs' }}
      />
    </main>
  );
}
