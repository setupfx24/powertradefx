import type { Metadata } from 'next';
import Link from 'next/link';
import { Section, SectionHeading, PageHero, CtaBanner, FaqAccordion, type FaqItem } from '@/marketing/components';
import { BRAND_NAME, BRAND_SUPPORT_EMAIL } from '@/lib/brand';

/**
 * Standalone trader FAQ.
 *
 * Organised the way a trader's questions arrive: getting started,
 * accounts & KYC, deposits & withdrawals, trading & platform, copy
 * trading & PAMM, partners, security. Every answer describes what the
 * live platform does; nothing here is a projection or a promise.
 */

export const metadata: Metadata = {
  title: `Frequently Asked Questions | ${BRAND_NAME}`,
  description: `Answers to the most common questions about trading with ${BRAND_NAME} — demo and live accounts, KYC, deposits and withdrawals, the terminal, copy trading, PAMM, the partner programme and security.`,
};

const RISK_LINE =
  'Trading leveraged products such as forex and CFDs carries a high level of risk and may not be suitable for all investors. You could lose more than your initial deposit.';

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 flex flex-col gap-1.5">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3">
          <span
            className="shrink-0 rounded-full"
            style={{ width: '5px', height: '5px', marginTop: '0.62em', background: 'var(--mk-accent)' }}
          />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

/* ── Getting started ─────────────────────────────────────────────────── */
const GETTING_STARTED: FaqItem[] = [
  {
    q: `What is ${BRAND_NAME}?`,
    a: `${BRAND_NAME} is an online multi-asset broker. You trade forex, metals, indices, energy and crypto CFDs from one account in a web terminal, with copy trading, PAMM, an AI strategy builder, a bot API and a partner programme built in.`,
  },
  {
    q: 'How do I try the platform without opening an account?',
    a: (
      <>
        <p>
          Go to <Link href="/auth/login" className="mk-link">Sign in</Link> and press{' '}
          <strong>Try with demo</strong>. A $10,000 demo account is provisioned instantly — no email,
          no form. You get the full terminal, every instrument and every order type.
        </p>
      </>
    ),
  },
  {
    q: 'How do I open a live account?',
    a: (
      <>
        <p>
          <Link href="/auth/register" className="mk-link">Register</Link> with email and password or
          Google, then open a live account from inside the app. Two account types are available:
        </p>
        <Bullets items={[
          'Standard — entry level, commission-free, competitive spreads.',
          'Pro — tighter spreads and priority support.',
        ]} />
      </>
    ),
  },
  {
    q: 'What can I trade?',
    a: (
      <>
        <p>40+ instruments across five classes:</p>
        <Bullets items={[
          'Forex — EURUSD, GBPUSD, USDJPY, AUDUSD, USDCAD, USDCHF, NZDUSD and the main crosses.',
          'Metals — gold, silver, platinum, palladium.',
          'Indices — US30, NAS100, GER40, UK100.',
          'Energy — US oil, UK oil.',
          'Crypto — BTC, ETH, LTC, SOL, XRP (trades 24/7).',
        ]} />
      </>
    ),
  },
];

/* ── Accounts & KYC ──────────────────────────────────────────────────── */
const ACCOUNTS: FaqItem[] = [
  {
    q: 'What does KYC involve?',
    a: 'A government-issued ID, a selfie and proof of address, uploaded from the KYC page inside your account. You can trade on a demo without it; a verified account is required before your first withdrawal.',
  },
  {
    q: 'Can I hold more than one trading account?',
    a: 'Yes. You can open several accounts under one login — for example a Standard and a Pro account, or separate accounts for manual and copy trading — and move funds between them and your main wallet with internal transfers.',
  },
  {
    q: 'What leverage do I get?',
    a: 'Leverage is flexible up to 1:500 and set per account group; the default is 1:100. Higher leverage increases both potential gains and potential losses, so size positions with the margin calculator before you trade.',
  },
  {
    q: 'Is there a minimum deposit?',
    a: 'Live accounts have a low minimum deposit. The exact figure is shown on the deposit screen for the method you choose. Demo accounts cannot deposit at all — they are for practice only.',
  },
  {
    q: 'How do I delete my account?',
    a: (
      <>
        Request deletion from the{' '}
        <Link href="/delete-account" className="mk-link">delete account</Link> page. Withdraw any
        balance first; we cannot release funds after the account is closed.
      </>
    ),
  },
];

