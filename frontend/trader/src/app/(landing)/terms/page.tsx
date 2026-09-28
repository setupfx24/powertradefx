import Link from 'next/link';
import { Section, PageHero, CtaBanner } from '@/marketing/components';
import {
  LegalDoc, LegalSection, LegalClause, LegalP, LegalCallout, legalAnchor,
} from '../_legal/LegalDoc';
import { BRAND_NAME, BRAND_SUPPORT_EMAIL } from '@/lib/brand';

/**
 * Terms of Service — public legal page.
 *
 * The client agreement for a PowerTradeFX trading account: eligibility,
 * verification, demo vs live accounts, order execution, leverage and
 * margin, funding, the copy-trading / PAMM / partner programmes, API
 * use, prohibited conduct, termination and liability. Numbered clauses
 * are rendered as `[number] body…` so the on-screen layout reads like a
 * contract; the chrome comes from the shared marketing design system.
 */

const SECTIONS: { h: string; clauses: { n: string; body: string }[] }[] = [
  {
    h: '1. Acceptance of These Terms',
    clauses: [
      { n: '1.1', body: `These Terms of Service ("Terms") are the agreement between you and ${BRAND_NAME} ("${BRAND_NAME}", "we", "our" or "us") for your use of the ${BRAND_NAME} website, the web and desktop trading terminals, the mobile experience, the API and every account, tool and service we make available (together, the "Platform").` },
      { n: '1.2', body: `By registering, opening a demo or live account, depositing funds, placing an order or otherwise using the Platform, you confirm that you have read, understood and agree to these Terms, together with our Privacy Policy, Risk Warning, Disclaimer and Restricted Countries policy. If you do not agree, do not use the Platform.` },
      { n: '1.3', body: `Trading conditions that vary by account type or account group — such as spreads, commissions, swaps, leverage, lot limits and margin levels — are published in the Platform and form part of these Terms.` },
    ],
  },
  {
    h: '2. About the Service',
    clauses: [
      { n: '2.1', body: `${BRAND_NAME} operates an online trading platform through which you can trade leveraged over-the-counter products, including forex pairs, precious metals, stock indices, energy and crypto-assets, on a margin basis. You do not acquire ownership of any underlying asset; you gain or lose according to the price movement of the instrument you trade.` },
      { n: '2.2', body: `We provide the trading infrastructure, price feeds, order handling and account services. We act as the counterparty to your trades or route them to liquidity providers at our discretion.` },
      { n: '2.3', body: `Nothing on the Platform is personal investment, financial, tax or legal advice. Prices, charts, indicators, news, calendars, leaderboards, strategy templates and educational material are provided for information only. You alone decide whether, when and how to trade.` },
      { n: '2.4', body: `Trading leveraged products carries a high level of risk and may not be suitable for all investors. You could lose more than your initial deposit. Please read our Risk Warning before trading.` },
    ],
  },
  {
    h: '3. Eligibility',
    clauses: [
      { n: '3.1', body: `You must be at least eighteen (18) years old, or older where the law of your country sets a higher age of legal capacity, and able to enter into a binding contract.` },
      { n: '3.2', body: `You must not be resident in, a citizen of, or accessing the Platform from a jurisdiction listed in our Restricted Countries policy, or any jurisdiction where offering or using the Platform would be unlawful.` },
      { n: '3.3', body: `You must be acting on your own behalf and with your own funds unless you have been approved as a copy-trading master, PAMM manager or introducing partner under the relevant programme.` },
      { n: '3.4', body: `You may hold one login. Under that login you may open several trading accounts (for example a Standard and a Pro account, or accounts with different leverage) and move funds between them and your main wallet. Creating additional logins, or a login for another person, is prohibited.` },
    ],
  },
  {
    h: '4. Your Account and Identity Verification (KYC)',
    clauses: [
      { n: '4.1', body: `You must provide accurate, complete and current information when you register and keep it up to date.` },
      { n: '4.2', body: `Before you can withdraw funds — and at any other time we reasonably require — you must complete identity verification by providing a valid government-issued photo ID, a selfie and, where requested, proof of address. We may ask for further documents to verify your identity, residence or source of funds and may refuse, limit or close your account if verification cannot be completed.` },
      { n: '4.3', body: `You are responsible for keeping your password, two-factor authentication codes and API credentials confidential. Any activity carried out through your login is treated as yours. Tell us immediately at ${BRAND_SUPPORT_EMAIL} if you suspect unauthorised access.` },
      { n: '4.4', body: `We strongly recommend enabling two-factor authentication in your profile settings.` },
    ],
  },
  {
    h: '5. Demo and Live Accounts',
    clauses: [
      { n: '5.1', body: `A demo account is funded with virtual money (currently $10,000) and simulates trading on live prices. Demo balances cannot be deposited to, withdrawn or transferred. Demo results are not a reliable guide to live performance: execution, slippage and emotional pressure differ with real money.` },
      { n: '5.2', body: `A live account is opened from within the Platform and can be funded from your wallet. The account types offered, and the conditions attached to each, are described on the Platform and may change over time.` },
      { n: '5.3', body: `We may set or change leverage, spreads, commissions, swaps, minimum and maximum lot sizes and margin thresholds for an account or account group. Changes that reduce leverage or raise margin requirements on open positions will be notified through the Platform where practicable.` },
      { n: '5.4', body: `Accounts with no balance, no open positions and no activity for an extended period may be archived. You can ask support to reactivate an archived account.` },
    ],
  },
  {
    h: '6. Orders and Execution',
    clauses: [
      { n: '6.1', body: `The Platform supports market, limit, stop and stop-limit orders, each with optional stop-loss and take-profit levels. Orders, stop-loss and take-profit levels are held and executed server-side by our trading engine, so they remain active when your browser or device is closed.` },
      { n: '6.2', body: `A market order is executed at the best price available to us at the moment it is processed. That price may differ from the price you saw when you submitted the order ("slippage"), particularly during fast markets, news releases, low liquidity or at market open. Slippage can be in your favour or against you.` },
      { n: '6.3', body: `A limit order is filled at the limit price you set, or better. A stop order becomes a market order when the stop price is reached and may therefore fill with slippage. A stop-limit order becomes a limit order when the stop price is reached. Stop-loss and take-profit levels are triggered by our price feed and executed as market orders; in gapping markets they may fill at a worse price than the level set.` },
      { n: '6.4', body: `We may reject, cancel or amend an order, or reverse a trade, where it was executed at a manifestly erroneous price, results from a feed or system error, breaches these Terms, or where required by law or by our liquidity providers. We will notify you where we do so.` },
      { n: '6.5', body: `Instruments are tradable only during their published market hours. Crypto-assets trade around the clock; forex, metals, indices and energy follow the hours of their underlying markets and may be closed or restricted around holidays and major announcements. Pending orders and stop-loss or take-profit levels cannot be executed while a market is closed and will be assessed against the first available price when it reopens.` },
      { n: '6.6', body: `Positions held overnight may be charged or credited a swap (financing) amount, published per instrument in the Platform.` },
    ],
  },
  {
    h: '7. Leverage, Margin, Margin Calls and Stop-Out',
    clauses: [
      { n: '7.1', body: `Leverage on the Platform is flexible, up to 1:500, and is set per account group. Higher leverage lowers the margin you must post per lot but amplifies both gains and losses relative to your balance.` },
      { n: '7.2', body: `To open and keep a position you must maintain sufficient equity. The Platform shows your balance, equity, used margin, free margin and margin level at all times. It is your responsibility to monitor them.` },
      { n: '7.3', body: `If your margin level falls below the margin-call threshold for your account group, the Platform will warn you. If it falls below the stop-out level, the trading engine will automatically close some or all of your open positions, starting with the most loss-making, without further notice, to prevent your account going deeper into deficit.` },
      { n: '7.4', body: `A stop-out is a protective mechanism and not a guarantee. In fast or gapping markets your account may still close with a negative balance. Any negative balance is a debt owed to us unless we, at our sole discretion, reset it.` },
    ],
  },
  {
    h: '8. Deposits and Withdrawals',
    clauses: [
      { n: '8.1', body: `You can fund your wallet by crypto-asset transfer (USDT on the TRC20, BEP20 and ERC20 networks) or by local banking (bank transfer or UPI through a payment link). Available methods may differ by country and may change.` },
      { n: '8.2', body: `Funds must come from an account, card or wallet in your own name. We do not accept third-party payments. Deposits that cannot be attributed to you may be returned, less any provider fees.` },
      { n: '8.3', body: `You must complete identity verification (Section 4) before your first withdrawal. Withdrawals are returned to the same method and, where possible, the same source used to deposit. Crypto withdrawals are typically processed the same day; bank and UPI withdrawals are reviewed by our team before release.` },
      { n: '8.4', body: `You are responsible for entering correct wallet addresses, networks and bank details. Transfers sent to an address or network you specified cannot be recovered.` },
      { n: '8.5', body: `Network fees, payment-provider charges and currency-conversion differences may be deducted from a deposit or withdrawal. Any such charge is shown before you confirm.` },
      { n: '8.6', body: `We may delay or decline a withdrawal while we complete anti-money-laundering, fraud or source-of-funds checks, or where a withdrawal would leave insufficient margin for your open positions. Withdrawals are not possible from a demo account.` },
      { n: '8.7', body: `Internal transfers between your trading accounts and your wallet are immediate and free of charge.` },
    ],
  },
  {
    h: '9. Copy Trading',
    clauses: [
      { n: '9.1', body: `Copy trading lets you allocate part of a live account to follow an approved master trader. Once you follow, the master's trades are mirrored automatically in your account in proportion to your allocation, using the same execution rules as your own orders.` },
      { n: '9.2', body: `Following a master is your own investment decision. Leaderboard figures (return, followers, Sharpe ratio and similar) are calculated from past trades and are not a forecast. ${BRAND_NAME} does not select masters for you and does not recommend any master.` },
      { n: '9.3', body: `Masters may charge a performance fee, shown before you follow, on the net profit of the trades mirrored in your account over the fee period. The fee is deducted automatically.` },
      { n: '9.4', body: `You may stop following at any time. Stopping prevents new trades from being mirrored; positions already open remain open until you close them or the master's closing trade is mirrored, according to the option you choose.` },
      { n: '9.5', body: `To act as a master you must apply in the Platform, be approved, trade only your own account and not make misleading claims about your performance. We may suspend a master or remove them from the leaderboard at any time.` },
    ],
  },
  {
    h: '10. PAMM Accounts',
    clauses: [
      { n: '10.1', body: `PAMM lets you invest funds with an approved manager who trades a pooled account on behalf of all investors. Profits and losses are allocated to investors in proportion to their share of the pool, after the manager's performance fee.` },
      { n: '10.2', body: `Managers apply in the Platform and are reviewed before approval. Approval means the manager has met our onboarding requirements; it is not an endorsement of the manager's skill and does not guarantee any result.` },
      { n: '10.3', body: `Deposits to and withdrawals from a PAMM account are processed according to the settlement schedule shown for that manager. A withdrawal request may take effect at the next settlement and while positions are open may be executed at the then-current value of your share.` },
      { n: '10.4', body: `Losses in a PAMM account can be substantial. You should invest only what you can afford to lose.` },
    ],
  },
  {
    h: '11. Introducing Partner (IB) and Referral Programmes',
    clauses: [
      { n: '11.1', body: `You may apply in the Platform to become an introducing partner. If approved you receive a personal referral link and code and a dashboard of your network, volume and earnings. Your network may include sub-partners you introduce, and you earn on the traders they bring in according to the published tier table.` },
      { n: '11.2', body: `Partner commission is calculated per lot at the moment a referred live trade fills and is released when that trade closes. Demo trades, trades on your own accounts, self-referrals and trades on accounts we determine to be connected to you do not earn commission.` },
      { n: '11.3', body: `Payouts are reviewed and approved by our team before release. We may withhold, adjust or reclaim commission where trades are reversed, where an account is closed for breach of these Terms, or where we identify abuse, churning, wash trading or misleading promotion.` },
      { n: '11.4', body: `Partners must describe ${BRAND_NAME} accurately, must not promise returns, must display our risk warning wherever they promote the Platform and must not promote it in restricted jurisdictions. We may change tiers and rates or end the programme with notice.` },
      { n: '11.5', body: `The refer-a-friend programme is subject to the terms shown on the referral page at the time you share your link.` },
    ],
  },
  {
    h: '12. API, Algo Connector and AI Strategies',
    clauses: [
      { n: '12.1', body: `You may generate an API key and secret per trading account (the "Algo Connector") to place, modify and close orders, read your account and positions, and receive price ticks from your own software. API orders follow the same execution path, margin rules and risk checks as orders placed in the terminal.` },
      { n: '12.2', body: `Your API keys are yours to protect. Every order placed with your keys is your order, whether or not you intended it. Store keys securely, never share them, and revoke them in the Platform immediately if you suspect they have been exposed. We are not responsible for losses caused by a compromised key or by a bug in your software.` },
      { n: '12.3', body: `We may apply rate limits, suspend keys that generate abusive traffic or manifestly erroneous orders, and change the API with reasonable notice.` },
      { n: '12.4', body: `The AI Strategy Builder turns a plain-language description into a rules-based strategy that you can backtest and deploy on your account. Backtests use historical data and cannot reproduce future conditions, slippage or outages. A deployed strategy trades your account automatically until you pause it; you must monitor it and set appropriate risk limits. ${BRAND_NAME} does not guarantee the performance of any strategy.` },
    ],
  },
  {
    h: '13. Prohibited Conduct',
    clauses: [
      { n: '13.1', body: `You must not: (a) exploit price-feed latency, quoting errors or Platform malfunctions; (b) engage in wash trading, hedging across accounts or between connected persons to manipulate volume, commissions or programme rewards; (c) open or operate accounts for others or let others trade your account outside the copy-trading and PAMM programmes; (d) deposit funds that are not lawfully yours or use the Platform to launder money; (e) use bots, scrapers or automated access other than through the API; (f) attempt to reverse engineer, disrupt or gain unauthorised access to the Platform; (g) provide false information or documents; (h) use the Platform from a restricted jurisdiction or via tools that disguise your location; or (i) use the Platform in breach of any law.` },
      { n: '13.2', body: `Where we reasonably believe you have breached this Section we may cancel or reverse the trades concerned, withhold related profits or commissions, suspend or close your accounts and report the matter to the relevant authorities.` },
    ],
  },
  {
    h: '14. Fees and Charges',
    clauses: [
      { n: '14.1', body: `Our charges consist of the spread, any commission applicable to your account type, overnight swaps, performance fees charged by masters or managers you follow, and any payment-provider or network fees on deposits and withdrawals. All charges are shown in the Platform before you trade or transfer.` },
      { n: '14.2', body: `We may change our charges with reasonable notice. Changes do not apply retroactively to closed trades.` },
    ],
  },
  {
    h: '15. Intellectual Property and Third-Party Content',
    clauses: [
      { n: '15.1', body: `The Platform, its software, design, data, documentation and trademarks belong to ${BRAND_NAME} or its licensors. You receive a personal, non-transferable, revocable licence to use the Platform for your own trading in accordance with these Terms.` },
      { n: '15.2', body: `Charting is provided by TradingView and market data, news and calendars are supplied by third parties. Their use is subject to their own terms. We do not warrant the accuracy or timeliness of third-party content.` },
      { n: '15.3', body: `Share-a-trade cards and public trade links you create are visible to anyone with the link. Do not share them if you would rather keep your trades private.` },
    ],
  },
  {
    h: '16. Suspension, Closure and Termination',
    clauses: [
      { n: '16.1', body: `You may close your account at any time by closing your open positions and pending orders, withdrawing your balance and contacting support. See our Delete Account page for the steps and for what we are required to retain.` },
      { n: '16.2', body: `We may suspend or close your account, with or without notice, if you breach these Terms, fail or refuse verification, if required by law or by a payment or liquidity provider, if your account is inactive for an extended period, or if we withdraw the Platform from your jurisdiction.` },
      { n: '16.3', body: `On closure we may close your open positions at the prevailing market price, deduct any amounts you owe us and return the remaining balance to you by the method used to deposit, subject to verification.` },
    ],
  },
  {
    h: '17. Limitation of Liability',
    clauses: [
      { n: '17.1', body: `To the fullest extent permitted by law, ${BRAND_NAME} is not liable for trading losses, loss of profit, loss of opportunity or any indirect, incidental, consequential or special loss arising from your use of the Platform.` },
      { n: '17.2', body: `We are not liable for loss caused by your internet connection or device, by delays or failures of third-party price feeds, payment providers, blockchain networks or charting services, by market gaps, illiquidity or extreme volatility, by the actions of a master trader, PAMM manager or partner, or by events beyond our reasonable control.` },
      { n: '17.3', body: `Nothing in these Terms excludes liability that cannot be excluded by law, including liability for our fraud or wilful misconduct.` },
    ],
  },
  {
    h: '18. Changes to These Terms',
    clauses: [
      { n: '18.1', body: `We may update these Terms from time to time. We will publish the revised Terms on the Platform and, for material changes, notify you by email or in-app notice before they take effect.` },
      { n: '18.2', body: `Continued use of the Platform after a change takes effect means you accept the revised Terms. If you do not accept them, close your account under Section 16.` },
    ],
  },
  {
    h: '19. Governing Law and Disputes',
    clauses: [
      { n: '19.1', body: `These Terms are governed by the laws applicable to our operating entity.` },
      { n: '19.2', body: `If you have a complaint, contact support first; we aim to acknowledge complaints promptly and resolve them fairly. Any dispute that cannot be resolved this way is subject to the exclusive jurisdiction of the courts or arbitration forum competent for our operating entity, unless the law of your country of residence grants you a non-excludable right to bring proceedings elsewhere.` },
    ],
  },
];

