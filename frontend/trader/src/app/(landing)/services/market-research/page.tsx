'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  Newspaper, Calendar, Bell, LineChart, BookOpen, MonitorSmartphone,
} from 'lucide-react';
import {
  Section, SectionHeading, PageHero, FeatureGrid, CtaBanner, FaqAccordion,
} from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Services → Market news & economic calendar.
 *
 * Describes the News page and terminal news panel that exist on the
 * live platform: an economic calendar with impact levels plus live
 * headlines. There is no analyst desk or published trade ideas, so the
 * page does not show any.
 */

const RISK_LINE =
  'Trading leveraged products such as forex and CFDs carries a high level of risk and may not be suitable for all investors. You could lose more than your initial deposit.';

export default function MarketResearchPage() {
  return (
    <main>
      <PageHero
        kicker="Market news"
        title="Market news & economic calendar"
        lead="An economic calendar with impact levels and live headlines, inside your account and inside the terminal — so you see what is scheduled before you place the trade."
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'Try a free demo', href: '/auth/login' }}
        image={{
          src: '/marketing/screens/news.png',
          alt: `${BRAND_NAME} news page with the economic calendar and live headlines`,
          width: 1600,
          height: 1000,
          priority: true,
        }}
      />

      {/* Intro */}
      <Section raised>
        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-8 items-center">
          <div className="flex flex-col gap-4 items-start">
            <span className="mk-kicker">Before the session</span>
            <h2 className="mk-h2">
              Know what is scheduled. <span style={{ color: 'var(--mk-accent)' }}>Then decide.</span>
            </h2>
            <p className="mk-lead">
              The News page lists the day&apos;s economic releases with their impact level, next to a
              live headline feed. The same panel sits inside the web terminal, so you can check the
              calendar without leaving the chart.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/auth/login" className="mk-btn mk-btn--primary">Try a free demo</Link>
              <Link href="/trade" className="mk-btn mk-btn--ghost">Open the terminal</Link>
            </div>
          </div>
          {/* Inline calendar composition — no external image. */}
          <div
            className="flex flex-col"
            style={{
              background: 'var(--mk-surface-2)',
              border: '1px solid var(--mk-line)',
              borderRadius: 'var(--mk-radius-lg)',
              padding: 'var(--mk-space-5)',
              gap: 'var(--mk-space-3)',
            }}
            aria-hidden
          >
            <div className="flex items-center justify-between">
              <span className="mk-kicker">Economic calendar</span>
              <span className="mk-meta">Impact</span>
            </div>
            {[
              { t: '08:30', e: 'Inflation print',          i: 'High',   c: 'var(--mk-down)' },
              { t: '10:00', e: 'Manufacturing survey',     i: 'Medium', c: 'var(--mk-accent)' },
              { t: '13:30', e: 'Employment report',        i: 'High',   c: 'var(--mk-down)' },
              { t: '15:00', e: 'Central bank speech',      i: 'Medium', c: 'var(--mk-accent)' },
              { t: '19:00', e: 'Rate decision',            i: 'High',   c: 'var(--mk-down)' },
            ].map((r) => (
              <div
                key={r.e}
                className="flex items-center gap-3"
                style={{ padding: 'var(--mk-space-3) 0', borderTop: '1px solid var(--mk-line)' }}
              >
                <span className="mk-num" style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text-faint)', width: '3.2em' }}>{r.t}</span>
                <span className="mk-body flex-1" style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text)' }}>{r.e}</span>
                <span className="flex items-center gap-1.5" style={{ fontSize: 'var(--mk-text-xs)', color: r.c, fontWeight: 700 }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: r.c }} />
                  {r.i}
                </span>
              </div>
            ))}
            <span className="mk-meta" style={{ fontSize: 'var(--mk-text-xs)' }}>Illustration — the live calendar is inside your account.</span>
          </div>
        </div>
      </Section>

      {/* What you get */}
      <Section id="coverage">
        <SectionHeading kicker="What is included" title="Calendar, headlines, and both inside the terminal" />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            { icon: Calendar,          title: 'Economic calendar',        body: 'Scheduled releases — rate decisions, inflation, employment, PMIs — with the time and an impact level for each.' },
            { icon: Bell,              title: 'Impact levels',            body: 'High, medium and low impact flags, so you can see at a glance which events are likely to move the pairs you trade.' },
            { icon: Newspaper,         title: 'Live headlines',           body: 'A running feed of market headlines next to the calendar, updated as they arrive.' },
            { icon: MonitorSmartphone, title: 'Inside the terminal',      body: 'The same news panel sits in the web terminal, so you can check it without leaving the chart or the order ticket.' },
            { icon: BookOpen,          title: 'Review in your journal',   body: 'After the session, the Portfolio page shows your trading journal, equity curve and trading calendar, so you can see how you traded around events.' },
            { icon: LineChart,         title: 'Pairs with your risk tools', body: 'Use the margin and P/L calculators to size a position around an event, and set SL/TP before the release rather than after it.' },
          ]}
        />
      </Section>

      {/* How traders use it */}
      <Section raised>
        <SectionHeading
          kicker="In practice"
          title="Three ways traders use it"
          lead="None of this is advice — it is the routine the tools are built for."
        />
        <ol className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-12">
          {[
            { n: '01', title: 'Check the calendar before the session', body: 'Open News, scan the high-impact events for the day and note the times that touch the pairs on your watchlist.' },
            { n: '02', title: 'Decide how you want to be positioned',  body: 'Some traders flatten before a release; others set a stop-loss and take-profit and let the engine manage it server-side.' },
            { n: '03', title: 'Review afterwards in your journal',      body: 'The Portfolio page keeps a trading journal, equity curve and calendar, so you can see how you actually did around news.' },
          ].map((s) => (
            <li key={s.n} className="mk-card mk-card--hover flex flex-col gap-3">
              <span className="font-extrabold" style={{ fontSize: 'var(--mk-text-h2)', color: 'var(--mk-accent)', lineHeight: 1 }}>{s.n}</span>
              <h3 className="mk-h3">{s.title}</h3>
              <p className="mk-body">{s.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Terminal news panel */}
      <Section>
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <Image
            src="/marketing/screens/terminal.png"
            alt={`${BRAND_NAME} web terminal with the economic-news panel open`}
            width={1600}
            height={1000}
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="block h-auto w-full"
            style={{ borderRadius: 'var(--mk-radius-lg)', border: '1px solid var(--mk-line)' }}
          />
          <div className="flex flex-col gap-4 items-start">
            <span className="mk-kicker">In the terminal</span>
            <h2 className="mk-h2">The calendar next to the chart</h2>
            <p className="mk-lead">
              Open the news panel in the terminal and the day&apos;s events sit beside your chart and
              order ticket. Set or adjust stop-loss and take-profit from the chart and the engine
              holds them server-side through the release.
            </p>
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <Section raised id="faq">
        <SectionHeading kicker="Questions" title="FAQ" />
        <div className="mt-12 mx-auto max-w-3xl">
          <FaqAccordion
            items={[
              {
                q: 'Where do I find the calendar and news?',
                a: <>Sign in and open the News page from your dashboard, or open the news panel inside the web terminal. Both show the economic calendar with impact levels and the live headline feed.</>,
              },
              {
                q: 'Is this available on a demo account?',
                a: <>Yes. The demo uses the same platform as a live account, so the News page and the terminal panel are there from the first sign-in.</>,
              },
              {
                q: 'Are these recommendations to trade?',
                a: <>No. The calendar and headlines are information, not advice. Every trade is your own decision; size it to your own risk and use the calculators before you place it.</>,
              },
              {
                q: 'Does the platform publish trade ideas or analyst reports?',
                a: <>Not at the moment. What is on the platform today is the calendar, the headlines and the in-terminal panel. If that changes we will say so here.</>,
              },
            ]}
          />
        </div>
        <p className="mk-meta mx-auto text-center" style={{ marginTop: 'var(--mk-space-8)', maxWidth: '72ch' }}>{RISK_LINE}</p>
      </Section>

      <CtaBanner
        title="See the calendar in your account"
        lead="Sign in — or start on a $10,000 demo in one click — and open News."
        primary={{ label: 'Try a free demo', href: '/auth/login' }}
        secondary={{ label: 'Open account', href: '/auth/register' }}
      />
    </main>
  );
}
