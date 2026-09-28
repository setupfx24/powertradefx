'use client';

/**
 * Trading → Forex. The 16 currency pairs you can trade on PowerTradeFX,
 * the conditions that apply to them, and how they are traded in the
 * web terminal.
 */
import { Zap, Clock, ShieldCheck, ListOrdered, Gauge, Layers } from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';
import {
  StatStrip, InstrumentTable, MarketIllustration, TerminalShot, RiskNote, type InstrumentRow,
} from '../_components/MarketPageParts';

const STATS = [
  { label: 'Currency pairs', value: '16' },
  { label: 'Leverage', value: 'Up to 1:500' },
  { label: 'Lot size from', value: '0.01' },
  { label: 'Market hours', value: '24/5' },
];

const HOURS = '24h, Mon–Fri';

const INSTRUMENTS: InstrumentRow[] = [
  { symbol: 'EURUSD', name: 'Euro / US Dollar', hours: HOURS },
  { symbol: 'GBPUSD', name: 'British Pound / US Dollar', hours: HOURS },
  { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen', hours: HOURS },
  { symbol: 'AUDUSD', name: 'Australian Dollar / US Dollar', hours: HOURS },
  { symbol: 'USDCAD', name: 'US Dollar / Canadian Dollar', hours: HOURS },
  { symbol: 'USDCHF', name: 'US Dollar / Swiss Franc', hours: HOURS },
  { symbol: 'NZDUSD', name: 'New Zealand Dollar / US Dollar', hours: HOURS },
  { symbol: 'EURGBP', name: 'Euro / British Pound', hours: HOURS },
  { symbol: 'EURJPY', name: 'Euro / Japanese Yen', hours: HOURS },
  { symbol: 'GBPJPY', name: 'British Pound / Japanese Yen', hours: HOURS },
  { symbol: 'EURCHF', name: 'Euro / Swiss Franc', hours: HOURS },
  { symbol: 'GBPCHF', name: 'British Pound / Swiss Franc', hours: HOURS },
  { symbol: 'AUDJPY', name: 'Australian Dollar / Japanese Yen', hours: HOURS },
  { symbol: 'CADJPY', name: 'Canadian Dollar / Japanese Yen', hours: HOURS },
  { symbol: 'NZDJPY', name: 'New Zealand Dollar / Japanese Yen', hours: HOURS },
  { symbol: 'USDHKD', name: 'US Dollar / Hong Kong Dollar', hours: HOURS },
];

const ORDER_TYPES = [
  { title: 'Market', body: 'Fill at the current bid or ask, straight from the ticket or the one-click widget on the chart.' },
  { title: 'Limit', body: 'Buy below or sell above the current price. Fills at your limit price when the market reaches it.' },
  { title: 'Stop', body: 'Enter on a breakout: the order becomes a market order once your stop level trades.' },
  { title: 'Stop-limit', body: 'When the stop level is hit the order converts to a limit at the price you set, so you control the fill.' },
];

export default function ForexPage() {
  return (
    <main>
      <PageHero
        kicker="Forex"
        title="Trade 16 currency pairs with leverage up to 1:500"
        lead={`Majors, crosses and yen pairs on one ${BRAND_NAME} account. Variable spreads shown live, lots from 0.01, and stop-loss and take-profit on every order.`}
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'Try a free demo', href: '/auth/login' }}
      />

      <Section raised>
        <StatStrip stats={STATS} />

        <div className="grid lg:grid-cols-2 gap-10 items-center mt-14">
          <div className="flex flex-col gap-4">
            <span className="mk-kicker">What you are trading</span>
            <h2 className="mk-h2">Forex, in plain terms</h2>
            <p className="mk-lead">
              A forex trade is a position on one currency against another. Buy EURUSD and you profit if the euro
              strengthens against the dollar; sell it and you profit if the euro weakens. Trades are leveraged, so a
              small margin controls a larger position, and the market runs around the clock from the Sydney open on
              Monday to the New York close on Friday.
            </p>
            <p className="mk-body">
              On {BRAND_NAME} you trade forex as CFDs: you never take delivery of currency, you can go long or short,
              and you can size a position from 0.01 lots upwards.
            </p>
          </div>
          <MarketIllustration symbol="EURUSD" side="Buy" ticket="0.10 lot · SL / TP set" />
        </div>
      </Section>

      <Section>
        <SectionHeading
          kicker="Instruments"
          title="Every forex pair on the platform"
          lead="All 16 pairs are available on live and demo accounts, with the same charting, order types and margin rules."
        />
        <div className="mt-12">
          <InstrumentTable rows={INSTRUMENTS} />
        </div>
      </Section>

      <Section raised>
        <SectionHeading
          kicker="Order types"
          title="Four ways to enter, one way to protect"
          lead="Every order can carry a stop-loss and take-profit, editable later by dragging the line on the chart."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-12">
          {ORDER_TYPES.map((o) => (
            <article key={o.title} className="mk-card flex flex-col gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}>
                <ListOrdered size={18} />
              </span>
              <h3 className="mk-h3">{o.title}</h3>
              <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{o.body}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeading kicker="Why trade forex here" title={`Forex on ${BRAND_NAME}`} />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            {
              icon: Gauge,
              title: 'Leverage that fits your account',
              body: 'Default 1:100, up to 1:500 depending on your account group. Margin, free margin and margin level are always on screen.',
            },
            {
              icon: Zap,
              title: 'One-click trading on the chart',
              body: 'Buy or sell from the widget on the TradingView chart, then drag stop-loss and take-profit lines to adjust them.',
            },
            {
              icon: ShieldCheck,
              title: 'Orders that outlive your browser',
              body: 'Pending orders, stop-loss and take-profit are executed server-side by the engine, so they keep working when you close the tab.',
            },
            {
              icon: Clock,
              title: 'News beside the chart',
              body: 'An economic-news panel inside the terminal shows the releases that move currencies while you trade.',
            },
            {
              icon: Layers,
              title: 'Live spreads, no surprises',
              body: 'The watchlist shows live bid, ask and spread for every pair, and the ticket shows the cost before you confirm.',
            },
            {
              icon: ListOrdered,
              title: 'Practise first',
              body: 'A $10,000 demo account is one click away, no email needed. Same pairs, same charts, same order ticket.',
            },
          ]}
        />
      </Section>

      <Section raised>
        <SectionHeading kicker="The terminal" title="Where you trade it" />
        <div className="mt-12">
          <TerminalShot alt={`The ${BRAND_NAME} web terminal showing a forex chart, the watchlist and the order ticket`} />
        </div>
      </Section>

      <CtaBanner
        title="Start trading forex today"
        lead="Open a live account in minutes, or try the terminal on a free $10,000 demo first."
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'Try a free demo', href: '/auth/login' }}
      />

      <RiskNote />
    </main>
  );
}