const CONTACT_HEADING = '20. Contact';
const RISK_HEADING = 'Risk Warning';

const TOC = [
  ...SECTIONS.map((s) => ({ id: legalAnchor(s.h), label: s.h })),
  { id: legalAnchor(CONTACT_HEADING), label: CONTACT_HEADING },
  { id: legalAnchor(RISK_HEADING), label: RISK_HEADING },
];

export default function TermsPage() {
  return (
    <main>
      <PageHero
        kicker="Legal"
        title="Terms of Service"
        lead={`The agreement between you and ${BRAND_NAME} for your trading account and your use of the platform. Please read it carefully before you trade.`}
      />

      <Section raised>
        <LegalDoc toc={TOC} updated="September 2026">
          {SECTIONS.map(({ h, clauses }) => (
            <LegalSection key={h} id={legalAnchor(h)} heading={h}>
              {clauses.map(({ n, body }) => (
                <LegalClause key={n} n={n}>{body}</LegalClause>
              ))}
            </LegalSection>
          ))}

          <LegalSection id={legalAnchor(CONTACT_HEADING)} heading={CONTACT_HEADING}>
            <LegalP>
              Questions about these Terms, your account or a complaint can be raised through the
              in-app support centre or by email:
            </LegalP>
            <LegalCallout>
              <span style={{ color: 'var(--mk-text)', fontWeight: 700 }}>{BRAND_NAME} Support</span>
              <br />
              Email:{' '}
              <a
                href={`mailto:${BRAND_SUPPORT_EMAIL}`}
                className="hover:underline"
                style={{ color: 'var(--mk-accent)' }}
              >
                {BRAND_SUPPORT_EMAIL}
              </a>
            </LegalCallout>
            <LegalP>
              By using the {BRAND_NAME} platform you confirm that you have read, understood and agreed
              to these Terms of Service.
            </LegalP>
          </LegalSection>

          <LegalSection id={legalAnchor(RISK_HEADING)} heading={RISK_HEADING}>
            <LegalCallout tone="warn">
              Trading leveraged products such as forex and CFDs carries a high level of risk and may
              not be suitable for all investors. You could lose more than your initial deposit.
              Leverage of up to 1:500 amplifies both gains and losses. Past performance — including
              the results shown on copy-trading leaderboards, PAMM rankings and strategy backtests —
              is not a reliable indicator of future results. Only trade with money you can afford to
              lose.
            </LegalCallout>
            <LegalP>
              These Terms work alongside our{' '}
              <Link href="/privacy" className="hover:underline" style={{ color: 'var(--mk-accent)' }}>
                Privacy Policy
              </Link>
              ,{' '}
              <Link href="/risk-warning" className="hover:underline" style={{ color: 'var(--mk-accent)' }}>
                Risk Warning
              </Link>
              ,{' '}
              <Link href="/risk" className="hover:underline" style={{ color: 'var(--mk-accent)' }}>
                Disclaimer
              </Link>{' '}
              and{' '}
              <Link href="/restricted-countries" className="hover:underline" style={{ color: 'var(--mk-accent)' }}>
                Restricted Countries
              </Link>{' '}
              policy.
            </LegalP>
          </LegalSection>
        </LegalDoc>
      </Section>

      <CtaBanner
        title="Ready to trade?"
        lead={`Open a ${BRAND_NAME} account in minutes, or start with a free $10,000 demo. Our support team is one message away if anything is unclear.`}
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'Contact support', href: `mailto:${BRAND_SUPPORT_EMAIL}` }}
      />
    </main>
  );
}
