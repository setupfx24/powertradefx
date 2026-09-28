import Link from 'next/link';
import { Section, PageHero, CtaBanner } from '@/marketing/components';
import {
  LegalDoc, LegalSection, LegalP, LegalList, LegalCallout, legalAnchor,
} from '../_legal/LegalDoc';
import { BRAND_NAME, BRAND_SUPPORT_EMAIL } from '@/lib/brand';

/**
 * Restricted Countries — public legal page.
 *
 * Where PowerTradeFX does not accept clients, how residency is checked
 * at KYC, and what happens if someone misrepresents their location.
 * The country list is the sanctions-style list also shown in the site
 * footer; it is a policy list, not legal advice on any jurisdiction.
 */

const RESTRICTED = [
  'United States of America (USA)',
  'Cuba',
  'Iraq',
  'Myanmar',
  'North Korea',
  'Sudan',
];

const SECTIONS: { h: string; body: string; list?: string[]; trailing?: string }[] = [
  {
    h: '1. Overview',
    body: `${BRAND_NAME} ("${BRAND_NAME}", "we", "our" or "us") does not open accounts for, or provide trading services to, residents or citizens of jurisdictions where doing so would be unlawful, where local rules would require a licence we do not hold, or which are subject to comprehensive international sanctions. This page lists the jurisdictions currently affected and explains how we apply the policy.`,
  },
  {
    h: '2. Restricted Jurisdictions',
    body: `We do not accept clients who are resident in, citizens of, or located in the following jurisdictions:`,
    list: RESTRICTED,
    trailing: `The platform is also not intended for anyone in any other country or territory where access to, or use of, leveraged trading services offered by ${BRAND_NAME} would be contrary to local law or regulation. The list above is not exhaustive and we may decline an application from any jurisdiction at our discretion.`,
  },
  {
    h: '3. How We Check Residency',
    body: `Residency and location are checked during registration and identity verification (KYC) and monitored afterwards:`,
    list: [
      'You declare your country of residence and nationality when you register.',
      'Your government-issued ID and, where requested, proof of address are checked against that declaration before you can withdraw.',
      'IP address and device signals are monitored for logins that are inconsistent with your declared location.',
      'Names are screened against applicable sanctions and watch lists at onboarding and periodically thereafter.',
    ],
    trailing: 'If any of these checks indicate a restricted jurisdiction we may pause the account and ask for further documents before deciding whether it can remain open.',
  },
  {
    h: '4. Your Responsibility',
    body: `It is your responsibility to make sure that trading leveraged products with ${BRAND_NAME} is lawful where you live and that you are not a restricted person. By opening an account you confirm that you are not resident in, a citizen of, or acting on behalf of any person in a restricted jurisdiction, and you agree to tell us promptly if you move to one.`,
  },
  {
    h: '5. Misrepresentation',
    body: `Attempting to open or use an account from a restricted jurisdiction — including by giving a false address, using someone else's documents, or using a VPN, proxy or other tool to disguise your location — is a breach of our Terms of Service and may result in:`,
    list: [
      'Immediate suspension of trading on the account',
      'Closure of open positions at the prevailing market price',
      'Closure of the account and return of any verified balance to its source, less applicable charges, once our checks are complete',
      'Forfeiture of programme rewards or partner commissions earned through the account',
      'Reporting of the matter to the relevant authorities where required',
    ],
  },
  {
    h: '6. Sanctions Screening',
    body: `Regardless of country of residence, we do not provide services to individuals or entities listed on applicable sanctions lists (including, without limitation, UN, OFAC, EU and UK lists) or owned or controlled by such persons. Matches found during screening lead to the account being frozen while the match is reviewed.`,
  },
  {
    h: '7. Changes to This List',
    body: `Sanctions and local regulation change. We may add or remove jurisdictions, or change how we apply this policy, at any time. The current version is published on this page with its date. If your country is added to the list after you open an account, we will contact you about closing positions and withdrawing your balance.`,
  },
  {
    h: '8. Contact',
    body: `If you are unsure whether you can open an account from your country, or you believe a restriction has been applied to you in error, contact ${BRAND_SUPPORT_EMAIL} before registering or depositing. We aim to respond within five business days.`,
  },
];

const TOC = SECTIONS.map((s) => ({ id: legalAnchor(s.h), label: s.h }));

export default function RestrictedCountriesPage() {
  return (
    <main>
      <PageHero
        kicker="Legal"
        title="Restricted Countries"
        lead={`Where ${BRAND_NAME} does not accept clients, and how we check residency when you verify your account.`}
      />

      <Section raised>
        <LegalDoc toc={TOC} updated="September 2026">
          {/* Headline callout — quick-glance list of restricted countries */}
          <LegalCallout tone="warn">
            <span style={{ color: 'var(--mk-text)', fontWeight: 700 }}>
              We do not accept clients from:
            </span>{' '}
            {RESTRICTED.join(' · ')}, or from any other jurisdiction where our services would be
            unlawful.
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
            <Link href="/terms" className="hover:underline" style={{ color: 'var(--mk-accent)' }}>
              Terms of Service
            </Link>
            ,{' '}
            <Link href="/privacy" className="hover:underline" style={{ color: 'var(--mk-accent)' }}>
              Privacy Policy
            </Link>{' '}
            and{' '}
            <Link href="/risk-warning" className="hover:underline" style={{ color: 'var(--mk-accent)' }}>
              Risk Warning
            </Link>
            . Trading leveraged products such as forex and CFDs carries a high level of risk and may
            not be suitable for all investors. You could lose more than your initial deposit.
          </LegalP>
        </LegalDoc>
      </Section>

      <CtaBanner
        title="Eligible to trade?"
        lead={`If your country is not on the list, you can open a ${BRAND_NAME} account in minutes. Not sure? Ask our support team first.`}
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'Contact support', href: `mailto:${BRAND_SUPPORT_EMAIL}` }}
      />
    </main>
  );
}
