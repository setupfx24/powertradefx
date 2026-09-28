'use client';

/**
 * Deposits & withdrawals — how you fund a PowerTradeFX account and get
 * money back out. Everything here mirrors the in-app wallet (/wallet)
 * and KYC (/kyc) flows. Linked from the footer.
 */
import Link from 'next/link';
import Image from 'next/image';
import {
  Wallet, ShieldCheck, Mail, Coins, Landmark, ArrowLeftRight, Clock, FileCheck2, History,
} from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner, FaqAccordion } from '@/marketing/components';
import { BRAND_NAME, BRAND_SUPPORT_EMAIL } from '@/lib/brand';

const METHODS = [
  {
    Icon: Coins,
    title: 'Crypto (USDT)',
    lines: ['Networks: TRC20, BEP20 and ERC20', 'Deposit to the address shown in your wallet', 'Credited once the network confirms', 'Withdrawals typically same-day'],
  },
  {
    Icon: Landmark,
    title: 'Local banking',
    lines: ['Bank transfer or UPI via a payment link', 'Pay from your own bank or UPI app', 'Withdrawals to your bank account or UPI ID', 'Withdrawals reviewed by our team'],
  },
];

const DEPOSIT_STEPS = [
  { n: '01', title: 'Open your wallet', body: 'Sign in and go to Wallet. Choose Deposit, then pick crypto or local banking.' },
  { n: '02', title: 'Send the funds', body: 'For USDT, send to the address shown on the network you selected. For local banking, complete the payment link with bank transfer or UPI.' },
  { n: '03', title: 'Move it to an account', body: 'Once credited, transfer from your main wallet to any of your trading accounts and start trading.' },
];

const WITHDRAW_STEPS = [
  { n: '01', title: 'Complete KYC once', body: 'Upload a government ID, a selfie and proof of address at /kyc. Withdrawals are released only on verified accounts.' },
  { n: '02', title: 'Request a withdrawal', body: 'In Wallet, choose Withdraw, pick USDT (TRC20, BEP20 or ERC20) or bank/UPI, and enter the amount and destination.' },
  { n: '03', title: 'We process it', body: 'Crypto withdrawals are typically sent the same day. Bank and UPI withdrawals are reviewed by our team before release.' },
];

