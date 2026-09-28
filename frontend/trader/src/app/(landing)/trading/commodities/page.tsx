'use client';

/**
 * Trading → Metals & Energy (route: /trading/commodities). Gold, silver,
 * platinum, palladium, WTI and Brent crude as CFDs on PowerTradeFX.
 */
import { Medal, Fuel, BarChart3, ShieldCheck, Zap, Gauge } from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';
import {
  StatStrip, InstrumentTable, MarketIllustration, TerminalShot, RiskNote, type InstrumentRow,
} from '../_components/MarketPageParts';

const STATS = [
  { label: 'Metals', value: '4' },
  { label: 'Energy', value: '2' },
  { label: 'Leverage', value: 'Up to 1:500' },
  { label: 'Lot size from', value: '0.01' },
];

const HOURS = 'Market hours, Mon–Fri';

const METALS: InstrumentRow[] = [
  { symbol: 'XAUUSD', name: 'Gold / US Dollar', hours: HOURS },
  { symbol: 'XAGUSD', name: 'Silver / US Dollar', hours: HOURS },
  { symbol: 'XPTUSD', name: 'Platinum / US Dollar', hours: HOURS },
  { symbol: 'XPDUSD', name: 'Palladium / US Dollar', hours: HOURS },
];

const ENERGY: InstrumentRow[] = [
  { symbol: 'USOIL', name: 'WTI Crude Oil', hours: HOURS },
  { symbol: 'UKOIL', name: 'Brent Crude Oil', hours: HOURS },
];

export default function CommoditiesPage() {
  return (
    <main>
      <PageHero
        kicker="Metals & Energy"
        title="Trade gold, silver, platinum, palladium and crude oil"
        lead={`Six metals and energy CFDs on one ${BRAND_NAME} account. Go long or short from 0.01 lots, with variable spreads shown live and stop-loss and take-profit on every order.`}
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'Try a free demo', href: '/auth/login' }}
      />

      <Section raised>
        <StatStrip stats={STATS} />

        <div className="grid lg:grid-cols-2 gap-10 items-center mt-14">
          <div className="flex flex-col gap-4">
            <span className="mk-kicker">What you are trading</span>
            <h2 className="mk-h2">Metals and energy, in plain terms</h2>
            <p className="mk-lead">
              Gold and silver move on rates, the dollar and risk appetite; platinum and palladium on industrial
              demand; crude oil on supply, inventories and geopolitics. Each is quoted against the US dollar and
              traded as a CFD, so you take a position on the price without owning the metal or the barrel.
            </p>
            <p className="mk-body">
              Metals and energy follow their underlying market hours, five days a week, with a short daily break.
              Outside those hours the instruments show as closed on the watchlist and the terminal blocks new orders.
            </p>
          </div>
          <MarketIllustration symbol="XAUUSD" side="Buy" ticket="0.05 lot · SL / TP set" />
        </div>
      </Section>

      <Section>
        <SectionHeading
          kicker="Instruments"
          title="Metals"
          lead="Four precious metals, quoted against the US dollar."
        />
        <div className="mt-12">
          <InstrumentTable rows={METALS} />
        </div>
        <SectionHeading
          className="mt-16"
          kicker="Instruments"
          title="Energy"
          lead="The two crude benchmarks the world prices oil against."
        />
        <div className="mt-12">
          <InstrumentTable rows={ENERGY} />
        </div>
      </Section>

      <Section raised>
        <SectionHeading kicker="Why trade them here" title={`Metals and energy on ${BRAND_NAME}`} />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            {
              icon: Medal,
              title: 'Gold from 0.01 lots',
              body: 'Size a gold position to your account, not the other way round. Margin and margin level are always visible on the account panel.',
            },
            {
              icon: Fuel,
              title: 'Both crude benchmarks',
              body: 'USOIL (WTI) and UKOIL (Brent) side by side on the watchlist, with live bid, ask and spread.',
            },
            {
              icon: Gauge,
              title: 'Leverage set per account group',
              body: 'Default 1:100, up to 1:500 depending on your account group, shown on the ticket before you confirm.',
            },
            {
              icon: Zap,
              title: 'Market, limit, stop and stop-limit',
              body: 'Enter on a level or on a breakout. Pending orders fill at your requested price when the market reaches it.',
            },
            {
              icon: ShieldCheck,
              title: 'Server-side protection',
              body: 'Stop-loss and take-profit are executed by the engine, not your browser, so they hold through a fast move while you are away.',
            },
            {
              icon: BarChart3,
              title: 'Charts built for these markets',
              body: 'TradingView-powered charts with 100+ indicators and drawing tools, from one-minute to monthly timeframes.',
            },
          ]}
        />
      </Section>

      <Section>
        <SectionHeading kicker="The terminal" title="Where you trade it" />
        <div className="mt-12">
          <TerminalShot alt={`The ${BRAND_NAME} web terminal showing a gold chart, the watchlist and the order ticket`} />
        </div>
      </Section>

      <CtaBanner
        title="Start trading metals and energy"
        lead="Open a live account in minutes, or try gold and oil on a free $10,000 demo first."
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'Try a free demo', href: '/auth/login' }}
      />

      <RiskNote />
    </main>
  );
}
