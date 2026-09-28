'use client';

import Link from 'next/link';
import {
  BookOpen, Newspaper, FileText, Calculator, MonitorSmartphone, Layers, Bot, Users,
} from 'lucide-react';
import {
  Section, SectionHeading, PageHero, FeatureGrid, CtaBanner, FaqAccordion,
} from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Services → Learn to trade.
 *
 * A hub, not an academy. Links to the platform tutorials, the guides
 * blog and the market-news page, and says plainly what is there: guides
 * on using the platform and on the basics. No certificates, no course
 * hours, no resource counts — none of that exists.
 */

const RISK_LINE =
  'Trading leveraged products such as forex and CFDs carries a high level of risk and may not be suitable for all investors. You could lose more than your initial deposit.';

export default function EducationPage() {
  return (
    <main>
      <PageHero
        kicker="Learn"
        title="Learn to trade"
        lead={`Short, practical guides on using the ${BRAND_NAME} platform and on the basics — orders, margin, leverage, funding, copy trading and automation. Read them, then try each one on a free demo.`}
        primary={{ label: 'Try a free demo', href: '/auth/login' }}
        secondary={{ label: 'Browse the guides', href: '#library' }}
      />

      {/* Three places to start */}
      <Section raised>
        <SectionHeading
          kicker="Where to start"
          title="Three places to start"
          lead="Pick what you need right now. Everything here is free and does not require an account."
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-12">
          {[
            { icon: MonitorSmartphone, title: 'Platform tutorials', href: '/education/tutorials', cta: 'Open tutorials', body: 'Step-by-step walkthroughs of the terminal: placing your first order, setting stop-loss and take-profit, funding with USDT, following a master trader.' },
            { icon: BookOpen,          title: 'Guides & blog',      href: '/education/blog',      cta: 'Read the guides', body: 'Plain-language explainers on the basics — margin and leverage, order types, position sizing — written around how the platform actually works.' },
            { icon: Newspaper,         title: 'Market news',        href: '/education/news',      cta: 'See market news',  body: 'How the economic calendar and headline feed work, and where to find them inside your account and the terminal.' },
          ].map(({ icon: Icon, title, href, cta, body }, i) => (
            <article
              key={title}
              className="mk-card mk-card--hover flex flex-col gap-3"
              style={i === 0 ? { borderColor: 'var(--mk-accent-line)' } : undefined}
            >
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl shrink-0"
                style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
              >
                <Icon size={20} />
              </span>
              <h3 className="mk-h3">{title}</h3>
              <p className="mk-body flex-1">{body}</p>
              <Link
                href={href}
                className="font-bold mt-2"
                style={{ color: 'var(--mk-accent)', fontSize: 'var(--mk-text-sm)' }}
              >
                {cta} →
              </Link>
            </article>
          ))}
        </div>
      </Section>

      {/* What the guides cover */}
      <Section id="library">
        <SectionHeading kicker="Topics" title="What the guides cover" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-12">
          {[
            { icon: Layers,     title: 'The basics',       body: 'What a pip, a lot and a spread are; how margin and leverage work; why a stop-loss matters.' },
            { icon: FileText,   title: 'Using the terminal', body: 'Order types, the watchlist, one-click trading, editing SL/TP from the chart, reading the account panel.' },
            { icon: Calculator, title: 'Funding & risk tools', body: 'Depositing with USDT or bank / UPI, KYC, internal transfers, and the margin, P/L, lot-size and swap calculators.' },
            { icon: Bot,        title: 'Copy trading & automation', body: 'Following a master, investing with a PAMM manager, building a strategy with the AI builder, connecting a bot.' },
          ].map(({ icon: Icon, title, body }) => (
            <article key={title} className="mk-card mk-card--hover flex flex-col gap-3">
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl shrink-0"
                style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
              >
                <Icon size={20} />
              </span>
              <h3 className="mk-h3">{title}</h3>
              <p className="mk-body">{body}</p>
            </article>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link href="/academy/pdfs" className="mk-btn mk-btn--ghost">
            <FileText size={16} style={{ color: 'var(--mk-accent)' }} /> Trading guides
          </Link>
          <Link href="/academy/blogs" className="mk-btn mk-btn--ghost">
            <BookOpen size={16} style={{ color: 'var(--mk-accent)' }} /> Platform blog
          </Link>
        </div>
      </Section>

      {/* Why learn here */}
      <Section raised>
        <SectionHeading kicker="Why here" title="Why learn on the platform you trade on" />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            { icon: MonitorSmartphone, title: 'Every guide matches the real screens', body: 'The guides describe the actual terminal, wallet and KYC pages, so what you read is what you see.' },
            { icon: Users,             title: 'Practise on a demo, free',           body: 'A $10,000 demo is one click away — no email. Read a guide, then do it with virtual money.' },
            { icon: Calculator,        title: 'Tools, not theory',                  body: 'The risk calculators, the trading journal and the equity curve are on the platform, so a lesson turns into a habit.' },
          ]}
        />
      </Section>

      {/* FAQ */}
      <Section id="faq">
        <SectionHeading kicker="Questions" title="FAQ" />
        <div className="mt-12 mx-auto max-w-3xl">
          <FaqAccordion
            items={[
              {
                q: 'Is this a certified course or academy?',
                a: <>No. These are free guides on using the {BRAND_NAME} platform and on trading basics. There is no assessment, certificate or structured curriculum.</>,
              },
              {
                q: 'Do I need an account to read the guides?',
                a: <>No. The tutorials, blog and market-news pages are public. To practise what they describe, sign in and press &quot;Try with demo&quot;.</>,
              },
              {
                q: 'Is any of this financial advice?',
                a: <>No. The guides explain how the tools work. They do not tell you what to trade. Every trade is your own decision.</>,
              },
              {
                q: 'Where do I get help if a guide does not answer my question?',
                a: <>Open a ticket from the Support page inside your account, or use the contact page. A person replies.</>,
              },
            ]}
          />
        </div>
        <p className="mk-meta mx-auto text-center" style={{ marginTop: 'var(--mk-space-8)', maxWidth: '72ch' }}>{RISK_LINE}</p>
      </Section>

      <CtaBanner
        title="Read a guide, then try it"
        lead="A $10,000 demo account in one click — no email, no risk to real money."
        primary={{ label: 'Try a free demo', href: '/auth/login' }}
        secondary={{ label: 'Platform tutorials', href: '/education/tutorials' }}
      />
    </main>
  );
}
