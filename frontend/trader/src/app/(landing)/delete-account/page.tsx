import Link from 'next/link';
import { Section, PageHero, CtaBanner } from '@/marketing/components';
import {
  LegalDoc, LegalSection, LegalP, LegalList, LegalCallout, legalAnchor,
} from '../_legal/LegalDoc';
import { BRAND_NAME, BRAND_SUPPORT_EMAIL } from '@/lib/brand';

/**
 * Account & Data Deletion — public page.
 *
 * Required by Google Play (Data safety → "Account deletion" URL) and Apple,
 * so it must be reachable WITHOUT login and lives under (landing). Explains
 * how a trader closes their PowerTradeFX account — close positions,
 * withdraw, then request deletion through support — what is erased, and
 * what we are legally required to retain (transaction / AML records).
 */

const SUPPORT_EMAIL = `${BRAND_SUPPORT_EMAIL}`;
const SUBJECT = 'Account Deletion Request';

const HEADINGS = {
  before: 'Before you request deletion',
  request: 'How to request deletion',
  deleted: 'What is deleted',
  retained: 'What we must retain (and for how long)',
  timeline: 'Timeline & conditions',
  questions: 'Questions about your data?',
};

const TOC = Object.values(HEADINGS).map((h) => ({ id: legalAnchor(h), label: h }));

const BEFORE = [
  'Close all open positions and cancel all pending orders on every trading account under your login. We cannot delete an account that still has exposure.',
  'Stop any copy-trading follows and PAMM investments and wait for any pending settlements to complete.',
  'Revoke your Algo Connector API keys and pause any deployed AI strategies so nothing can trade after you leave.',
  'Withdraw your full balance. Identity verification (KYC) must be complete before a withdrawal can be released, and withdrawals go back to the method you deposited with.',
  'If you are a partner, note that unpaid commission is settled at the next payout review; it cannot be claimed once the account is deleted.',
];

const DELETED = [
  'Profile and contact details (name, email, phone, address)',
  'Login credentials, two-factor authentication secrets and active sessions',
  'Google sign-in link and API keys',
  'Account settings, terminal layout, watchlists and preferences',
  'Demo accounts and their virtual balances',
  'Saved AI strategies, strategy backtests and trading-journal notes',
  'Copy-trading, PAMM and partner profiles, including any public leaderboard entry',
  'Marketing and communication preferences',
];

const RETAINED = [
  'Deposit, withdrawal, transfer and trade records for every live account — required by the anti-money-laundering, tax and record-keeping laws that apply to our operating entity — for the statutory retention period after closure.',
  'Identity-verification (KYC) records and sanctions-screening results, for the period those same laws require.',
  'Support correspondence and records needed to resolve an open dispute, chargeback or complaint, or to comply with a court or regulatory order.',
  'Anonymised statistics that no longer identify you.',
];

