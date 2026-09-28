import Link from 'next/link';
import { Section, PageHero, CtaBanner } from '@/marketing/components';
import {
  LegalDoc, LegalSection, LegalSubheading, LegalP, LegalList, LegalCallout, legalAnchor,
} from '../_legal/LegalDoc';
import { BRAND_NAME, BRAND_SUPPORT_EMAIL } from '@/lib/brand';

/**
 * Privacy Policy — public legal page.
 *
 * What PowerTradeFX collects from a trader (identity / KYC, contact,
 * financial and transaction, device and usage data), why, who it is
 * shared with, how long it is kept, how it is secured, the rights a
 * trader has, and cookies. Rendered on the shared legal chrome.
 */

/**
 * Each section has a heading + body. `body` can mix prose paragraphs,
 * sub-sections (sub-heading + bullets), and plain bullet lists.
 */
type Subsection = { title: string; lead?: string; bullets?: string[]; trailing?: string };
type PolicySection = {
  h: string;
  lead?: string[];          // top-level prose paragraphs
  bullets?: string[];        // top-level bullets
  subs?: Subsection[];       // sub-sections like "Identity Information"
  trailing?: string[];       // closing paragraphs after bullets / subs
};

const INTRO: PolicySection = {
  h: `Privacy Policy of ${BRAND_NAME}`,
  lead: [
    `${BRAND_NAME} ("${BRAND_NAME}", "we", "our" or "us") operates an online trading platform. To open and run a trading account for you we have to collect and process personal data, and some of that processing — identity verification, transaction records, anti-money-laundering checks — is required by law. This Policy explains what we collect, why, who we share it with, how long we keep it and the choices you have.`,
    `It applies to everyone who visits our website, opens a demo or live account, uses the web, desktop or mobile terminal or the API, joins the copy-trading, PAMM or partner programmes, or contacts our support team. By using the platform you acknowledge this Policy. Where the law requires your consent for a particular use (for example marketing emails), we will ask for it separately.`,
  ],
};