/* ── Deposits & withdrawals ──────────────────────────────────────────── */
const FUNDING: FaqItem[] = [
  {
    q: 'How can I deposit?',
    a: (
      <>
        <p>From the Wallet page in your account:</p>
        <Bullets items={[
          'Crypto — USDT on TRC20, BEP20 or ERC20.',
          'Local banking — bank transfer or UPI via a payment link.',
        ]} />
        <p className="mt-3">Every deposit appears in your transaction history as soon as it is credited.</p>
      </>
    ),
  },
  {
    q: 'How do withdrawals work?',
    a: 'Request a withdrawal from your wallet to USDT or to bank/UPI. Crypto withdrawals are typically same-day; bank and UPI withdrawals are reviewed by our team before they are released. You need a KYC-verified account to withdraw.',
  },
  {
    q: 'Can I move money between my accounts?',
    a: 'Yes. Internal transfers move funds between any of your trading accounts and your main wallet instantly, and each transfer is logged in your history.',
  },
  {
    q: 'Why can I not deposit into my demo account?',
    a: 'Demo accounts hold virtual funds only. To trade with real money, open a live account from inside the app and fund it from the wallet.',
  },
];

/* ── Trading & platform ──────────────────────────────────────────────── */
const TRADING: FaqItem[] = [
  {
    q: 'What does the web terminal include?',
    a: (
      <>
        <Bullets items={[
          'TradingView-powered charts — 100+ indicators, drawing tools, timeframes from 1m to 1M.',
          'Watchlist with live bid, ask and spread.',
          'Order ticket with market, limit, stop and stop-limit orders; stop-loss and take-profit on every order.',
          'One-click trading widget on the chart; SL/TP editable from the chart.',
          'Positions, pending orders and closed-trade history; balance, equity, margin, free margin and margin level always visible.',
          'Economic-news panel, share-a-trade cards, dark and light themes.',
        ]} />
        <p className="mt-3">
          It runs in any browser, including on a phone, with a mobile order sheet. Open it at{' '}
          <Link href="/trade" className="mk-link">/trade</Link> after sign-in.
        </p>
      </>
    ),
  },
  {
    q: 'What happens to my orders if I close the browser?',
    a: 'Nothing changes. Orders, stop-loss and take-profit are held and executed server-side by the engine, so they keep working when your browser is closed or your connection drops.',
  },
  {
    q: 'At what price do pending orders fill?',
    a: 'Limit orders fill at the limit price. A stop-limit order converts to a limit order when the stop price is hit, and then fills at the limit price. Market orders fill at the live quote.',
  },
  {
    q: 'Is there a mobile or desktop app?',
    a: 'The web terminal is fully usable in a phone browser today. An Android app is coming soon. A native desktop terminal for Windows and macOS is available on request.',
  },
  {
    q: 'Can I run a bot or an automated strategy?',
    a: (
      <>
        <p>Two ways:</p>
        <Bullets items={[
          'AI Strategy Builder — describe a strategy in plain language (or start from a template such as trend following, breakout or gold scalper), backtest it, then deploy it on your account. AI trades are tagged separately from manual ones.',
          'Algo Connector — a per-account API key and secret, REST endpoints for BUY / SELL / CLOSE, account and positions, and a WebSocket tick stream. Same execution path and risk checks as the terminal.',
        ]} />
      </>
    ),
  },
  {
    q: 'Where do I find the economic calendar and news?',
    a: 'Inside your account on the News page — an economic calendar with impact levels plus live headlines — and in the news panel of the terminal.',
  },
];

/* ── Copy trading & PAMM ─────────────────────────────────────────────── */
const COPY: FaqItem[] = [
  {
    q: 'How does copy trading work?',
    a: 'Browse the leaderboard of master traders, sorted by return, followers or Sharpe ratio. Follow one with an allocation you choose and their trades are mirrored to your account automatically. You can stop following at any time. Copy trading requires a live account.',
  },
  {
    q: 'What does a master trader charge?',
    a: 'Masters can set a performance fee, shown on their profile before you follow. There is no fee on losing periods.',
  },
  {
    q: 'What is PAMM and how is it different?',
    a: 'PAMM is a pooled managed account. You invest with an approved manager and gains and losses are shared in proportion to your share of the pool. Managers apply in-app, are reviewed before they are listed, and are paid a performance fee. The PAMM page sorts managers by ROI.',
  },
  {
    q: 'Can a master or a manager withdraw my money?',
    a: 'No. Following a master or investing with a PAMM manager gives them no access to your wallet. Deposits and withdrawals are always yours to make.',
  },
];

