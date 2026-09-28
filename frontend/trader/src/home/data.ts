/**
 * Static content for the marketing home page.
 *
 * PowerTradeFX is an online multi-asset broker. Every line here speaks to
 * a trader (retail or professional) or a partner (IB / affiliate) as the
 * customer, and describes what the live platform actually offers. Only the
 * verified platform facts are stated — no invented client counts, volumes,
 * awards or regulators.
 *
 * Primary CTA everywhere: "Open account" → /auth/register.
 * Secondary CTA: "Try a free demo" → /auth/login (one-click $10,000 demo).
 */

import {
  BRAND_NAME,
  BRAND_LOGO,
  BRAND_LOGO_DARK,
  BRAND_LOGO_LIGHT,
  BRAND_COPYRIGHT,
} from '@/lib/brand';

/** "Open account" — the primary conversion across the site. */
export const SIGNUP_HREF = '/auth/register';

/** Sign-in link. The login page also carries the one-click demo button. */
export const LOGIN_HREF = '/auth/login';

/** "Try a free demo" — provisions a $10,000 demo account instantly, no email. */
export const DEMO_HREF = '/auth/login';

/** Short link to the web terminal. */
export const TERMINAL_HREF = '/trade';

export const BRAND = {
  name: BRAND_NAME,
  tagline: 'Trade forex, gold, indices, oil and crypto on one platform.',
  logo: BRAND_LOGO,
  /** Ink mark — for the white header band. */
  logoDark: BRAND_LOGO_DARK,
  /** Reversed mark — for the black footer band. */
  logoLight: BRAND_LOGO_LIGHT,
};

// Nav targets all resolve to live landing routes. Items with `children`
// render as a dropdown; the parent href points at the first child.
export type NavItem = {
  label: string;
  href: string;
  children?: { label: string; href: string }[];
  /** When true the link points off-site and renders as a plain
   *  <a target="_blank"> instead of a Next <Link>. Unused today. */
  external?: boolean;
};

/**
 * Primary navigation — five menus, each a dropdown of live pages. Other
 * pages on the site link into this structure, so change the hrefs with
 * care.
 */
export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Trading',
    href: '/markets',
    children: [
      { label: 'Markets',          href: '/markets' },
      { label: 'Forex',            href: '/trading/forex' },
      { label: 'Metals & Energy',  href: '/trading/commodities' },
      { label: 'Indices',          href: '/trading/indices' },
      { label: 'Crypto',           href: '/trading/crypto' },
      { label: 'Account Types',    href: '/account-types' },
    ],
  },
  {
    label: 'Platform',
    href: '/platforms/web',
    children: [
      { label: 'Web Terminal',            href: '/platforms/web' },
      { label: 'Copy Trading',            href: '/platforms/copy-trading' },
      { label: 'PAMM',                    href: '/services/portfolio-management' },
      { label: 'AI & Algo Trading',       href: '/platforms/super-admin' },
      { label: 'Deposits & Withdrawals',  href: '/deposit-withdrawal' },
      { label: 'Download',                href: '/download' },
    ],
  },
  {
    label: 'Partners',
    href: '/platforms/ib-management',
    children: [
      { label: 'IB Programme',   href: '/platforms/ib-management' },
      { label: 'Refer a Friend', href: '/products/referral' },
    ],
  },
  {
    label: 'Learn',
    href: '/how-it-works',
    children: [
      { label: 'How it Works', href: '/how-it-works' },
      { label: 'Tutorials',    href: '/education/tutorials' },
      { label: 'Market News',  href: '/education/news' },
      { label: 'FAQ',          href: '/faq' },
    ],
  },
  {
    label: 'Company',
    href: '/company/about',
    children: [
      { label: 'About',            href: '/company/about' },
      { label: 'Why PowerTradeFX', href: '/company/why-powertradefx' },
      { label: 'Careers',          href: '/careers' },
      { label: 'Contact',          href: '/company/contact' },
    ],
  },
];

export const HERO = {
  pill: 'Multi-asset online broker',
  headline: 'Trade forex, gold, indices, oil and crypto on one platform',
  sub: `Open a ${BRAND_NAME} account and trade 40+ instruments with flexible leverage up to 1:500, TradingView charts and orders that keep working after you close the browser. Try it first on a free $10,000 demo.`,
  ctaPrimary: 'Open account',
  ctaSecondary: 'Try a free demo',
  ctaHref: SIGNUP_HREF,
  ctaSecondaryHref: DEMO_HREF,
};