const SECTIONS: PolicySection[] = [
  {
    h: '1. Data We Collect',
    lead: ['Depending on how you use the platform, we collect the following categories of personal data:'],
    subs: [
      { title: 'Identity and verification (KYC) data', bullets: ['Full name, date of birth, nationality and country of residence', 'Government-issued photo ID (passport, national ID or driving licence) and the details on it', 'A selfie or liveness check to match you to your ID', 'Proof of address (utility bill or bank statement) where requested', 'Source-of-funds information where required by our anti-money-laundering checks'] },
      { title: 'Contact data', bullets: ['Email address and, if you provide it, telephone number', 'Support tickets, chat and email correspondence'] },
      { title: 'Financial and transaction data', bullets: ['Wallet balances, deposits, withdrawals and internal transfers', 'Bank account details, UPI IDs and crypto-asset wallet addresses you use to fund or withdraw', 'Orders, positions, trade history, margin and equity figures for each trading account', 'Copy-trading follows and allocations, PAMM investments, partner network, referral codes and commission records', 'API keys you generate and the orders placed with them'] },
      { title: 'Device and usage data', bullets: ['IP address, approximate location derived from it, browser and operating system', 'Login times, session identifiers and two-factor authentication events', 'Pages and features you use, terminal layout and theme preferences', 'Diagnostic and error logs'] },
      { title: 'Data you choose to publish', bullets: ['Your display name and performance statistics if you become a copy-trading master or PAMM manager', 'Trades you share through share-a-trade cards and public links'] },
    ],
    trailing: ['If you sign in with Google we receive your name, email address and profile picture from Google. We do not receive your Google password.'],
  },
  {
    h: '2. Why We Use It',
    lead: ['We use your personal data to:'],
    subs: [
      { title: 'Provide your account', lead: 'To:', bullets: ['Register you and provide demo and live trading accounts', 'Quote prices, execute and record your orders and calculate margin', 'Process deposits, withdrawals and transfers', 'Run the copy-trading, PAMM, partner and referral programmes you take part in', 'Operate the API, AI Strategy Builder and other tools you enable'] },
      { title: 'Meet our legal obligations', lead: 'To:', bullets: ['Verify your identity and age before you withdraw', 'Carry out anti-money-laundering, sanctions and fraud screening', 'Keep the transaction and trading records the law requires us to keep', 'Respond to lawful requests from courts, regulators and law-enforcement agencies'] },
      { title: 'Keep the platform secure', lead: 'To:', bullets: ['Authenticate logins and enforce two-factor authentication', 'Detect unauthorised access, account sharing, price-abuse and other prohibited conduct', 'Investigate incidents and protect other users'] },
      { title: 'Support and communicate with you', lead: 'To:', bullets: ['Answer your tickets and emails', 'Send service messages — margin warnings, withdrawal confirmations, security alerts, changes to terms', 'Notify you about your copy-trading, PAMM or partner activity'] },
      { title: 'Improve the platform', lead: 'To:', bullets: ['Understand which features are used and where they fail', 'Test and roll out improvements', 'Produce aggregated statistics that do not identify you'] },
      { title: 'Marketing', lead: 'With your consent, or where the law otherwise allows, to tell you about:', bullets: ['New instruments, features and tools', 'Promotions and programme updates', 'Educational content and market news'], trailing: 'You can opt out of marketing at any time through the unsubscribe link in each email or by contacting support. Service messages about your account cannot be switched off while your account is open.' },
    ],
  },
  {
    h: '3. Legal Basis',
    lead: ['Where data-protection law requires a legal basis, we rely on:'],
    subs: [
      { title: 'Contract', lead: 'Processing needed to open and run your account under our Terms of Service.' },
      { title: 'Legal obligation', lead: 'Identity verification, anti-money-laundering, sanctions screening and record-keeping duties.' },
      { title: 'Legitimate interests', lead: 'Securing the platform, preventing fraud and abuse, improving our services and defending legal claims — balanced against your rights.' },
      { title: 'Consent', lead: 'Marketing communications and any optional cookies. You can withdraw consent at any time.' },
    ],
  },
  {
    h: '4. Who We Share It With',
    lead: [
      `${BRAND_NAME} does not sell your personal data.`,
      'We share it only with:',
    ],
    subs: [
      { title: 'Identity-verification (KYC) providers', lead: 'Who check your ID documents, selfie and address on our behalf and screen against sanctions and watch lists.' },
      { title: 'Payment providers and networks', lead: 'Banks, payment-link and UPI processors and crypto-asset payment services that process your deposits and withdrawals. They receive the details needed to move the funds.' },
      { title: 'Liquidity, pricing and charting providers', lead: 'Where we route orders to liquidity providers they receive trade data, not your identity. Charting is delivered by TradingView and news and calendar data by other third parties; they may set their own cookies as described in Section 8.' },
      { title: 'Hosting, email, analytics and security providers', lead: 'Who run infrastructure and services for us under contracts that limit them to acting on our instructions.' },
      { title: 'Other users, where you choose', lead: 'Your display name and performance statistics if you act as a master trader or PAMM manager; the trades you publish through share links; and, for partners, the trading volume of the accounts you referred (not their identity).' },
      { title: 'Authorities and advisers', lead: 'Regulators, courts, law-enforcement agencies, auditors and legal advisers where the law requires or allows it, or to establish or defend a legal claim.' },
      { title: 'A successor business', lead: 'If we merge with, are acquired by or transfer our business to another entity, your data may be transferred as part of that transaction subject to this Policy.' },
    ],
  },
  {
    h: '5. International Transfers',
    lead: [
      'Our infrastructure and some of our providers may be located outside your country. Where personal data is transferred across borders we use contractual safeguards and choose providers that apply appropriate security so that your data remains protected to a standard consistent with this Policy.',
    ],
  },
  {
    h: '6. How Long We Keep It',
    lead: ['We keep personal data only as long as we need it for the purposes above. In outline:'],
    bullets: [
      'Account, profile and contact data: for as long as your account is open, then deleted or anonymised after closure subject to the retention duties below.',
      'Identity-verification records, transaction records, trading history and related correspondence: for the period required by the anti-money-laundering, tax and record-keeping laws that apply to our operating entity after your account is closed.',
      'Support tickets and communications: for as long as needed to resolve the matter and for a limited period afterwards to handle follow-ups or disputes.',
      'Security and diagnostic logs: for a short rolling period unless needed for an investigation.',
      'Demo accounts: deleted when you delete them or after a period of inactivity.',
    ],
    trailing: ['See our Delete Account page for what happens when you close your account.'],
  },
  {
    h: '7. How We Protect It',
    lead: ['We apply technical and organisational measures appropriate to the sensitivity of the data, including:'],
    bullets: [
      'Encrypted connections (TLS) between your device and our servers',
      'Password hashing and optional two-factor authentication (TOTP) on every login',
      'Session protection and automatic sign-out of stale sessions',
      'Role-based access so that staff see only the data their job requires',
      'Segregated infrastructure for trading and financial data, with logging and monitoring',
      'Vetting of the providers that process data for us',
    ],
    trailing: ['No system is perfectly secure. Keep your password and 2FA device private, never share API keys, and tell us immediately if you suspect your account has been accessed without permission.'],
  },
  {
    h: '8. Cookies and Similar Technologies',
    lead: ['We use cookies and browser storage for:'],
    bullets: [
      'Essential functions — keeping you signed in, protecting sessions, remembering your terminal layout, theme and language',
      'Analytics — understanding how the site and platform are used so we can improve them',
      'Third-party embedded services — for example the TradingView charting library, which may set its own cookies',
    ],
    trailing: [
      'You can block or delete cookies in your browser settings. Essential cookies are required for the platform to work; blocking them will prevent you from signing in.',
    ],
  },
  {
    h: '9. Your Rights',
    lead: ['Depending on the law that applies to you, you may have the right to:'],
    subs: [
      { title: 'Access', lead: 'Ask for a copy of the personal data we hold about you.' },
      { title: 'Correction', lead: 'Have inaccurate or incomplete data corrected. You can update most profile details yourself in the platform.' },
      { title: 'Deletion', lead: 'Ask us to delete your data. We must keep some records for legal reasons — see Section 6 and the Delete Account page.' },
      { title: 'Restriction and objection', lead: 'Ask us to limit, or object to, certain processing, including direct marketing.' },
      { title: 'Portability', lead: 'Receive the data you gave us in a structured, machine-readable format. Your trade history can be exported from the platform.' },
      { title: 'Withdraw consent', lead: 'Where processing is based on consent, withdraw it at any time without affecting earlier processing.' },
      { title: 'Complain', lead: 'Lodge a complaint with the data-protection authority competent for you.' },
    ],
    trailing: ['To exercise a right, contact support from your registered email address. We may need to verify your identity before acting on a request, and we will respond within the time the law allows.'],
  },
  {
    h: '10. Children',
    lead: [`The platform is for adults only. We do not knowingly open accounts for, or collect data from, anyone under 18. If you believe a minor has provided us with personal data, contact ${BRAND_SUPPORT_EMAIL} and we will delete it.`],
  },
  {
    h: '11. Changes to This Policy',
    lead: [
      'We may update this Policy as the platform and the law change. The current version is always published here with its date. For material changes we will notify you by email or in-app notice before they take effect.',
    ],
  },
];

