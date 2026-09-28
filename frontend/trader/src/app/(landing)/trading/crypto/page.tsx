'use client';

/**
 * Trading → Crypto. BTC, ETH, LTC, SOL and XRP against the US dollar as
 * CFDs on PowerTradeFX, 24/7.
 */
import { ShieldCheck, Zap, TrendingDown, Clock, Gauge, KeyRound } from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';
import {
  StatStrip, InstrumentTable, MarketIllustration, TerminalShot, RiskNote, type InstrumentRow,
} from '../_components/MarketPageParts';

const STATS = [
  { label: 'Crypto pairs', value: '5' },
  { label: 'Market hours', value: '24/7' },
  { label: 'Leverage', value: 'Up to 1:500' },
  { label: 'Lot size from', value: '0.01' },
];

const HOURS = '24/7';

const INSTRUMENTS: InstrumentRow[] = [
  { symbol: 'BTCUSD', name: 'Bitcoin / US Dollar', hours: HOURS },
  { symbol: 'ETHUSD', name: 'Ethereum / US Dollar', hours: HOURS },
  { symbol: 'LTCUSD', name: 'Litecoin / US Dollar', hours: HOURS },
  { symbol: 'SOLUSD', name: 'Solana / US Dollar', hours: HOURS },
  { symbol: 'XRPUSD', name: 'XRP / US Dollar', hours: HOURS },
];

export default function CryptoPage() {
  return (
    <main>
      <PageHero
        kicker="Crypto"
        title="Trade Bitcoin, Ethereum, Litecoin, Solana and XRP, 24/7"
        lead={`Five crypto CFDs on one ${BRAND_NAME} account. No wallet, no exchange, no keys to lose: go long or short from 0.01 lots, any day of the week.`}
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'Try a free demo', href: '/auth/login' }}
      />

      <Section raised>
        <StatStrip stats={STATS} />

        <div className="grid lg:grid-cols-2 gap-10 items-center mt-14">
          <div className="flex flex-col gap-4">
            <span className="mk-kicker">What you are trading</span>
            <h2 className="mk-h2">Crypto CFDs, in plain terms</h2>
            <p className="mk-lead">
              A crypto CFD is a position on the dollar price of a coin. Buy BTCUSD and you profit if bitcoin rises;
              sell it and you profit if it falls. You never hold the coin, so there is nothing to store, transfer or
              secure, and the position sits in the same account as your forex, metals and index trades.
            </p>
            <p className="mk-body">
              Crypto is the one market on {BRAND_NAME} that never closes. Prices stream and orders fill 24 hours a day,
              seven days a week, including weekends.
            </p>
          </div>
          <MarketIllustration symbol="BTCUSD" side="Buy" ticket="0.01 lot · SL / TP set" />
        </div>
      </Section>

      <Section>
        <SectionHeading
          kicker="Instruments"
          title="Every crypto pair on the platform"
          lead="All five are available on live and demo accounts, with the same charting, order types and margin rules."
        />
        <div className="mt-12">
          <InstrumentTable rows={INSTRUMENTS} />
        </div>
      </Section>

      <Section raised>
        <SectionHeading kicker="Why trade crypto here" title={`Crypto on ${BRAND_NAME}`} />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            {
              icon: KeyRound,
              title: 'No wallet, no keys',
              body: 'Trade the price without holding the coin. Nothing to store, nothing to lose, and your funds stay in your trading account.',
            },
            {
              icon: Clock,
              title: 'Open every day',
              body: 'Crypto trades 24/7. Weekend moves are tradable, and server-side stop-loss and take-profit cover you while you are away.',
            },
            {
              icon: TrendingDown,
              title: 'Short as easily as you buy',
              body: 'Sell from the ticket or the one-click widget on the chart. Falling prices are a trade, not a wait.',
            },
            {
              icon: Gauge,
              title: 'Leverage set per account group',
              body: 'Default 1:100, up to 1:500 depending on your account group. Margin and margin level are always visible.',
            },
            {
              icon: Zap,
              title: 'Every order type',
              body: 'Market, limit, stop and stop-limit orders, each with a stop-loss and take-profit you can drag on the chart.',
            },
            {
              icon: ShieldCheck,
              title: 'One account, five markets',
              body: 'Crypto sits alongside forex, metals, indices and energy in the same terminal, with one balance and one history.',
            },
          ]}
        />
      </Section>

      <Section>
        <SectionHeading kicker="The terminal" title="Where you trade it" />
        <div className="mt-12">
          <TerminalShot alt={`The ${BRAND_NAME} web terminal showing a bitcoin chart, the watchlist and the order ticket`} />
        </div>
      </Section>

      <CtaBanner
        title="Start trading crypto"
        lead="Open a live account in minutes, or trade bitcoin on a free $10,000 demo first."
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'Try a free demo', href: '/auth/login' }}
      />

      <RiskNote />
    </main>
  );
}
