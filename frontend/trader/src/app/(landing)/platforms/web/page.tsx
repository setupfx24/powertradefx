import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import {
  Check, CandlestickChart, ListOrdered, Server, Gauge, Newspaper, Share2, Moon, Smartphone,
} from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Platforms → Web Trading Terminal. The trader's terminal at
 * /trading/terminal (short link /trade). Every claim below is a verified
 * feature of the live terminal; screenshots are real captures.
 */

export const metadata: Metadata = {
  title: `Web Trading Terminal | ${BRAND_NAME}`,
  description: `Trade 40+ instruments from any browser on the ${BRAND_NAME} web terminal — TradingView charts, one-click trading, server-side stop-loss and take-profit, dark and light themes, phone-ready.`,
};

const RISK_LINE =
  'Trading leveraged products such as forex and CFDs carries a high level of risk and may not be suitable for all investors. You could lose more than your initial deposit.';

const HIGHLIGHTS = [
  'TradingView charts with 100+ indicators, drawing tools and timeframes from 1 minute to 1 month',
  'Watchlist with live bid, ask and spread',
  'Market, limit, stop and stop-limit orders',
  'Stop-loss and take-profit on every order — editable straight from the chart',
  'One-click trading widget on the chart',
  'Positions, pending orders and closed-trade history panels',
  'Balance, equity, margin, free margin and margin level always in view',
  'Share-a-trade cards: a public link for one trade, all open trades or your full history',
  'Economic-news panel inside the terminal',
  'Dark and light themes',
];

export default function WebPlatformPage() {
  return (
    <main>
      <PageHero
        kicker="Web trading terminal"
        title="Your terminal, in any browser"
        lead="Charts, watchlist, order ticket and account panel on one screen. Nothing to install — sign in and trade 40+ instruments from desktop, laptop or phone."
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'Try a free demo', href: '/auth/login' }}
        image={{
          src: '/marketing/screens/terminal.png',
          alt: `${BRAND_NAME} web trading terminal, dark theme`,
          width: 1600,
          height: 1000,
          priority: true,
        }}
      />

      <Section raised>
        <SectionHeading kicker="Built for the trade" title="Everything you need on one screen" />
        <FeatureGrid
          className="mt-12"
          columns={4}
          items={[
            { icon: CandlestickChart, title: 'TradingView charts',    body: '100+ indicators, drawing tools and every timeframe from 1 minute to 1 month.' },
            { icon: ListOrdered,      title: 'Four order types',      body: 'Market, limit, stop and stop-limit. Limits fill at the limit price; a stop-limit becomes a limit when the stop is hit.' },
            { icon: Server,           title: 'Executed server-side',  body: 'Orders, stop-loss and take-profit run on our engine, so they keep working after you close the browser.' },
            { icon: Gauge,            title: 'Margin always visible', body: 'Balance, equity, margin, free margin and margin level update live as your positions move.' },
          ]}
        />
      </Section>

      <Section>
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          <div className="flex flex-col gap-4 items-start">
            <span className="mk-kicker">In the terminal</span>
            <h2 className="mk-h2">Professional tools, plain layout</h2>
            <p className="mk-lead">
              The terminal puts the chart in the middle and keeps the ticket, watchlist and
              account numbers one glance away. Set stop-loss and take-profit when you place the
              order, or drag them on the chart afterwards.
            </p>
            <ul className="flex flex-col gap-2.5 mt-2">
              {HIGHLIGHTS.map((highlight) => (
                <li key={highlight} className="flex items-start gap-3 mk-body">
                  <Check size={18} className="shrink-0 mt-1" style={{ color: 'var(--mk-accent)' }} />
                  <span>{highlight}</span>
                </li>
              ))}
            </ul>
          </div>

          <article className="mk-card overflow-hidden" style={{ padding: 0 }}>
            <div className="overflow-hidden" style={{ background: 'var(--mk-surface-2)' }}>
              <Image
                src="/marketing/screens/terminal-light.png"
                alt={`${BRAND_NAME} web trading terminal, light theme`}
                width={1600}
                height={1000}
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="block h-auto w-full"
              />
            </div>
            <div className="flex flex-col gap-4" style={{ padding: 'var(--mk-space-6)' }}>
              <h3 className="mk-h3">Light or dark, your choice</h3>
              <p className="mk-body">
                Switch themes with one click. Your layout, watchlist and open positions are the
                same on every device you sign in from.
              </p>
              <Link href="/trade" className="mk-btn mk-btn--primary w-full">
                Open the terminal
              </Link>
            </div>
          </article>
        </div>
      </Section>

      <Section raised>
        <SectionHeading kicker="More than a chart" title="Share, read, and keep an eye on the news" />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            { icon: Share2,    title: 'Share a trade',        body: 'Create a public card for one trade, all your open trades or your full history, and send the link anywhere.' },
            { icon: Newspaper, title: 'News in the terminal', body: 'An economic-news panel sits next to the chart, so you see the calendar and headlines without leaving the screen.' },
            { icon: Moon,      title: 'Dark and light themes', body: 'A dark terminal for long sessions, a light one for daylight. Toggle any time.' },
          ]}
        />
      </Section>

      <Section>
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div className="mx-auto w-full" style={{ maxWidth: 320 }}>
            <Image
              src="/marketing/screens/terminal-phone.png"
              alt={`${BRAND_NAME} web terminal in a phone browser`}
              width={390}
              height={844}
              sizes="(max-width: 1024px) 80vw, 320px"
              className="block h-auto w-full"
              style={{ borderRadius: 'var(--mk-radius-lg)', border: '1px solid var(--mk-line)' }}
            />
          </div>
          <div className="flex flex-col gap-4 items-start">
            <span className="mk-kicker">On your phone</span>
            <h2 className="mk-h2">The same terminal in a phone browser</h2>
            <p className="mk-lead">
              Open the terminal in Safari or Chrome on your phone. The chart, watchlist and a
              mobile order sheet fit the screen, and stop-loss and take-profit stay live on the
              server whether the phone is awake or not.
            </p>
            <ul className="flex flex-col gap-2.5">
              {[
                'Mobile order sheet with market, limit, stop and stop-limit orders',
                'Watchlist with live bid/ask and spread',
                'Positions, pending orders and history panels',
                'Crypto 24/7; forex, metals and indices in market hours',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 mk-body">
                  <Smartphone size={18} className="shrink-0 mt-1" style={{ color: 'var(--mk-accent)' }} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link href="/download" className="mk-link">Trade anywhere — desktop and mobile</Link>
          </div>
        </div>
      </Section>

      <Section className="mk-section--tight">
        <p
          className="mk-body mx-auto text-center"
          style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text-muted)', maxWidth: '70ch' }}
        >
          <strong>Risk warning:</strong> {RISK_LINE}
        </p>
      </Section>

      <CtaBanner
        title="Start trading in your browser"
        lead="Open a live account, or try the full terminal on a $10,000 demo — one click, no email."
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'Try a free demo', href: '/auth/login' }}
      />
    </main>
  );
}