/**
 * Three trust pills rendered under the hero product shot. `icon` is a
 * lucide-react icon name resolved in Hero.tsx. Every figure is a verified
 * platform fact.
 */
export const HERO_TRUST_PILLS = [
  { icon: 'Gauge',      label: '1:500 leverage',  sub: 'Flexible leverage set per account. Lots from 0.01.' },
  { icon: 'LineChart',  label: '40+ instruments', sub: 'Forex, metals, indices, energy and crypto.' },
  { icon: 'Zap',        label: 'Instant demo',    sub: '$10,000 practice account in one click. No email.' },
] as const;

/**
 * Live market strip — illustrative sample of the instruments on the
 * platform. Not a price quote; the rendered ticker uses live data.
 */
export const LIVE_TICKER = [
  { pair: 'EUR/USD', price: '1.0842',  change: '+0.12%', up: true },
  { pair: 'GBP/USD', price: '1.2654',  change: '-0.08%', up: false },
  { pair: 'USD/JPY', price: '149.82',  change: '+0.23%', up: true },
  { pair: 'AUD/USD', price: '0.6512',  change: '+0.08%', up: true },
  { pair: 'XAU/USD', price: '2318.50', change: '+0.45%', up: true },
  { pair: 'XAG/USD', price: '27.14',   change: '-0.31%', up: false },
  { pair: 'US30',    price: '39,120',  change: '+0.36%', up: true },
  { pair: 'NAS100',  price: '17,845',  change: '+0.52%', up: true },
  { pair: 'USOIL',   price: '82.40',   change: '-0.44%', up: false },
  { pair: 'BTC/USD', price: '67,420',  change: '+1.82%', up: true },
  { pair: 'ETH/USD', price: '3,580',   change: '+0.94%', up: true },
  { pair: 'SOL/USD', price: '168.20',  change: '+2.31%', up: true },
];

/** Inline artwork keys understood by <MarketArt />. */
export type ArtKind =
  | 'forex' | 'metals' | 'indices' | 'crypto'
  | 'copy' | 'network' | 'trader' | 'partner';

/**
 * Market cards — the four asset groups on the platform, each linking to
 * its own landing page. `art` selects the inline SVG composition.
 */
export const INSTRUMENTS = [
  {
    art: 'forex' as ArtKind,
    title: 'Forex',
    badge: '16 pairs',
    body: 'Majors and crosses from EUR/USD and GBP/USD to GBP/JPY and USD/HKD, with live bid, ask and spread in the watchlist.',
    href: '/trading/forex',
  },
  {
    art: 'metals' as ArtKind,
    title: 'Gold & Metals',
    badge: 'XAU · XAG · XPT · XPD',
    body: 'Spot gold, silver, platinum and palladium against the US dollar, tradable during metals market hours.',
    href: '/trading/commodities',
  },
  {
    art: 'indices' as ArtKind,
    title: 'Indices & Energy',
    badge: 'US30 · NAS100 · GER40 · UK100 · Oil',
    body: 'Trade the Dow, Nasdaq 100, DAX and FTSE 100 alongside US and UK crude oil, all from one account.',
    href: '/trading/indices',
  },
  {
    art: 'crypto' as ArtKind,
    title: 'Crypto',
    badge: 'Trades 24/7',
    body: 'BTC, ETH, LTC, SOL and XRP against the dollar, open around the clock, seven days a week.',
    href: '/trading/crypto',
  },
] as const;

/**
 * Feature pair — copy trading and the IB programme, the two ways to earn
 * on the platform beyond your own trading.
 */
export const REWARDS = [
  {
    art: 'copy' as ArtKind,
    title: 'Copy trading',
    body: 'Browse the leaderboard of master traders by return, followers or Sharpe ratio. Follow one with the allocation you choose and their trades are mirrored to your live account automatically. Stop any time.',
    href: '/platforms/copy-trading',
  },
  {
    art: 'network' as ArtKind,
    title: 'IB programme',
    body: 'Share your personal referral link and earn a per-lot commission on every trade your referred clients place, plus on the traders your sub-partners bring in. A live dashboard tracks your network, volume and earnings.',
    href: '/platforms/ib-management',
  },
] as const;

/**
 * Checklist beside the terminal screenshot — verified terminal facts.
 */
