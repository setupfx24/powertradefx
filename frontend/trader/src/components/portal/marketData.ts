/**
 * Single source of truth for what the marketing site says the platform
 * lists. The home page deck, /markets, /classes and /sessions all read
 * from here, so the numbers quoted in one place cannot drift from
 * another. PortalPage additionally asserts the class/instrument tally at
 * runtime in development.
 *
 * CONTENT RULES — this fronts a live brokerage:
 *   - Symbols mirror what the platform actually lists (see
 *     components/trading/Watchlist.tsx and InstrumentsTable.tsx).
 *   - Session times are standard market hours in UTC. They are a
 *     description of the market, not a promise about this venue.
 *   - No spreads, leverage figures, fees, execution speeds, user counts,
 *     awards or regulator names. None of those are verifiable from this
 *     repo, and quoting them wrongly on a broker site is a real problem.
 */

export type Instrument = {
  /** Display symbol, e.g. EUR/USD. */
  symbol: string;
  name: string;
  /** Must match an AssetClass.name below. */
  klass: string;
  /** Short qualifier shown as the card's right-hand label. */
  kind: string;
  hours: string;
};

export const INSTRUMENTS: Instrument[] = [
  { symbol: 'EUR/USD', name: 'Euro / US Dollar', klass: 'Forex', kind: 'Major', hours: '24/5' },
  { symbol: 'GBP/USD', name: 'Pound Sterling / US Dollar', klass: 'Forex', kind: 'Major', hours: '24/5' },
  { symbol: 'XAU/USD', name: 'Gold / US Dollar', klass: 'Metals', kind: 'Spot', hours: '24/5' },
  { symbol: 'US30', name: 'US 30 index CFD', klass: 'Indices', kind: 'Cash', hours: 'Cash hours' },
  { symbol: 'BTC/USD', name: 'Bitcoin / US Dollar', klass: 'Crypto', kind: '24/7', hours: '24/7' },
  { symbol: 'USOIL', name: 'WTI crude / US Dollar', klass: 'Energy', kind: 'Spot', hours: '24/5' },
];

/**
 * The instruments the home-page deck flips through.
 *
 * The deck is a SAMPLE, not the catalogue: /markets lists all of
 * INSTRUMENTS, and any heading quoting a number still counts the full
 * array, so "Six markets, one account." stays true above a three-card
 * deck. One instrument per class, so three cards still show the breadth.
 *
 * Symbols, not indices — reordering INSTRUMENTS must not silently change
 * which cards the home page shows. Each entry also names the sleeve image
 * its card carries, from public/portal/.
 */
export const FEATURED_CARDS = [
  { symbol: 'EUR/USD', art: '/portal/card1.png' },
  { symbol: 'XAU/USD', art: '/portal/card2.png' },
  { symbol: 'BTC/USD', art: '/portal/card3.png' },
];

/** A featured instrument plus the sleeve image its card carries. */
export type FeaturedInstrument = Instrument & { art: string };

export const FEATURED_INSTRUMENTS: FeaturedInstrument[] = FEATURED_CARDS.flatMap((f) => {
  const found = INSTRUMENTS.find((i) => i.symbol === f.symbol);
  return found ? [{ ...found, art: f.art }] : [];
});

/* A renamed symbol would quietly drop a card rather than fail, so say so. */
if (
  process.env.NODE_ENV !== 'production' &&
  FEATURED_INSTRUMENTS.length !== FEATURED_CARDS.length
) {
  console.error(
    `[portal] FEATURED_CARDS names ${FEATURED_CARDS.length} instruments but only ${FEATURED_INSTRUMENTS.length} matched INSTRUMENTS.`,
  );
}

