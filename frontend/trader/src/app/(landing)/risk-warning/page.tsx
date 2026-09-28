import Link from 'next/link';
import { Section, PageHero, CtaBanner } from '@/marketing/components';
import {
  LegalDoc, LegalSection, LegalP, LegalList, LegalCallout, legalAnchor,
} from '../_legal/LegalDoc';
import { BRAND_NAME, BRAND_SUPPORT_EMAIL } from '@/lib/brand';

/**
 * Risk Warning — public legal page.
 *
 * The leveraged-trading risk disclosure for PowerTradeFX clients: what
 * margin trading in forex, metals, indices, energy and crypto CFDs can
 * cost, how leverage up to 1:500 amplifies losses, why past performance,
 * copy-trading, PAMM and algorithmic strategies are no guarantee, and
 * what market hours, gaps and technology can do to an open position.
 * Sits alongside /risk (the Disclaimer) and is linked from the footer.
 */

const SECTIONS: { h: string; body: string; list?: string[]; trailing?: string }[] = [
  {
    h: '1. Leveraged Trading Can Cost You More Than You Deposit',
    body: `${BRAND_NAME} offers trading in forex, precious metals, stock indices, energy and crypto-assets as leveraged over-the-counter contracts. You post a fraction of the position's value as margin and gain or lose on the full position. Leverage on the platform is flexible up to 1:500. At 1:500, a 0.2% move against a fully margined position wipes out the margin behind it. Losses can exceed your deposit, and a negative balance is a debt to us unless we choose to reset it.`,
  },
  {
    h: '2. Not Suitable for Everyone',
    body: `Trading leveraged products is speculative and is not suitable for all investors. Before you trade, ask yourself whether you understand how margin, leverage, spreads, swaps and stop-outs work, whether you can afford to lose the money in your account, and whether you have time to monitor open positions. If the answer to any of these is no, do not trade, or trade only on a demo account.`,
  },
  {
    h: '3. Margin Calls and Stop-Outs',
    body: `Your equity changes tick by tick while positions are open. If your margin level falls below the margin-call threshold you will be warned; if it falls below the stop-out level the trading engine will automatically close positions, starting with the largest loss, without asking you first. Stop-outs happen at the price then available and can leave you with a substantially reduced or negative balance. You are responsible for watching your margin level and adding funds or reducing exposure in time.`,
  },
  {
    h: '4. Market Hours, Gaps and Slippage',
    body: `Markets do not always move smoothly and are not always open:`,
    list: [
      'Forex, metals, indices and energy follow the hours of their underlying markets and close over weekends and holidays. Crypto-assets trade around the clock, including through weekend moves you cannot react to during a break.',
      'Prices can gap — jump from one level to another with no trades in between — at market open, on economic releases and on unexpected news. Stop-loss orders and stop-outs are executed at the first available price after a gap, which may be far worse than the level you set.',
      'In fast or thin markets, market orders may fill at a price different from the one you saw ("slippage"). Spreads can widen sharply, raising the cost of trading and triggering stop-losses that would not otherwise have been hit.',
      'Some instruments — particularly crypto-assets and less liquid pairs — are prone to extreme intraday volatility.',
    ],
  },
  {
    h: '5. Past Performance Is No Guide',
    body: `Historical prices, backtests, leaderboard returns, PAMM rankings and any performance statistic shown on the platform describe what happened, not what will happen. Markets change, and a strategy or trader with an excellent record can lose money at any time. Do not treat any figure on the platform as a forecast.`,
  },
  {
    h: '6. Copy Trading and PAMM Risk',
    body: `When you follow a master trader or invest with a PAMM manager you hand trading decisions to someone else while keeping the risk:`,
    list: [
      'You will suffer the same proportional losses the master or manager suffers, including from mistakes, strategy failures and abandoned accounts.',
      'Leaderboard rankings can be dominated by traders taking large risks over short periods.',
      'Mirrored trades may fill at slightly different prices from the master\'s, and your allocation and leverage may differ from theirs.',
      'Performance fees reduce your net return. Stopping a follow or withdrawing from a PAMM account may only take effect at the next settlement or once open positions are closed.',
      `${BRAND_NAME} approves masters and managers for onboarding only; approval is not an endorsement and we do not supervise their trading decisions.`,
    ],
  },
  {
    h: '7. Algorithmic and AI Strategy Risk',
    body: `Strategies built with the AI Strategy Builder, and bots connected through the Algo Connector API, trade your account automatically and can open positions faster than you can react. A backtest uses historical data and ignores future conditions, slippage, spread changes and outages. A strategy can behave unexpectedly in conditions it has not seen, a coding error can place orders you never intended, and a compromised API key is as good as your password. Set risk limits, monitor deployed strategies and revoke keys you no longer use.`,
  },
  {
    h: '8. Technology and Connectivity Risk',
    body: `Trading depends on your device, your internet connection, our servers, our price and liquidity providers and — for crypto funding — public blockchain networks. Any of these can fail or slow down. Orders, stop-losses and take-profits are executed server-side and keep working if your browser closes, but a delay or outage on our side or a provider's side can still prevent an order from executing at the price or time you expected. We do not guarantee uninterrupted or error-free operation.`,
  },
  {
    h: '9. Funding and Crypto-Asset Risk',
    body: `Crypto-asset transfers are irreversible. A deposit sent to the wrong address or over the wrong network, or a withdrawal to an address you entered incorrectly, cannot be recovered. Network congestion and fee spikes can delay transfers. Bank and UPI withdrawals are reviewed before release and may be delayed by our checks or by your bank.`,
  },
  {
    h: '10. No Advice',
    body: `Nothing on the platform — prices, charts, indicators, economic news, calendars, strategy templates, leaderboards, educational content or messages from our support team — is personal investment, financial, tax or legal advice or a recommendation to trade. ${BRAND_NAME} does not assess whether trading is suitable for you. If you are unsure, take independent advice before you trade.`,
  },
  {
    h: '11. Tax',
    body: `Profits from trading may be taxable and losses may not be deductible depending on where you live. Tax law changes and its application to your circumstances is your responsibility. We do not provide tax advice or reporting on your behalf.`,
  },
  {
    h: '12. Acknowledgement',
    body: `By opening an account and trading with ${BRAND_NAME} you confirm that you have read and understood this Risk Warning, that you accept the risks described, and that you are trading with money you can afford to lose.`,
  },
];