export const PLATFORM_FEATURES = [
  'TradingView charts with 100+ indicators, drawing tools and timeframes from 1m to 1M',
  'Market, limit, stop and stop-limit orders, with stop-loss and take-profit on every trade',
  'One-click trading from the chart; SL and TP are editable on the chart itself',
  'Balance, equity, margin, free margin and margin level always in view',
  'Orders and SL/TP execute server-side, so they keep working when your browser is closed',
  'Dark and light themes, and fully usable in a phone browser',
] as const;

/**
 * Two audience columns — traders and partners. Every link target is a
 * live route. `art` selects the inline SVG composition.
 */
export const TRADER_PATHS = [
  {
    heading: 'For traders',
    art: 'trader' as ArtKind,
    links: [
      { label: 'Browse markets and instruments', href: '/markets' },
      { label: 'Compare account types',          href: '/account-types' },
      { label: 'Deposits and withdrawals',       href: '/deposit-withdrawal' },
      { label: 'Explore the web terminal',       href: '/platforms/web' },
      { label: 'Open an account',                href: SIGNUP_HREF },
    ],
  },
  {
    heading: 'For partners',
    art: 'partner' as ArtKind,
    links: [
      { label: 'IB programme',                   href: '/platforms/ib-management' },
      { label: 'Refer a friend',                 href: '/products/referral' },
      { label: 'Become a copy-trading master',   href: '/platforms/copy-trading' },
      { label: 'Manage a PAMM account',          href: '/services/portfolio-management' },
      { label: 'Contact the partnerships team',  href: '/company/contact' },
    ],
  },
] as const;

/**
 * "Why choose us" — benefit-led, trader framing. Only verified facts.
 */
export const WHY_US = [
  { icon: 'Zap',         title: 'Instant demo',              body: 'One click on the sign-in page gives you a $10,000 practice account. No email, no waiting.' },
  { icon: 'Gauge',       title: 'Flexible leverage',         body: 'Trade with leverage up to 1:500 and lot sizes from 0.01. Leverage is set per account group; the default is 1:100.' },
  { icon: 'ShieldCheck', title: 'Orders that keep working',  body: 'Stop-loss, take-profit and pending orders are executed by our engine server-side, not in your browser tab.' },
  { icon: 'Wallet',      title: 'Crypto and local funding',  body: 'Deposit and withdraw with USDT (TRC20, BEP20, ERC20), bank transfer or UPI. Move money between your accounts and wallet instantly.' },
  { icon: 'Users',       title: 'Copy trading and PAMM',     body: 'Follow master traders with an allocation you choose, or invest with approved PAMM managers. Stop whenever you like.' },
  { icon: 'Lock',        title: 'Account security',          body: 'Password plus optional two-factor authentication, Google sign-in, session protection and encrypted connections.' },
] as const;

/**
 * The three ways to trade on the platform.
 */
export const PLATFORMS = [
  { icon: 'Globe2', title: 'Web terminal',          body: 'TradingView charts, order ticket, watchlist and account panel in your browser, on desktop or phone.', href: '/platforms/web' },
  { icon: 'Bot',    title: 'AI & Algo trading',     body: 'Describe a strategy in plain language, backtest it and deploy it, or connect your own bot through the API.', href: '/platforms/super-admin' },
  { icon: 'Users',  title: 'Copy trading & PAMM',   body: 'Mirror a master trader with a chosen allocation, or invest with approved PAMM managers.', href: '/platforms/copy-trading' },
] as const;

export const HOW_IT_WORKS = [
  { n: '1', title: 'Register',       body: 'Create your login with an email and password, or sign in with Google. Try the free $10,000 demo first if you like.' },
  { n: '2', title: 'Verify & fund',  body: 'Upload a government ID and a selfie for KYC, then deposit with USDT, bank transfer or UPI from your wallet.' },
  { n: '3', title: 'Trade',         body: 'Open a live account, pick from 40+ instruments and trade from the web terminal on desktop or phone.' },
] as const;

/** Heading for the stats panel. Qualitative by design — no client counts. */
export const STATS_HEADING = {
  title: 'One account, five asset classes',
  lead: 'Forex, metals, indices, energy and crypto on a terminal that runs in your browser.',
};

/**
 * Verifiable platform facts only — nothing about trading outcomes.
 */
export const STATS = [
  { value: '40+',   label: 'Instruments' },
  { value: '1:500', label: 'Max leverage' },
  { value: '5',     label: 'Asset classes' },
  { value: '24/7',  label: 'Crypto trading' },
] as const;