export type AssetClass = {
  name: string;
  /** URL segment for /classes/[slug]. Lowercase, no spaces. */
  slug: string;
  /** Small uppercase accent label. */
  tag: string;
  /** Singular noun; the roster pluralises it. */
  unit: string;
  blurb: string;
  /* ── Fields below are used only by the /classes/[slug] page. ──
     They describe HOW A MARKET WORKS, which is public knowledge, and
     never how this venue prices it. Keep it that way: no spreads,
     leverage, commissions, execution claims or regulator names. */
  /** Opening paragraph: what the instrument actually is. */
  how: string;
  /** Plain-language summary of the trading clock. */
  clock: string;
  /** What tends to move the class. Three per class keeps the page even. */
  drivers: { label: string; text: string }[];
};

export const ASSET_CLASSES: AssetClass[] = [
  {
    name: 'Forex',
    slug: 'forex',
    tag: '24/5',
    unit: 'pair',
    blurb:
      'Currency pairs quoted one against another. Liquidity follows the clock rather than a single exchange, which is why the sessions page exists.',
    how:
      'A forex quote prices one currency in another. In EUR/USD the euro is the base and the dollar the quote, so the number on the chart is how many dollars one euro buys — when it rises, the euro strengthened, or the dollar weakened, and telling those two apart is most of the work. There is no central exchange behind any of it: the market is a network of banks and brokers, which is why it runs continuously from the Sydney open on Monday to the New York close on Friday.',
    clock: 'Continuous from the Sydney open to the New York close, then closed for the weekend.',
    drivers: [
      {
        label: 'Rates',
        text: 'The gap between two countries’ interest rates, and the central bank decisions that widen or close it.',
      },
      {
        label: 'Data',
        text: 'Inflation, employment and growth releases, mostly because of how they reprice expectations for those rates.',
      },
      {
        label: 'Liquidity',
        text: 'The same headline moves price further outside the main sessions, when fewer participants are quoting.',
      },
    ],
  },
  {
    name: 'Metals',
    slug: 'metals',
    tag: 'Spot',
    unit: 'market',
    blurb:
      'Spot metal quoted against the US dollar, trading on the same round-the-clock weekday rail as forex.',
    how:
      'XAU/USD is the dollar price of one troy ounce of gold — XAU is the metal’s currency code, which is why it is quoted in the same base/quote shape as a currency pair. Spot means the price for immediate settlement rather than a dated futures contract, so there is no expiry to roll and no delivery month on the chart. It trades on the same weekday rail as forex rather than on one exchange’s hours.',
    clock: 'The forex rail — continuous through the weekday, closed at the weekend.',
    drivers: [
      {
        label: 'Real yields',
        text: 'Gold pays no coupon, so it competes with inflation-adjusted bond yields. When they fall, holding it costs less.',
      },
      {
        label: 'The dollar',
        text: 'It is priced in dollars, so a stronger dollar alone can push the quote down without demand for the metal changing.',
      },
      {
        label: 'Risk',
        text: 'Demand tends to rise when investors are moving out of assets they see as riskier.',
      },
    ],
  },
  {
    name: 'Indices',
    slug: 'indices',
    tag: 'Cash',
    unit: 'market',
    blurb:
      'A cash CFD on a stock index rather than the individual shares, tracking the underlying during its own exchange hours.',
    how:
      'An index CFD tracks the level of a stock index instead of the shares inside it, so a single position takes a view on the whole basket rather than on one company’s results. Cash means it follows the index itself rather than a dated futures contract — nothing expires, and nothing is delivered, because the position settles in cash against the level. Since it shadows a real exchange, it only moves while that exchange is trading.',
    clock: 'Cash hours only — the index is still while its exchange is closed.',
    drivers: [
      {
        label: 'Earnings',
        text: 'Results season moves the constituents, and the index follows them in proportion to their weight.',
      },
      {
        label: 'Rates',
        text: 'Policy expectations reprice the whole market at once, which shows up in the index before any single name.',
      },
      {
        label: 'Concentration',
        text: 'An index is weighted, not an average — a handful of the largest constituents can carry the level on their own.',
      },
    ],
  },
  {
    name: 'Crypto',
    slug: 'crypto',
    tag: '24/7',
    unit: 'market',
    blurb:
      'The only class here that does not stop for the weekend. Quoted against the US dollar like everything else on the platform.',
    how:
      'BTC/USD reads like any other pair on this list — the dollar price of one bitcoin. What sets the class apart is the clock. There is no exchange to close and no settlement day to stop for, so it keeps trading straight through the weekend while every other market here is shut. That cuts both ways: a position stays exposed on a Saturday, when there is nobody to hand it to.',
    clock: 'Continuous, including weekends and public holidays.',
    drivers: [
      {
        label: 'Flows',
        text: 'Money moving into and out of the asset class as a whole, rather than anything specific to one coin.',
      },
      {
        label: 'Sentiment',
        text: 'It reacts to risk appetite quickly, and often before slower markets have opened to react at all.',
      },
      {
        label: 'Thin hours',
        text: 'Weekend liquidity is lighter than midweek, so the same size can move the quote further.',
      },
    ],
  },
  {
    name: 'Energy',
    slug: 'energy',
    tag: 'Spot',
    unit: 'market',
    blurb:
      'Spot crude quoted against the US dollar, following the weekday rail with the usual daily settlement break.',
    how:
      'USOIL is WTI crude — West Texas Intermediate, the light, sweet grade that the US benchmark is built on — quoted in dollars per barrel. Unlike an index it is a physical commodity, so the story is supply: barrels have to be produced, shipped and stored somewhere, and the cost of doing that shows up in the price. It follows the weekday rail with the usual daily settlement break.',
    clock: 'Weekday rail, with the usual daily settlement break.',
    drivers: [
      {
        label: 'Inventories',
        text: 'Weekly stock reports say whether barrels are building up or being drawn down, which is supply and demand stated plainly.',
      },
      {
        label: 'Supply policy',
        text: 'Coordinated production decisions by the large exporters change how much crude reaches the market.',
      },
      {
        label: 'Demand',
        text: 'Industrial activity and the travel season set how much is actually burned, so growth data reads through to the price.',
      },
    ],
  },
];