const TOC = SECTIONS.map((s) => ({ id: legalAnchor(s.h), label: s.h }));

export default function RiskWarningPage() {
  return (
    <main>
      <PageHero
        kicker="Legal"
        title="Risk Warning"
        lead={`Leveraged trading can lose you more than you deposit. Read this before you open a live ${BRAND_NAME} account.`}
      />

      <Section raised>
        <LegalDoc toc={TOC} updated="September 2026">
          {/* Top alert — highlighted warning above the section list */}
          <LegalCallout tone="warn">
            <span style={{ color: 'var(--mk-text)', fontWeight: 700 }}>Important:</span> Trading
            leveraged products such as forex and CFDs carries a high level of risk and may not be
            suitable for all investors. You could lose more than your initial deposit. Leverage of up
            to 1:500 amplifies both gains and losses. Past performance — your own, a master trader&apos;s,
            a PAMM manager&apos;s or a backtested strategy&apos;s — is not a reliable indicator of future
            results. Only trade with money you can afford to lose.
          </LegalCallout>

          {SECTIONS.map(({ h, body, list, trailing }) => (
            <LegalSection key={h} id={legalAnchor(h)} heading={h}>
              <LegalP>{body}</LegalP>
              {list && <LegalList items={list} />}
              {trailing && <LegalP>{trailing}</LegalP>}
            </LegalSection>
          ))}

          <LegalP>
            Read this alongside our{' '}
            <Link href="/risk" className="hover:underline" style={{ color: 'var(--mk-accent)' }}>
              Disclaimer
            </Link>
            ,{' '}
            <Link href="/terms" className="hover:underline" style={{ color: 'var(--mk-accent)' }}>
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/restricted-countries" className="hover:underline" style={{ color: 'var(--mk-accent)' }}>
              Restricted Countries
            </Link>{' '}
            policy. Questions can be sent to{' '}
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
        title="Understand the risk, then decide"
        lead="Practise on a free $10,000 demo first if you are new to leveraged trading. When you are ready, open a live account in minutes."
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'Contact support', href: `mailto:${BRAND_SUPPORT_EMAIL}` }}
      />
    </main>
  );
}
