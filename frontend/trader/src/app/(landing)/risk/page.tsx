import Link from 'next/link';
import { Section, PageHero, CtaBanner } from '@/marketing/components';
import {
  LegalDoc, LegalSection, LegalP, LegalCallout, legalAnchor,
} from '../_legal/LegalDoc';
import { BRAND_NAME, BRAND_SUPPORT_EMAIL } from '@/lib/brand';

/**
 * Disclaimer — public legal page (route /risk, linked from the footer).
 *
 * What the information on the PowerTradeFX website and platform is —
 * and is not: no investment advice, information only, third-party data
 * (TradingView charts, news, calendars), no guarantee of uptime, and no
 * guarantee of copy-trading, PAMM or strategy performance. The full
 * leveraged-trading risk disclosure lives at /risk-warning.
 */

const SECTIONS = [
  {
    h: '1. Information Only',
    p: `Everything published on the ${BRAND_NAME} website and inside the platform — prices, charts,
    indicators, watchlists, economic calendars, news headlines, leaderboards, PAMM rankings,
    strategy templates, calculators, guides and tutorials — is provided for general information
    only. It is not a recommendation to buy, sell or hold any instrument and does not take your
    financial situation, objectives or experience into account.`,
  },
  {
    h: '2. No Investment Advice',
    p: `${BRAND_NAME} does not provide investment, financial, tax or legal advice. Our support team can
    explain how the platform works but will not tell you what to trade. Messages, articles or tools
    that discuss a market or strategy are not advice, even where they are personalised to your
    account. Consult an independent, qualified adviser if you are unsure whether trading is right
    for you.`,
  },
  {
    h: '3. Trading Is High-Risk',
    p: `Trading leveraged products such as forex and CFDs carries a high level of risk and may not be
    suitable for all investors. You could lose more than your initial deposit. Our Risk Warning
    explains how leverage, margin, stop-outs, market gaps and slippage can affect you. Read it before
    you trade.`,
  },
  {
    h: '4. Copy Trading, PAMM and Strategy Performance',
    p: `Returns, win rates, Sharpe ratios, follower counts, ROI figures and backtest results shown for
    master traders, PAMM managers and AI-built strategies are calculated from past trades and are
    not a promise of future performance. ${BRAND_NAME} approves masters and managers for onboarding
    only; approval is not an endorsement and we do not guarantee any result from following, investing
    or deploying a strategy. Performance fees reduce your net return.`,
  },
  {
    h: '5. Third-Party Data and Content',
    p: `Charts are powered by TradingView; market news, economic-calendar data and some price feeds
    are supplied by other third parties. This content belongs to its providers and may be delayed,
    incomplete or contain errors. ${BRAND_NAME} does not verify third-party content and accepts no
    liability for decisions you make in reliance on it. Links to external sites are provided for
    convenience and do not imply endorsement.`,
  },
  {
    h: '6. Prices and Execution',
    p: `Quotes displayed on the website, in share-a-trade cards and in the terminal watchlist are
    indicative until an order is executed. The price at which a trade is filled is the price
    recorded by our trading engine at execution and may differ from a displayed quote because of
    latency, spread changes or slippage. Calculator results (margin, profit and loss, lot size, swap)
    are estimates based on the inputs you provide.`,
  },
  {
    h: '7. No Guarantee of Availability',
    p: `We work to keep the platform available around the clock, but we do not guarantee
    uninterrupted, timely or error-free operation. Maintenance, provider outages, network problems,
    cyber-attacks and events outside our control can prevent you from accessing your account or
    executing orders. Server-side stop-loss and take-profit orders reduce this risk but do not
    eliminate it. You should not rely on the platform as your only means of managing risk on a
    position you cannot afford to leave open.`,
  },
  {
    h: '8. Educational Content',
    p: `Guides, tutorials and other educational material describe how to use the platform and
    explain general trading concepts. They are not a course of study, do not confer any
    qualification and are not tailored to you.`,
  },
  {
    h: '9. Jurisdiction',
    p: `The website and platform are not directed at anyone in a jurisdiction where their use would be
    unlawful, and we do not accept clients from the jurisdictions listed on our Restricted Countries
    page. It is your responsibility to make sure that trading with ${BRAND_NAME} is lawful where you
    live.`,
  },
  {
    h: '10. Tax',
    p: `The tax treatment of trading profits and losses depends on where you live and can change.
    ${BRAND_NAME} does not provide tax advice and does not report on your behalf. Take advice from a
    qualified professional.`,
  },
  {
    h: '11. Limitation of Liability',
    p: `To the fullest extent permitted by law, ${BRAND_NAME} accepts no liability for any loss arising
    from reliance on information on the website or platform, from third-party content or data, from
    the performance of any master trader, manager or strategy, or from interruptions to the service.
    Our Terms of Service set out the liability we do accept.`,
  },
  {
    h: '12. Acknowledgement',
    p: `By using the ${BRAND_NAME} website or platform you confirm that you have read and understood
    this Disclaimer, that you make your own trading decisions, and that nothing here is investment
    advice or a guarantee of any outcome.`,
  },
];

const TOC = SECTIONS.map((s) => ({ id: legalAnchor(s.h), label: s.h }));

export default function RiskPage() {
  return (
    <main>
      <PageHero
        kicker="Legal"
        title="Disclaimer"
        lead={`What the information on the ${BRAND_NAME} website and platform is for — and why none of it is investment advice or a guarantee of results.`}
      />

      <Section raised>
        <LegalDoc toc={TOC} updated="September 2026">
          <LegalCallout tone="warn">
            <span style={{ color: 'var(--mk-text)', fontWeight: 700 }}>Important:</span> Trading
            leveraged products such as forex and CFDs carries a high level of risk and may not be
            suitable for all investors. You could lose more than your initial deposit. Nothing on
            this website or in the platform is investment advice, and past performance — including
            copy-trading and PAMM results — is not a reliable indicator of future results.
          </LegalCallout>

          {SECTIONS.map(({ h, p }) => (
            <LegalSection key={h} id={legalAnchor(h)} heading={h}>
              <LegalP>{p}</LegalP>
            </LegalSection>
          ))}

          <LegalP>
            Cross-read with our{' '}
            <Link href="/risk-warning" className="hover:underline" style={{ color: 'var(--mk-accent)' }}>
              Risk Warning
            </Link>
            ,{' '}
            <Link href="/terms" className="hover:underline" style={{ color: 'var(--mk-accent)' }}>
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="hover:underline" style={{ color: 'var(--mk-accent)' }}>
              Privacy Policy
            </Link>
            . Questions about this Disclaimer can be sent to{' '}
            <a
              href={`mailto:${BRAND_SUPPORT_EMAIL}`}
              className="hover:underline"
              style={{ color: 'var(--mk-accent)' }}
            >
              {BRAND_SUPPORT_EMAIL}
            </a>
            .
          </LegalP>
        </LegalDoc>
      </Section>

      <CtaBanner
        title="Trade on your own terms"
        lead={`Open a ${BRAND_NAME} account and make your own decisions with live prices, server-side risk orders and a support team that answers.`}
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'Contact support', href: `mailto:${BRAND_SUPPORT_EMAIL}` }}
      />
    </main>
  );
}