/* ── Partners ────────────────────────────────────────────────────────── */
const PARTNERS: FaqItem[] = [
  {
    q: 'How do I become an IB or affiliate?',
    a: 'Apply from the Business page inside your account. Once approved you get a personal referral link and code, and a live dashboard of your network, trading volume and earnings.',
  },
  {
    q: 'How is IB commission calculated?',
    a: 'Per lot, at the moment a referred trade fills. The commission is released when that trade closes. Payouts are reviewed and approved by the team. Demo trades never earn commission.',
  },
  {
    q: 'Do I earn on traders my sub-partners bring in?',
    a: 'Yes. The programme is multi-level, so you earn on the network your sub-partners build as well as on the traders you refer directly.',
  },
  {
    q: 'Is there a refer-a-friend programme for ordinary traders?',
    a: (
      <>
        Yes. Every account has a share link and referral code; a friend who signs up with it is linked
        to you. Details are on the{' '}
        <Link href="/products/referral" className="mk-link">referral</Link> page.
      </>
    ),
  },
];

/* ── Security ────────────────────────────────────────────────────────── */
const SECURITY: FaqItem[] = [
  {
    q: 'How is my account protected?',
    a: 'Password plus optional TOTP two-factor authentication, Google sign-in, session protection and encrypted connections. Turn on two-factor authentication from your account settings — it takes a minute.',
  },
  {
    q: 'Where are my funds and trading data kept?',
    a: 'On segregated infrastructure, separate from the marketing site. Every deposit, withdrawal and transfer is recorded in your wallet history.',
  },
  {
    q: 'Which countries are restricted?',
    a: (
      <>
        See the <Link href="/restricted-countries" className="mk-link">restricted countries</Link> page.
        We cannot open accounts for residents of the jurisdictions listed there.
      </>
    ),
  },
  {
    q: 'How do I reach support?',
    a: (
      <>
        Open a ticket from the Support page inside your account — it is linked to your account, so we
        can look at the exact deposit, document or trade you mean. Or email{' '}
        <a href={`mailto:${BRAND_SUPPORT_EMAIL}`} className="mk-link">{BRAND_SUPPORT_EMAIL}</a>.
      </>
    ),
  },
];

const GROUPS: { id: string; kicker: string; title: string; items: FaqItem[] }[] = [
  { id: 'getting-started', kicker: 'Getting started',          title: 'Getting started',          items: GETTING_STARTED },
  { id: 'accounts',        kicker: 'Accounts & KYC',           title: 'Accounts & KYC',           items: ACCOUNTS },
  { id: 'funding',         kicker: 'Deposits & withdrawals',   title: 'Deposits & withdrawals',   items: FUNDING },
  { id: 'trading',         kicker: 'Trading & platform',       title: 'Trading & platform',       items: TRADING },
  { id: 'copy-trading',    kicker: 'Copy trading & PAMM',      title: 'Copy trading & PAMM',      items: COPY },
  { id: 'partners',        kicker: 'Partners',                 title: 'Partners',                 items: PARTNERS },
  { id: 'security',        kicker: 'Security',                 title: 'Security',                 items: SECURITY },
];

export default function FaqPage() {
  return (
    <main>
      <PageHero
        kicker="Support"
        title="Frequently asked questions"
        lead={`Everything traders ask before and after opening a ${BRAND_NAME} account. Can't find it here? Open a ticket or email us.`}
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'Try a free demo', href: '/auth/login' }}
      />

      {GROUPS.map((group, i) => (
        <Section key={group.id} id={group.id} raised={i % 2 === 0}>
          <SectionHeading align="left" kicker={group.kicker} title={group.title} />
          <div className="mt-8 max-w-3xl">
            <FaqAccordion items={group.items} />
          </div>
        </Section>
      ))}

      <Section raised={GROUPS.length % 2 === 0} className="mk-section--tight">
        <p className="mk-meta" style={{ maxWidth: '72ch' }}>{RISK_LINE}</p>
      </Section>

      <CtaBanner
        title="Still have a question?"
        lead={`Open a ticket from your account, or email ${BRAND_SUPPORT_EMAIL} — a person replies.`}
        primary={{ label: 'Contact us', href: '/company/contact' }}
        secondary={{ label: 'Try a free demo', href: '/auth/login' }}
      />
    </main>
  );
}