export default function DepositWithdrawalPage() {
  return (
    <main>
      <PageHero
        kicker="Funding"
        title="Deposits and withdrawals"
        lead={`Fund your ${BRAND_NAME} account with USDT or local banking, move money between your accounts, and withdraw to crypto or your bank. Every transaction is listed in your wallet history.`}
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'Try a free demo', href: '/auth/login' }}
      />

      {/* Methods */}
      <Section raised>
        <SectionHeading
          kicker="Methods"
          title="Two ways to fund, two ways to withdraw"
          lead="Pick the one that suits you. Both are handled from the Wallet page inside the platform."
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-12 mx-auto max-w-4xl">
          {METHODS.map(({ Icon, title, lines }) => (
            <article key={title} className="mk-card flex flex-col gap-4">
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
              >
                <Icon size={20} />
              </span>
              <h3 className="mk-h3">{title}</h3>
              <ul className="flex flex-col gap-2">
                {lines.map((l) => (
                  <li key={l} className="flex items-start gap-2 mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>
                    <ShieldCheck size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--mk-accent)' }} />
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <p className="mk-meta mt-6 text-center mx-auto max-w-2xl">
          Demo accounts cannot deposit or withdraw. Send USDT only on the network shown in your wallet; a transfer
          on the wrong network cannot be recovered.
        </p>
      </Section>

      {/* Deposit steps */}
      <Section>
        <SectionHeading kicker="Deposits" title="How to deposit" />
        <ol className="grid sm:grid-cols-3 gap-5 mt-12" aria-label="How to deposit">
          {DEPOSIT_STEPS.map((s) => (
            <li key={s.n} className="mk-card flex flex-col gap-3">
              <span className="font-extrabold" style={{ fontSize: 'var(--mk-text-h2)', color: 'var(--mk-accent)', lineHeight: 1 }}>{s.n}</span>
              <h3 className="mk-h3">{s.title}</h3>
              <p className="mk-body">{s.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Withdrawals + KYC screenshot */}
      <Section raised>
        <SectionHeading
          kicker="Withdrawals"
          title="How to withdraw"
          lead="Withdrawals go to USDT or to your bank/UPI. Identity verification is required before the first one."
        />
        <ol className="grid sm:grid-cols-3 gap-5 mt-12" aria-label="How to withdraw">
          {WITHDRAW_STEPS.map((s) => (
            <li key={s.n} className="mk-card flex flex-col gap-3">
              <span className="font-extrabold" style={{ fontSize: 'var(--mk-text-h2)', color: 'var(--mk-accent)', lineHeight: 1 }}>{s.n}</span>
              <h3 className="mk-h3">{s.title}</h3>
              <p className="mk-body">{s.body}</p>
            </li>
          ))}
        </ol>

        <figure className="mx-auto max-w-4xl mt-14">
          <div className="overflow-hidden" style={{ borderRadius: 'var(--mk-radius-lg)', border: '1px solid var(--mk-line)' }}>
            <Image
              src="/marketing/screens/kyc.png"
              alt={`The ${BRAND_NAME} KYC page where you upload a government ID, a selfie and proof of address`}
              width={1600}
              height={1000}
              sizes="(max-width: 1024px) 100vw, 896px"
              className="block h-auto w-full"
            />
          </div>
          <figcaption className="mk-meta mt-3 text-center">
            Verification takes a few minutes to submit: government ID, a selfie and proof of address.
          </figcaption>
        </figure>
      </Section>

      {/* Wallet features */}
      <Section>
        <SectionHeading kicker="Your wallet" title="What else the wallet does" />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            {
              icon: ArrowLeftRight,
              title: 'Internal transfers',
              body: 'Hold several trading accounts under one login and move funds between them and your main wallet instantly.',
            },
            {
              icon: History,
              title: 'Full transaction history',
              body: 'Every deposit, withdrawal and transfer with its status, so you always know where your money is.',
            },
            {
              icon: FileCheck2,
              title: 'KYC once, then done',
              body: 'Verify your identity a single time. After approval, withdrawals no longer wait on document checks.',
            },
            {
              icon: Clock,
              title: 'Clear timings',
              body: 'Crypto withdrawals are typically same-day. Bank and UPI withdrawals are reviewed by our team before release.',
            },
            {
              icon: Wallet,
              title: 'Several accounts, one wallet',
              body: 'Open more than one live account under the same login, fund each from the main wallet, and see all balances in one place.',
            },
            {
              icon: ShieldCheck,
              title: 'Protected sign-in',
              body: 'Password plus optional two-factor authentication, session protection and encrypted connections on every request.',
            },
          ]}
        />
      </Section>

      {/* FAQ */}
      <Section raised id="faq">
        <SectionHeading kicker="Questions" title="Funding FAQ" />
        <div className="mt-12 mx-auto max-w-3xl">
          <FaqAccordion
            items={[
              {
                q: 'Which USDT networks can I use?',
                a: <>TRC20, BEP20 and ERC20. Choose the network in your wallet before you send, and use exactly the address shown for that network. Funds sent on a different network cannot be recovered.</>,
              },
              {
                q: 'How do local-banking deposits work?',
                a: <>Choose local banking in the wallet and you receive a payment link. Pay it by bank transfer or UPI. Your balance is updated once the payment is confirmed.</>,
              },
              {
                q: 'Do I need KYC to deposit?',
                a: <>You can deposit and trade before verification, but withdrawals are released only after your KYC is approved. Verify early at /kyc so your first withdrawal is not held up.</>,
              },
              {
                q: 'How long do withdrawals take?',
                a: <>Crypto withdrawals are typically sent the same day. Bank and UPI withdrawals are reviewed by our team before release. You can track the status of every request in your wallet history.</>,
              },
              {
                q: 'Can I fund a demo account?',
                a: <>No. Demo accounts come with $10,000 of virtual funds and cannot deposit or withdraw. Open a live account at /trading/open-account when you are ready to trade real money.</>,
              },
              {
                q: 'Can I move money between my trading accounts?',
                a: <>Yes. Transfers between your main wallet and any of your trading accounts are instant and appear in your transaction history.</>,
              },
            ]}
          />
        </div>

        <div className="mk-card mx-auto max-w-3xl mt-10 flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck size={18} className="shrink-0 mt-0.5" style={{ color: 'var(--mk-accent)' }} />
            <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>
              Read this alongside our{' '}
              <Link href="/terms" className="underline-offset-4 hover:underline" style={{ color: 'var(--mk-accent)' }}>
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="underline-offset-4 hover:underline" style={{ color: 'var(--mk-accent)' }}>
                Privacy Policy
              </Link>
              .
            </p>
          </div>
          <a href={`mailto:${BRAND_SUPPORT_EMAIL}`} className="mk-btn mk-btn--primary shrink-0">
            <Mail size={16} /> Contact support
          </a>
        </div>
      </Section>

      <CtaBanner
        title="Ready to fund your account?"
        lead="Open a live account, verify once, and deposit with USDT or local banking."
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'Try a free demo', href: '/auth/login' }}
      />

      <div className="mk-container" style={{ paddingTop: 'var(--mk-space-6)', paddingBottom: 'var(--mk-space-8)' }}>
        <p className="mk-meta mx-auto max-w-3xl text-center">
          Trading leveraged products such as forex and CFDs carries a high level of risk and may not be suitable
          for all investors. You could lose more than your initial deposit.
        </p>
      </div>
    </main>
  );
}