export const FAQ = [
  {
    q: 'How do I open an account?',
    a: `Register at ${BRAND_NAME} with an email and password, or sign in with Google. Once you are in, open a live account from the accounts page in the app, choosing the account type and leverage you want. You can hold several accounts under one login and transfer funds between them and your main wallet.`,
  },
  {
    q: 'Is there a demo account?',
    a: 'Yes. The sign-in page has a one-click "Try with demo" button that creates a $10,000 demo account instantly, with no email required. The demo uses the same terminal and live prices as a real account. Demo accounts cannot deposit or withdraw.',
  },
  {
    q: 'How do I deposit and withdraw?',
    a: 'Deposit from the wallet by crypto (USDT on TRC20, BEP20 or ERC20) or by local banking (bank transfer or UPI via a payment link). Withdraw to USDT or to your bank or UPI. Crypto withdrawals are typically processed the same day; bank withdrawals are reviewed by our team. Identity verification (KYC) is required before your first withdrawal.',
  },
  {
    q: 'What leverage and lot sizes can I trade?',
    a: 'Leverage is flexible up to 1:500 and is set per account group; the default is 1:100. Lot sizes start from 0.01. Leverage magnifies both gains and losses, so choose a level that suits your risk tolerance.',
  },
  {
    q: 'How does copy trading work?',
    a: 'The leaderboard lists master traders sorted by return, followers or Sharpe ratio. Pick one, choose how much of your balance to allocate, and their trades are mirrored to your account automatically. Masters may charge a performance fee on profits. You can stop following at any time. Copy trading requires a live account.',
  },
  {
    q: 'How does the IB programme work?',
    a: 'Apply in the app and you get a personal referral link and code. Commission is calculated per lot at the moment a referred trade fills and released when that trade closes. The network is multi-level, so you also earn on traders your sub-partners bring in. Payouts are reviewed and approved by our team, and a live dashboard tracks your network, volume and earnings.',
  },
  {
    q: 'How is my account kept secure?',
    a: 'Your login is protected by a password and optional TOTP two-factor authentication, with Google sign-in available. Sessions are protected and every connection is encrypted. Funds and trading data run on segregated infrastructure, and withdrawals require identity verification.',
  },
] as const;

export const CTA = {
  headline: `Start trading with ${BRAND_NAME}`,
  sub: 'Open an account in minutes, or try the free $10,000 demo first. Forex, gold, indices, oil and crypto on one terminal.',
  primary: 'Open account',
  secondary: 'Try a free demo',
  href: SIGNUP_HREF,
  secondaryHref: DEMO_HREF,
};

/**
 * Footer columns are derived from NAV_ITEMS so the footer can never drift
 * from the header.
 */
const navChildren = (label: string) =>
  NAV_ITEMS.find((item) => item.label === label)?.children ?? [];

export const FOOTER_TRADING = navChildren('Trading');
export const FOOTER_PLATFORM = navChildren('Platform');
export const FOOTER_PARTNERS_LEARN = [...navChildren('Partners'), ...navChildren('Learn')];
export const FOOTER_COMPANY = navChildren('Company');

export const FOOTER_COLUMNS = [
  { title: 'Trading',          links: FOOTER_TRADING },
  { title: 'Platform',         links: FOOTER_PLATFORM },
  { title: 'Partners & Learn', links: FOOTER_PARTNERS_LEARN },
  { title: 'Company',          links: FOOTER_COMPANY },
] as const;

/* Legal links for the footer bottom bar. */
export const FOOTER_LEGAL = [
  { label: 'Terms of Service',     href: '/terms' },
  { label: 'Privacy Policy',       href: '/privacy' },
  { label: 'Risk Disclosure',      href: '/risk' },
  { label: 'Risk Warning',         href: '/risk-warning' },
  { label: 'Restricted Countries', href: '/restricted-countries' },
  { label: 'Delete Account',       href: '/delete-account' },
] as const;

export const COPYRIGHT = BRAND_COPYRIGHT;

/**
 * Broker risk warning. Rendered in every footer.
 */
export const RISK_DISCLAIMER =
  `Trading leveraged products such as forex and CFDs carries a high level of risk and may not be suitable for all investors. You could lose more than your initial deposit. Make sure you understand the risks involved and seek independent advice if necessary. Nothing on this site is investment advice or a recommendation to trade. ${BRAND_NAME} does not offer its services to residents of certain jurisdictions; see our restricted countries page.`;
