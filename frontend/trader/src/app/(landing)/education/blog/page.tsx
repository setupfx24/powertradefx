'use client';

/**
 * Education → Blog. Trader guides that describe the live platform. The
 * category filter and the expand/collapse "Read more" logic are carried
 * over; the fabricated dates and emoji covers are gone.
 */
import { useState } from 'react';
import {
  ArrowRight, ListOrdered, Gauge, Bot, Cable, Users, Wallet, Crosshair, ShieldCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { Section, SectionHeading, PageHero, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

const RISK_LINE =
  'Trading leveraged products such as forex and CFDs carries a high level of risk and may not be suitable for all investors. You could lose more than your initial deposit.';

const POSTS: Array<{ title: string; category: string; excerpt: string; body: string; icon: LucideIcon }> = [
  {
    title: 'How to place a limit order',
    category: 'Orders',
    icon: ListOrdered,
    excerpt: 'Buy or sell at the price you choose, not the one on screen — and let the engine wait for it.',
    body: `A limit order waits for your price. A buy limit sits below the current market and fills when price comes down to it; a sell limit sits above and fills when price rises to it. In the ${BRAND_NAME} terminal, select the instrument in the watchlist, open the order ticket, switch Market to Limit, enter the price, the lot size (from 0.01) and a stop-loss and take-profit, then press Buy or Sell. The order appears under Pending orders and is held server-side, so it keeps working after you close the browser. When the market reaches your price it fills at the limit price and moves to Positions. Stop and stop-limit orders work the same way; a stop-limit converts to a limit when the stop is hit.`,
  },
  {
    title: 'Understanding margin and leverage',
    category: 'Basics',
    icon: Gauge,
    excerpt: 'What leverage does to the margin a trade needs, and why margin level matters more than balance.',
    body: `Leverage lets you control a larger position than the cash you put up. At 1:100 a position needs 1% of its notional value as margin; at 1:500, 0.2%. On ${BRAND_NAME} leverage is flexible up to 1:500, default 1:100, set per account group. The account panel in the terminal always shows balance, equity (balance plus open P/L), margin (what open positions lock), free margin (what is left) and margin level (equity ÷ margin as a percentage). Higher leverage means a smaller move takes a larger share of your equity. Use the margin calculator on the Risk calculator page before you size a trade, and set the lot size from the loss you accept, not from the margin you are allowed.`,
  },
  {
    title: 'Setting stop-loss and take-profit from the chart',
    category: 'Orders',
    icon: Crosshair,
    excerpt: 'Every order can carry SL and TP — and you can drag both on the chart after the trade is open.',
    body: `Fill in the stop-loss and take-profit in the order ticket before you press Buy or Sell; both are sent with the order and held by the engine. Once the position is open it shows on the chart as a line with its entry price. Drag the SL or TP line to a new level and the change is saved to the server immediately. Because they live on the server, your stop-loss and take-profit keep working when your browser is closed or your phone loses signal. The one-click widget on the chart can open a position at the live price; add SL/TP to it the same way afterwards.`,
  },
  {
    title: 'Using the AI strategy builder',
    category: 'Automation',
    icon: Bot,
    excerpt: 'Describe a strategy in plain language, get rules back, backtest them, deploy on your account.',
    body: `Open AI strategies from your dashboard. Start from a template — trend following, mean reversion, breakout, conservative risk, London open, gold scalper — or type what you want in plain language: the instrument, the timeframe, when to enter, where the stop and target go. The assistant turns that into a rules-based strategy you can read. Run a backtest on past data, adjust, run it again. Then deploy it to run on your account. Trades the strategy places are tagged separately from your manual trades, so you can see exactly what it did. Stop it at any time. A backtest is not a forecast — start on the demo.`,
  },
  {
    title: 'Connecting a bot with the Algo Connector',
    category: 'Automation',
    icon: Cable,
    excerpt: 'A per-account API key, REST endpoints for orders and positions, and a WebSocket tick stream.',
    body: `Open Algo connector and generate an API key and secret for the account the bot should trade — keys are per account, so a bot on one account cannot touch another. The REST endpoints place BUY, SELL and CLOSE orders and read the account and its positions; the WebSocket stream pushes live ticks for the instruments you subscribe to. API orders go through the same execution path and the same margin and risk checks as an order from the terminal. Anything that speaks HTTP and WebSocket works: a Python script, a bot ported from an MT-style platform, a scheduler. Test against a demo account first.`,
  },
  {
    title: 'Copy trading explained',
    category: 'Copy trading',
    icon: Users,
    excerpt: 'Follow a master trader with an allocation you choose, have their trades mirrored, stop whenever you like.',
    body: `The Social page shows a leaderboard of master traders. Sort by return, by followers or by Sharpe ratio, and open a profile to see how they trade and what performance fee they charge. Follow with an allocation; from then on the master's trades are mirrored into your account, scaled to that allocation, and appear in your Positions and history. You can stop at any time. Copy trading requires a live account. A master's past return is not a guarantee, and their losses are mirrored too — allocate only what you can afford to lose.`,
  },
  {
    title: 'Funding your account with USDT',
    category: 'Funding',
    icon: Wallet,
    excerpt: 'Deposit USDT on TRC20, BEP20 or ERC20 from the wallet, then move it to the account you trade on.',
    body: `Open Wallet, choose Deposit, then USDT, and pick the network — TRC20, BEP20 or ERC20 — that matches the wallet you are sending from; sending on the wrong network can lose the funds. Copy the address, send, and wait for confirmations. The deposit shows in your transaction history when it is credited. Funds land in your main wallet; use Internal transfer to move them to a trading account, or between your accounts. Bank transfer and UPI deposits are also available through a payment link. Withdrawals go to USDT or to bank/UPI and need a KYC-verified account. Demo accounts cannot deposit.`,
  },
  {
    title: 'Securing your account',
    category: 'Basics',
    icon: ShieldCheck,
    excerpt: 'Two-factor authentication, Google sign-in and what to do before your first withdrawal.',
    body: `Turn on two-factor authentication from your account settings: it adds a TOTP code from an authenticator app to your password, and it takes a minute. Google sign-in is available if you prefer it. Sessions are protected and every connection is encrypted. Complete KYC — a government ID, a selfie and proof of address — early, because a withdrawal needs a verified account. Your funds and trading data sit on segregated infrastructure, and every deposit, withdrawal and transfer is in your wallet history.`,
  },
];

const CATEGORIES = ['all', 'Orders', 'Basics', 'Funding', 'Copy trading', 'Automation'];

export default function BlogPage() {
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState<number | null>(null);

  const filteredPosts = filter === 'all' ? POSTS : POSTS.filter((post) => post.category === filter);

  return (
    <main>
      <PageHero
        kicker="Guides"
        title="Trader guides"
        lead={`Plain-language guides to the ${BRAND_NAME} platform and the basics — orders, margin, funding, copy trading and automation. Each one describes the real screens.`}
        primary={{ label: 'Try a free demo', href: '/auth/login' }}
      />

      <Section raised>
        <SectionHeading kicker="Guides" title="Pick a topic" />

        <div className="flex flex-wrap gap-3 justify-center mt-10">
          {CATEGORIES.map((category) => {
            const active = filter === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => { setFilter(category); setExpanded(null); }}
                aria-pressed={active}
                className="mk-btn"
                style={
                  active
                    ? { background: 'var(--mk-accent)', color: '#fff' }
                    : { border: '1px solid var(--mk-line-strong)', color: 'var(--mk-text-muted)' }
                }
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
          {filteredPosts.map((post) => {
            const index = POSTS.indexOf(post);
            const isOpen = expanded === index;
            const Icon = post.icon;
            return (
              <article key={post.title} className="mk-card mk-card--hover flex flex-col gap-3">
                <span
                  className="inline-flex h-12 w-12 items-center justify-center rounded-xl shrink-0"
                  style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
                  aria-hidden
                >
                  <Icon size={22} />
                </span>
                <span
                  className="self-start rounded-full px-2.5 py-1 font-bold uppercase"
                  style={{
                    fontSize: '10px',
                    letterSpacing: '0.12em',
                    background: 'var(--mk-accent-soft)',
                    color: 'var(--mk-accent)',
                  }}
                >
                  {post.category}
                </span>
                <h3 className="mk-h3">{post.title}</h3>
                <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{post.excerpt}</p>
                {isOpen && (
                  <p
                    className="mk-body pl-4"
                    style={{ fontSize: 'var(--mk-text-sm)', borderLeft: '2px solid var(--mk-accent-line)' }}
                  >
                    {post.body}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  className="mt-auto flex items-center gap-2 font-bold self-start"
                  style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-accent)' }}
                >
                  {isOpen ? 'Show less' : 'Read more'}
                  <ArrowRight size={15} className={clsx('transition-transform', isOpen && 'rotate-90')} />
                </button>
              </article>
            );
          })}
        </div>

        <p className="mk-meta" style={{ marginTop: 'var(--mk-space-8)', maxWidth: '72ch' }}>{RISK_LINE}</p>
      </Section>

      <CtaBanner
        title="Try it on a demo"
        lead="A $10,000 demo account in one click — no email. Read a guide, then do it with virtual money."
        primary={{ label: 'Try a free demo', href: '/auth/login' }}
        secondary={{ label: 'Platform tutorials', href: '/education/tutorials' }}
      />
    </main>
  );
}