const CONTACT_HEADING = '12. Contact';

const TOC = [
  { id: legalAnchor(INTRO.h), label: INTRO.h },
  ...SECTIONS.map((s) => ({ id: legalAnchor(s.h), label: s.h })),
  { id: legalAnchor(CONTACT_HEADING), label: CONTACT_HEADING },
];

/** Renders one policy section body — prose, bullets, sub-sections, trailing prose. */
function SectionBody({ sec }: { sec: PolicySection }) {
  return (
    <>
      {sec.lead?.map((p, i) => <LegalP key={`lead-${i}`}>{p}</LegalP>)}
      {sec.bullets && <LegalList items={sec.bullets} />}
      {sec.subs?.map((sub) => (
        <div key={sub.title} className="flex flex-col gap-3">
          <LegalSubheading>{sub.title}</LegalSubheading>
          {sub.lead && <LegalP>{sub.lead}</LegalP>}
          {sub.bullets && <LegalList items={sub.bullets} />}
          {sub.trailing && <LegalP>{sub.trailing}</LegalP>}
        </div>
      ))}
      {sec.trailing?.map((p, i) => <LegalP key={`tail-${i}`}>{p}</LegalP>)}
    </>
  );
}

export default function PrivacyPage() {
  return (
    <main>
      <PageHero
        kicker="Legal"
        title="Privacy Policy"
        lead="What personal data we collect when you trade with us, why we collect it, who sees it and how long we keep it."
      />

      <Section raised>
        <LegalDoc toc={TOC} updated="September 2026">
          <LegalSection id={legalAnchor(INTRO.h)} heading={INTRO.h}>
            <SectionBody sec={INTRO} />
          </LegalSection>

          {SECTIONS.map((sec) => (
            <LegalSection key={sec.h} id={legalAnchor(sec.h)} heading={sec.h}>
              <SectionBody sec={sec} />
            </LegalSection>
          ))}

          <LegalSection id={legalAnchor(CONTACT_HEADING)} heading={CONTACT_HEADING}>
            <LegalP>
              For questions, requests or complaints about this Policy or your personal data, contact:
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
              Read this alongside our{' '}
              <Link href="/terms" className="hover:underline" style={{ color: 'var(--mk-accent)' }}>
                Terms of Service
              </Link>
              ,{' '}
              <Link href="/risk-warning" className="hover:underline" style={{ color: 'var(--mk-accent)' }}>
                Risk Warning
              </Link>{' '}
              and{' '}
              <Link href="/delete-account" className="hover:underline" style={{ color: 'var(--mk-accent)' }}>
                Delete Account
              </Link>{' '}
              page.
            </LegalP>
          </LegalSection>
        </LegalDoc>
      </Section>

      <CtaBanner
        title="Your data, your control"
        lead={`Open a ${BRAND_NAME} account knowing exactly what we keep and why — and reach our support team whenever you want to see, correct or delete it.`}
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'Contact support', href: `mailto:${BRAND_SUPPORT_EMAIL}` }}
      />
    </main>
  );
}
