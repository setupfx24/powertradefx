'use client';

/**
 * Academy → Guides. Trader guides that describe the live platform —
 * each entry expands inline, so "read" means read, not a dead link.
 * The search, category filter and pagination logic are carried over;
 * the fabricated authors and dates are gone.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, ArrowRight, ArrowUpRight, ArrowLeft, LifeBuoy } from 'lucide-react';
import { clsx } from 'clsx';
import { Section, PageHero, CtaBanner } from '@/marketing/components';
import { BRAND_NAME, BRAND_SUPPORT_EMAIL } from '@/lib/brand';

interface Post {
  id: string;
  title: string;
  excerpt: string;
  body: string[];
  category: string;
  featured?: boolean;
}

const RISK_LINE =
  'Trading leveraged products such as forex and CFDs carries a high level of risk and may not be suitable for all investors. You could lose more than your initial deposit.';

const POSTS: Post[] = [
  {
    id: 'g1',
    title: 'How to place a limit order',
    excerpt: 'Buy or sell at the price you choose, not the price on screen right now — and let the engine wait for it.',
    category: 'Orders',
    featured: true,
    body: [
      'A market order fills at the live quote. A limit order waits: a buy limit sits below the current price and fills when the market comes down to it; a sell limit sits above and fills when the market rises to it.',
      'In the terminal, pick the instrument in the watchlist, open the order ticket and switch the type from Market to Limit. Enter the price, the lot size (from 0.01) and, ideally, a stop-loss and take-profit. Press Buy or Sell.',
      'The order appears in the Pending orders panel. It is held server-side, so you can close the browser. When the market reaches your price the order fills at the limit price and moves to Positions. Cancel it any time from the panel.',
      'Stop and stop-limit orders work the same way in the ticket. A stop-limit converts into a limit order when the stop price is hit, then fills at the limit price.',
    ],
  },
  {
    id: 'g2',
    title: 'Understanding margin and leverage',
    excerpt: 'What leverage does to the margin a trade needs, and why the margin level number matters more than the balance.',
    category: 'Basics',
    body: [
      'Leverage lets you control a position larger than the cash you put up. At 1:100, a 1-lot EURUSD position (100,000 units) needs 1% of its value as margin. At 1:500 it needs 0.2%. Leverage on the platform goes up to 1:500; the default is 1:100 and it is set per account group.',
      'The account panel in the terminal shows five numbers at all times: balance, equity, margin, free margin and margin level. Equity is balance plus open profit and loss. Margin is what your open positions have locked. Free margin is what is left to open more. Margin level is equity divided by margin, as a percentage.',
      'Higher leverage means a smaller move wipes out a larger share of your equity. Before you size a position, open the margin calculator on the Risk calculator page and see what it locks. Then decide the lot size from the loss you are willing to take, not from the margin you are allowed to use.',
    ],
  },
  {
    id: 'g3',
    title: 'Using the AI strategy builder',
    excerpt: 'Describe a strategy in plain language, get rules back, backtest them, and deploy on your account.',
    category: 'Automation',
    body: [
      'Open AI strategies from your dashboard. Either start from a template — trend following, mean reversion, breakout, conservative risk, London open, gold scalper — or type what you want in plain language: the instrument, the timeframe, when to enter, where the stop and target go.',
      'The assistant turns that into a rules-based strategy you can read. Run a backtest to see how the rules would have behaved on past data. Adjust the description and run it again until you are happy with the logic.',
      'Deploy it to run on your account. Trades the strategy places are tagged separately from your manual trades, so you can see exactly what it did in Positions and in your history. Stop it at any time.',
      'A backtest is not a forecast. Start on the demo, then on a small live allocation.',
    ],
  },
  {
    id: 'g4',
    title: 'Connecting a bot with the Algo Connector',
    excerpt: 'A per-account API key, REST endpoints for orders and positions, and a WebSocket tick stream — same risk checks as the terminal.',
    category: 'Automation',
    body: [
      'Open Algo connector from your dashboard and generate an API key and secret for the account you want the bot to trade. Keys are per account, so a bot on one account cannot touch another.',
      'The REST endpoints let your code place BUY, SELL and CLOSE orders, and read the account and its open positions. The WebSocket stream pushes live ticks for the instruments you subscribe to.',
      'Orders from the API go through the same execution path and the same margin and risk checks as an order from the terminal. If a trade would not be allowed in the ticket, it is not allowed from the API either.',
      'Anything that speaks HTTP and WebSocket works — a Python script, a bot ported from an MT-style platform, a scheduler. Test against a demo account first.',
    ],
  },
  {
    id: 'g5',
    title: 'Copy trading explained',
    excerpt: 'Follow a master trader with an allocation you choose, have their trades mirrored automatically, and stop whenever you like.',
    category: 'Copy trading',
    body: [
      'The Social page shows a leaderboard of master traders. Sort it by return, by number of followers or by Sharpe ratio, and open a profile to see how they trade and what performance fee they charge.',
      'To follow, choose an allocation. From then on, when the master opens or closes a trade, the same trade is mirrored into your account, scaled to your allocation. You can see every copied trade in your Positions and history.',
      'You can stop following at any time. Copy trading requires a live account; it is not available on the demo.',
      'A master\'s past return is not a guarantee of future results. Their losses are mirrored too, so allocate what you can afford to lose.',
    ],
  },
  {
    id: 'g6',
    title: 'Funding your account with USDT',
    excerpt: 'Deposit USDT on TRC20, BEP20 or ERC20 from the wallet, then move it to the account you trade on.',
    category: 'Funding',
    body: [
      'Open Wallet and choose Deposit, then USDT. Pick the network — TRC20, BEP20 or ERC20 — that matches the wallet you are sending from. Sending on the wrong network can lose the funds, so check twice.',
      'Copy the deposit address shown, send the USDT from your exchange or wallet, and wait for the network confirmations. The deposit appears in your transaction history when it is credited.',
      'Funds land in your main wallet. Use Internal transfer to move them to the trading account you want to use. If you hold several accounts, you can move money between them the same way.',
      'Prefer local banking? The wallet also takes bank transfer and UPI through a payment link. Demo accounts cannot deposit at all.',
    ],
  },
  {
    id: 'g7',
    title: 'Setting stop-loss and take-profit from the chart',
    excerpt: 'Every order can carry a stop-loss and take-profit — and you can drag both on the chart after the trade is open.',
    category: 'Orders',
    body: [
      'In the order ticket, fill in the stop-loss and take-profit prices before you press Buy or Sell. Both are sent with the order and held server-side by the engine.',
      'Once the position is open it shows on the chart as a line. Drag the SL or TP line to a new level and the change is saved to the server immediately — no need to reopen the ticket.',
      'Because they are held by the engine, your stop-loss and take-profit keep working when your browser is closed or your phone loses signal.',
    ],
  },
  {
    id: 'g8',
    title: 'Completing KYC before your first withdrawal',
    excerpt: 'A government ID, a selfie and proof of address — and why to do it before you need the money.',
    category: 'Funding',
    body: [
      'You can trade on a demo and open a live account without KYC, but a withdrawal needs a verified account. Do it early so a withdrawal is not held up later.',
      'Open KYC from your dashboard and upload a government-issued ID, a selfie and a proof of address. Make sure the documents are legible and the details match your account.',
      'Once approved you can request withdrawals to USDT or to bank/UPI from the wallet. Crypto withdrawals are typically same-day; bank and UPI withdrawals are reviewed by our team before release.',
    ],
  },
];

const PAGE_SIZE = 4;
const CATEGORIES = ['Orders', 'Basics', 'Funding', 'Copy trading', 'Automation'] as const;

export default function AcademyBlogsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage]     = useState(1);
  const [category, setCategory] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const featured = POSTS.find((p) => p.featured) ?? POSTS[0]!;
  const rest = POSTS.filter((p) => p.id !== featured.id);

  const filtered = useMemo(() => {
    let out = rest;
    if (category) out = out.filter((p) => p.category === category);
    if (search) {
      const q = search.toLowerCase();
      out = out.filter((p) =>
        `${p.title} ${p.excerpt} ${p.category}`.toLowerCase().includes(q),
      );
    }
    return out;
  }, [rest, search, category]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const featuredOpen = open === featured.id;

  return (
    <main>
      <PageHero
        kicker={`${BRAND_NAME} guides`}
        title="Trader guides"
        lead="Short guides on using the platform and on the basics — orders, margin, funding, copy trading and automation. Each one describes the real screens."
        primary={{ label: 'Try a free demo', href: '/auth/login' }}
      />

      <Section raised>
        {/* Featured guide */}
        <article className="mk-card overflow-hidden grid md:grid-cols-2 gap-6" style={{ padding: 0 }}>
          {/* Inline order-ticket composition in place of a cover image. */}
          <div
            className="relative min-h-[260px] flex items-center justify-center"
            style={{ background: 'var(--mk-surface-2)', padding: 'var(--mk-space-6)' }}
            aria-hidden
          >
            <div
              className="w-full flex flex-col gap-3"
              style={{
                maxWidth: 280,
                background: 'var(--mk-surface)',
                border: '1px solid var(--mk-line)',
                borderRadius: 'var(--mk-radius)',
                padding: 'var(--mk-space-4)',
              }}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold" style={{ fontSize: 'var(--mk-text-sm)' }}>EURUSD</span>
                <span className="mk-kicker">Limit</span>
              </div>
              {[['Price', '1.0850'], ['Lots', '0.10'], ['Stop-loss', '1.0810'], ['Take-profit', '1.0930']].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between" style={{ fontSize: 'var(--mk-text-sm)' }}>
                  <span style={{ color: 'var(--mk-text-faint)' }}>{k}</span>
                  <span className="mk-num" style={{ color: 'var(--mk-text)' }}>{v}</span>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2 mt-1">
                <span className="text-center font-bold py-2 rounded" style={{ background: 'var(--mk-down)', color: '#fff', fontSize: 'var(--mk-text-xs)' }}>SELL</span>
                <span className="text-center font-bold py-2 rounded" style={{ background: 'var(--mk-up)', color: '#fff', fontSize: 'var(--mk-text-xs)' }}>BUY</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-4 justify-center" style={{ padding: 'var(--mk-space-6)' }}>
            <span className="mk-kicker">Start here · {featured.category}</span>
            <h2 className="mk-h2">{featured.title}</h2>
            <p className="mk-lead">{featured.excerpt}</p>
            {featuredOpen && (
              <div className="flex flex-col gap-3">
                {featured.body.map((para) => (
                  <p key={para} className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{para}</p>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setOpen(featuredOpen ? null : featured.id)}
              aria-expanded={featuredOpen}
              className="mt-2 self-start inline-flex items-center gap-2 font-bold"
              style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-accent)' }}
            >
              {featuredOpen ? 'Show less' : 'Read the guide'} <ArrowUpRight size={16} />
            </button>
          </div>
        </article>

        <div className="grid lg:grid-cols-[1fr_320px] gap-10 mt-12">
          {/* Guide grid */}
          <div className="min-w-0">
            <div className="grid sm:grid-cols-2 gap-5">
              {pageItems.map((p) => {
                const isOpen = open === p.id;
                return (
                  <article key={p.id} className="mk-card mk-card--hover flex flex-col gap-3">
                    <span
                      className="self-start"
                      style={{
                        fontSize: 'var(--mk-text-label)',
                        letterSpacing: 'var(--mk-tracking-label)',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        color: 'var(--mk-accent)',
                      }}
                    >
                      {p.category}
                    </span>
                    <h3 className="mk-h3">{p.title}</h3>
                    <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{p.excerpt}</p>
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
                      className="mt-auto inline-flex items-center gap-2 font-bold self-start"
                      style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-accent)' }}
                    >
                      {isOpen ? 'Show less' : 'Read more'}
                      <ArrowRight size={14} className={clsx('transition-transform', isOpen && 'rotate-90')} />
                    </button>
                  </article>
                );
              })}
              {pageItems.length === 0 && (
                <p className="mk-body sm:col-span-2">No guides match that search.</p>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <nav className="mt-10 flex items-center justify-center gap-2 flex-wrap" aria-label="Pagination">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="h-10 w-10 rounded-full flex items-center justify-center disabled:opacity-30"
                  style={{ border: '1px solid var(--mk-line-strong)', color: 'var(--mk-text)' }}
                  aria-label="Previous page"
                >
                  <ArrowLeft size={16} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    aria-current={n === safePage ? 'page' : undefined}
                    className={clsx('h-10 w-10 rounded-full font-bold')}
                    style={
                      n === safePage
                        ? { background: 'var(--mk-accent)', color: '#fff', fontSize: 'var(--mk-text-sm)' }
                        : { border: '1px solid var(--mk-line-strong)', color: 'var(--mk-text-muted)', fontSize: 'var(--mk-text-sm)' }
                    }
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="h-10 w-10 rounded-full flex items-center justify-center disabled:opacity-30"
                  style={{ border: '1px solid var(--mk-line-strong)', color: 'var(--mk-text)' }}
                  aria-label="Next page"
                >
                  <ArrowRight size={16} />
                </button>
              </nav>
            )}
          </div>

          {/* Sidebar */}
          <aside className="flex flex-col gap-5 min-w-0" aria-label="Sidebar">
            <div className="mk-card">
              <h3 className="mk-kicker" style={{ color: 'var(--mk-text-faint)' }}>Search</h3>
              <div
                className="flex items-center gap-2 px-3.5 py-2.5 mt-4"
                style={{ border: '1px solid var(--mk-line)', borderRadius: 'var(--mk-radius)', background: 'var(--mk-surface-2)' }}
              >
                <Search size={15} style={{ color: 'var(--mk-text-faint)' }} />
                <input
                  id="guides-search"
                  name="search"
                  type="search"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Search guides…"
                  className="bg-transparent outline-none flex-1 min-w-0"
                  style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text)' }}
                  aria-label="Search guides"
                />
              </div>
            </div>

            <div className="mk-card">
              <h3 className="mk-kicker" style={{ color: 'var(--mk-text-faint)' }}>All guides</h3>
              <ul className="flex flex-col gap-3 mt-4">
                {POSTS.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        /* Clear filters and jump to the page the guide sits on. */
                        setSearch('');
                        setCategory(null);
                        const idx = rest.findIndex((r) => r.id === p.id);
                        setPage(idx < 0 ? 1 : Math.floor(idx / PAGE_SIZE) + 1);
                        setOpen(p.id);
                      }}
                      className="text-left"
                      style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text-muted)' }}
                    >
                      {p.title}
                    </button>
                    <div className="mt-0.5" style={{ fontSize: 'var(--mk-text-xs)', color: 'var(--mk-text-faint)' }}>{p.category}</div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mk-card">
              <h3 className="mk-kicker" style={{ color: 'var(--mk-text-faint)' }}>Categories</h3>
              <div className="flex flex-wrap gap-2 mt-4">
                {CATEGORIES.map((c) => {
                  const on = category === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-pressed={on}
                      onClick={() => { setCategory(on ? null : c); setPage(1); }}
                      className="px-3 py-1 transition-colors"
                      style={{
                        borderRadius: 'var(--mk-radius-pill)',
                        border: `1px solid ${on ? 'var(--mk-accent)' : 'var(--mk-line)'}`,
                        background: on ? 'var(--mk-accent)' : 'var(--mk-surface-2)',
                        fontSize: 'var(--mk-text-xs)',
                        color: on ? '#ffffff' : 'var(--mk-text-muted)',
                      }}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mk-card" aria-label="Get help">
              <h3 className="mk-kicker" style={{ color: 'var(--mk-text-faint)' }}><LifeBuoy size={13} /> Stuck?</h3>
              <p className="mk-body mt-2 mb-4" style={{ fontSize: 'var(--mk-text-xs)' }}>
                Open a ticket from the Support page in your account, or email {BRAND_SUPPORT_EMAIL}. A person replies.
              </p>
              <Link href="/company/contact" className="mk-btn mk-btn--ghost w-full">Contact support</Link>
            </div>
          </aside>
        </div>

        <p className="mk-meta" style={{ marginTop: 'var(--mk-space-8)', maxWidth: '72ch' }}>{RISK_LINE}</p>
      </Section>

      <CtaBanner
        title="Try it on a demo"
        lead="A $10,000 demo account in one click — no email. Read a guide, then do it."
        primary={{ label: 'Try a free demo', href: '/auth/login' }}
        secondary={{ label: 'More guides', href: '/academy/pdfs' }}
      />
    </main>
  );
}
