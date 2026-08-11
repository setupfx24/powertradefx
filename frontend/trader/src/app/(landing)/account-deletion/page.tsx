export const metadata = {
  title: 'Account & Data Deletion — PowerTradeFX',
  description:
    'How to request deletion of your PowerTradeFX account and associated data, what is removed, and what we are legally required to retain.',
}

export default function AccountDeletionPage() {
  return (
    <div className="bg-white text-gray-900">
      <section className="bg-white pt-16 pb-12">
        <div className="w-full px-3 sm:px-6 lg:px-8">
          <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Account &amp; Data Deletion</h1>
          <p className="text-gray-500">Last updated: June 2026</p>
        </div>
      </section>

      <section className="py-12 bg-white">
        <div className="w-full px-3 sm:px-6 lg:px-8 space-y-10">

          <Section title="Overview">
            This page explains how you, as a PowerTradeFX user, can request deletion of your
            account and the personal data associated with it. It also describes which data is
            permanently deleted, which data we are legally required to retain, and how long the
            process takes. This applies to accounts created through the PowerTradeFX mobile app
            (Android) and the PowerTradeFX web platform.
          </Section>

          <Section title="How to request deletion">
            You can request deletion of your account using any of the methods below. For security,
            requests must come from — or be verifiable against — the email address registered to
            your PowerTradeFX account.

            <Sub title="Option 1 — From within the app">
              <List items={[
                'Open the PowerTradeFX app and sign in.',
                'Go to Profile → Support.',
                'Create a request with the subject "Delete my account".',
              ]} />
            </Sub>

            <Sub title="Option 2 — By email">
              Send an email from your registered email address to{' '}
              <a href="mailto:support@powertradefx.com?subject=Account%20Deletion%20Request"
                 className="text-accent hover:underline">support@powertradefx.com</a>{' '}
              with the subject line <span className="font-semibold text-gray-700">&quot;Account Deletion Request&quot;</span>.
              Please include the email address (and, if known, the account number) tied to your
              PowerTradeFX account so we can locate and verify it.
            </Sub>

            <p className="mt-4 text-gray-500">
              We may ask you to confirm your identity before processing the request — this protects
              your account from unauthorized deletion.
            </p>
          </Section>

          <Section title="What data is deleted">
            Once your request is verified and any regulatory retention period has elapsed, the
            following data is permanently deleted from our active systems:
            <List items={[
              'Your profile information — name, email, phone number, and address',
              'Account preferences and settings (theme, watchlists, notification settings)',
              'Marketing and communication preferences',
              'Support tickets and in-app messages',
              'Device and session information linked to your account',
              'Any saved payout/wallet details not subject to legal retention',
            ]} />
          </Section>

          <Section title="What data we must retain (and why)">
            PowerTradeFX operates a regulated financial / trading service. Certain records cannot be
            deleted immediately on request because we are legally obligated to keep them under
            financial, anti-money-laundering (AML), and tax regulations:
            <List items={[
              'Identity verification (KYC) documents and verification results',
              'Transaction history — deposits, withdrawals, and trades',
              'Records required for AML, fraud-prevention, and audit purposes',
              'Information needed to resolve disputes or enforce our agreements',
            ]} />
            <p className="mt-4 text-gray-500">
              These records are retained for the minimum period required by applicable law —
              typically <span className="font-semibold text-gray-700">7 years</span> — after which
              they are permanently deleted. During this period the data is access-restricted and
              used only for legal and compliance purposes, not for marketing or active service.
            </p>
          </Section>

          <Section title="Before you delete — settle your balance">
            If your account holds a positive balance or open positions, please withdraw your funds
            and close any open trades before requesting deletion. We cannot return funds after an
            account is closed, and open positions must be settled first.
          </Section>

          <Section title="Processing time">
            <List items={[
              'Deletion requests are acknowledged within 72 hours.',
              'Eligible personal data is removed from active systems within 30 days.',
              'Data under legal retention is deleted at the end of the required retention period (see above).',
            ]} />
          </Section>

          <Section title="Contact">
            For any questions about account or data deletion, or to check the status of a request,
            contact us:
            <ContactBox team="Data Protection Team" email="support@powertradefx.com" />
          </Section>
        </div>
      </section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">{title}</h2>
      <div className="text-gray-500 leading-relaxed space-y-3">{children}</div>
    </div>
  )
}

function Sub({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="font-semibold text-gray-800 mb-2">{title}</h3>
      {children}
    </div>
  )
}

function List({ items }: { items: string[] }) {
  return (
    <ul className="list-disc list-inside space-y-1.5 mt-2 text-gray-500">
      {items.map((item) => <li key={item}>{item}</li>)}
    </ul>
  )
}

function ContactBox({ team, email }: { team: string; email: string }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 mt-4 text-sm space-y-1">
      <p className="font-semibold text-gray-900">PowerTradeFX {team}</p>
      <p className="text-gray-500">Email: {email}</p>
    </div>
  )
}
