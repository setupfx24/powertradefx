'use client';

/**
 * Trading → Indices. US30, NAS100, GER40 and UK100 as CFDs on PowerTradeFX.
 */
import { Globe, TrendingUp, Clock, ShieldCheck, Gauge, Newspaper } from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';
import {
  StatStrip, InstrumentTable, MarketIllustration, TerminalShot, RiskNote, type InstrumentRow,
} from '../_components/MarketPageParts';

const STATS = [
  { label: 'Indices', value: '4' },
  { label: 'Leverage', value: 'Up to 1:500' },
  { label: 'Lot size from', value: '0.01' },
  { label: 'Direction', value: 'Long or short' },
];

const INSTRUMENTS: InstrumentRow[] = [
  { symbol: 'US30', name: 'Dow Jones Industrial Average (30 US stocks)', hours: 'Market hours, Mon–Fri' },
  { symbol: 'NAS100', name: 'Nasdaq 100 (100 US technology stocks)', hours: 'Market hours, Mon–Fri' },
  { symbol: 'GER40', name: 'DAX 40 (40 German stocks)', hours: 'Market hours, Mon–Fri' },
  { symbol: 'UK100', name: 'FTSE 100 (100 UK stocks)', hours: 'Market hours, Mon–Fri' },
];

export default function IndicesPage() {
  return (
    <main>
      <PageHero
        kicker="Indices"
        title="Trade US30, NAS100, GER40 and UK100"
        lead={`Take a position on a whole stock market in one trade. Four index CFDs on one ${BRAND_NAME} account, long or short, from 0.01 lots.`}
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'Try a free demo', href: '/auth/login' }}
      />

      <Section raised>
        <StatStrip stats={STATS} />

        <div className="grid lg:grid-cols-2 gap-10 items-center mt-14">
          <div className="flex flex-col gap-4">
            <span className="mk-kicker">What you are trading</span>
            <h2 className="mk-h2">Index CFDs, in plain terms</h2>
            <p className="mk-lead">
              An index tracks a basket of shares: the Dow follows 30 large US companies, the Nasdaq 100 the biggest
              US technology names, the DAX 40 Germany&apos;s blue chips and the FTSE 100 the largest UK-listed firms.
              An index CFD lets you trade the level of that basket without buying a single share.
            </p>
            <p className="mk-body">
              Index prices follow the underlying exchange sessions, so each instrument has its own trading hours. The
              watchlist shows when a market is open, and the terminal blocks new orders while it is closed.
            </p>
          </div>
          <MarketIllustration symbol="NAS100" side="Sell" ticket="0.10 lot · SL / TP set" />
        </div>
      </Section>

      <Section>
        <SectionHeading
          kicker="Instruments"
          title="Every index on the platform"
          lead="All four are available on live and demo accounts with the same charting, order types and margin rules."
        />
        <div className="mt-12">
          <InstrumentTable rows={INSTRUMENTS} />
        </div>
      </Section>

      <Section raised>
        <SectionHeading kicker="Why trade indices here" title={`Indices on ${BRAND_NAME}`} />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            {
              icon: Globe,
              title: 'US, Germany and the UK in one list',
              body: 'Wall Street, the Nasdaq, Frankfurt and London on one watchlist, each with live bid, ask and spread.',
            },
            {
              icon: TrendingUp,
              title: 'Go long or short',
              body: 'Sell an index as easily as you buy it. One ticket, one click, and a stop-loss and take-profit on either side.',
            },
            {
              icon: Gauge,
              title: 'Leverage set per account group',
              body: 'Default 1:100, up to 1:500 depending on your account group. Margin and free margin are always on screen.',
            },
            {
              icon: Clock,
              title: 'Pending orders for the open',
              body: 'Place limit, stop or stop-limit orders ahead of the session. The engine fills them at your requested price when the market trades there.',
            },
            {
              icon: Newspaper,
              title: 'The releases that move indices',
              body: 'The economic-news panel inside the terminal shows rate decisions, inflation and jobs data with impact levels.',
            },
            {
              icon: ShieldCheck,
              title: 'Protection that runs server-side',
              body: 'Stop-loss and take-profit are executed by the engine, so a fast move at the open is handled even if your browser is closed.',
            },
          ]}
        />
      </Section>

      <Section>
        <SectionHeading kicker="The terminal" title="Where you trade it" />
        <div className="mt-12">
          <TerminalShot alt={`The ${BRAND_NAME} web terminal showing an index chart, the watchlist and the order ticket`} />
        </div>
      </Section>

      <CtaBanner
        title="Start trading indices"
        lead="Open a live account in minutes, or trade the Nasdaq and the Dow on a free $10,000 demo first."
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'Try a free demo', href: '/auth/login' }}
      />

      <RiskNote />
    </main>
  );
}