export default function DeleteAccountPage() {
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(
    `I would like to permanently delete my ${BRAND_NAME} account and associated personal data.\n\nRegistered email: \nTrading account number(s): \nI confirm all positions are closed and my balance has been withdrawn: yes / no\nReason (optional): `,
  )}`;

  return (
    <main>
      <PageHero
        kicker="Your Data"
        title="Delete Your Account"
        lead={`How to close your ${BRAND_NAME} trading account and have your personal data deleted — what is removed, what we are required to keep, and how long it takes.`}
      />

      <Section raised>
        <LegalDoc toc={TOC} updated="September 2026">
          <LegalSection id={legalAnchor(HEADINGS.before)} heading={HEADINGS.before}>
            <LegalP>
              A trading account can only be deleted once it is empty and inactive. Please do the
              following first:
            </LegalP>
            <LegalList items={BEFORE} />
          </LegalSection>

          <LegalSection id={legalAnchor(HEADINGS.request)} heading={HEADINGS.request}>
            <LegalP>
              Once your accounts are empty, request deletion in either of these ways:
            </LegalP>
            <ol className="flex flex-col gap-3">
              <li className="mk-body flex items-start gap-3">
                <span
                  className="shrink-0 inline-flex items-center justify-center rounded-full"
                  style={{
                    width: '1.5rem',
                    height: '1.5rem',
                    marginTop: '0.15em',
                    background: 'var(--mk-accent-soft)',
                    color: 'var(--mk-accent)',
                    fontSize: 'var(--mk-text-xs)',
                    fontWeight: 700,
                  }}
                >
                  1
                </span>
                <span>
                  <span style={{ color: 'var(--mk-text)', fontWeight: 700 }}>
                    From inside the platform:
                  </span>{' '}
                  Sign in, open <span style={{ color: 'var(--mk-text)' }}>Support</span> and raise a
                  ticket with the subject &quot;{SUBJECT}&quot;. Tickets raised from your logged-in
                  session need no further identity check.
                </span>
              </li>
              <li className="mk-body flex items-start gap-3">
                <span
                  className="shrink-0 inline-flex items-center justify-center rounded-full"
                  style={{
                    width: '1.5rem',
                    height: '1.5rem',
                    marginTop: '0.15em',
                    background: 'var(--mk-accent-soft)',
                    color: 'var(--mk-accent)',
                    fontSize: 'var(--mk-text-xs)',
                    fontWeight: 700,
                  }}
                >
                  2
                </span>
                <span>
                  <span style={{ color: 'var(--mk-text)', fontWeight: 700 }}>By email:</span> Send a
                  request from your registered email address to{' '}
                  <a href={mailto} className="hover:underline" style={{ color: 'var(--mk-accent)' }}>
                    {SUPPORT_EMAIL}
                  </a>{' '}
                  with the subject &quot;{SUBJECT}&quot;. We may ask you to confirm your identity
                  before proceeding.
                </span>
              </li>
            </ol>
            <div>
              <a href={mailto} className="mk-btn mk-btn--primary">
                Request account deletion
              </a>
            </div>
          </LegalSection>

          <LegalSection id={legalAnchor(HEADINGS.deleted)} heading={HEADINGS.deleted}>
            <LegalP>
              Once your request is verified and your accounts are confirmed empty, we close every
              trading account under your login and permanently remove the following personal data:
            </LegalP>
            <LegalList items={DELETED} />
            <LegalP>
              Public share-a-trade links you created stop working. Your display name is removed from
              copy-trading and PAMM leaderboards; historical performance figures for a master or
              manager may be kept in anonymised form so that followers&apos; own records stay accurate.
            </LegalP>
          </LegalSection>

          <LegalSection id={legalAnchor(HEADINGS.retained)} heading={HEADINGS.retained}>
            <LegalP>
              As a trading platform we are legally required to keep certain records after an account
              is closed. These are kept only for as long as the law requires, stored securely with
              restricted access, and are not used for marketing or any other purpose:
            </LegalP>
            <LegalList items={RETAINED} />
            <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text-faint)' }}>
              When the mandated retention period expires, this residual data is permanently deleted
              as well.
            </p>
          </LegalSection>

          <LegalSection id={legalAnchor(HEADINGS.timeline)} heading={HEADINGS.timeline}>
            <ul className="flex flex-col gap-2">
              <li className="mk-body flex items-start gap-3">
                <span className="shrink-0 rounded-full" style={{ width: '5px', height: '5px', marginTop: '0.62em', background: 'var(--mk-accent)' }} />
                <span>
                  Requests are verified against your registered identity to protect your account
                  and funds from fraudulent deletion.
                </span>
              </li>
              <li className="mk-body flex items-start gap-3">
                <span className="shrink-0 rounded-full" style={{ width: '5px', height: '5px', marginTop: '0.62em', background: 'var(--mk-accent)' }} />
                <span>
                  If an account still holds a balance, open positions or a pending withdrawal, we
                  will tell you what needs to happen first and pause the request until it is done.
                </span>
              </li>
              <li className="mk-body flex items-start gap-3">
                <span className="shrink-0 rounded-full" style={{ width: '5px', height: '5px', marginTop: '0.62em', background: 'var(--mk-accent)' }} />
                <span>
                  Export anything you want to keep — your trade history and journal can be exported
                  from the portfolio page — before you confirm.{' '}
                  <span style={{ color: 'var(--mk-text)' }}>Deletion is permanent and cannot be undone.</span>
                </span>
              </li>
              <li className="mk-body flex items-start gap-3">
                <span className="shrink-0 rounded-full" style={{ width: '5px', height: '5px', marginTop: '0.62em', background: 'var(--mk-accent)' }} />
                <span>
                  Deletion is normally completed within{' '}
                  <span style={{ color: 'var(--mk-text)' }}>30 days</span> of a verified request. We
                  confirm by email when it is done.
                </span>
              </li>
              <li className="mk-body flex items-start gap-3">
                <span className="shrink-0 rounded-full" style={{ width: '5px', height: '5px', marginTop: '0.62em', background: 'var(--mk-accent)' }} />
                <span>
                  You are welcome to open a new account later, but you will need to register and
                  complete identity verification again.
                </span>
              </li>
            </ul>
          </LegalSection>

          <LegalSection id={legalAnchor(HEADINGS.questions)} heading={HEADINGS.questions}>
            <LegalCallout>
              Contact our team at{' '}
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="hover:underline"
                style={{ color: 'var(--mk-accent)' }}
              >
                {SUPPORT_EMAIL}
              </a>{' '}
              or see our{' '}
              <Link href="/privacy" className="hover:underline" style={{ color: 'var(--mk-accent)' }}>
                Privacy Policy
              </Link>{' '}
              for the full picture of what we collect and why.
            </LegalCallout>
          </LegalSection>
        </LegalDoc>
      </Section>

      <CtaBanner
        title="Need help closing your account?"
        lead={`Our support team can check that your ${BRAND_NAME} accounts are empty, release your last withdrawal and confirm what will be deleted.`}
        primary={{ label: 'Contact support', href: mailto }}
        secondary={{ label: 'Privacy Policy', href: '/privacy' }}
      />
    </main>
  );
}