export type Session = {
  city: string;
  /** UTC hour the session opens / closes. `open > close` means it wraps midnight. */
  open: number;
  close: number;
  focus: string;
  /** Marks the deepest-liquidity window; styled in the amber accent. */
  peak?: boolean;
};

export const SESSIONS: Session[] = [
  { city: 'Sydney', open: 22, close: 7, focus: 'AUD · NZD' },
  { city: 'Tokyo', open: 0, close: 9, focus: 'JPY crosses' },
  { city: 'London', open: 8, close: 17, focus: 'EUR · GBP · CHF', peak: true },
  { city: 'New York', open: 13, close: 22, focus: 'USD · CAD' },
];

/** `08:00` from `8`. */
export const hh = (h: number): string => `${String(h).padStart(2, '0')}:00`;

const WORDS = [
  'zero', 'one', 'two', 'three', 'four', 'five',
  'six', 'seven', 'eight', 'nine', 'ten',
];

/** Number as a capitalised word, so headings can read "Six markets"
 *  while still being DERIVED from the arrays above — add an instrument
 *  and the copy follows instead of quietly going stale. */
export const Word = (n: number): string => {
  const w = WORDS[n];
  return w ? w.charAt(0).toUpperCase() + w.slice(1) : String(n);
};

export const instrumentsIn = (klass: string): Instrument[] =>
  INSTRUMENTS.filter((i) => i.klass === klass);

export const countIn = (klass: string): number => instrumentsIn(klass).length;

/** Route for a class's detail page. One definition, so the roster link
 *  and the page that answers it can never disagree. */
export const classHref = (slug: string): string => `/classes/${slug}`;

export const classBySlug = (slug: string): AssetClass | undefined =>
  ASSET_CLASSES.find((c) => c.slug === slug);
