import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Globe, Smartphone, Monitor, Plus, Wifi, RefreshCw, Server, MonitorSmartphone } from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Download / Trade anywhere.
 *
 * What exists today: the web terminal (/trade) in any modern browser, on
 * desktop and in phone browsers, installable to the home screen as a PWA
 * (src/app/manifest.ts). A native Windows/macOS desktop terminal exists in
 * the codebase and is available on request — no file is linked. The
 * Android app is coming soon; the old APK link returned 404, so it is not
 * linked either. No App Store / Play Store listing exists.
 */

export const metadata: Metadata = {
  title: `Trade Anywhere — Web, Mobile & Desktop | ${BRAND_NAME}`,
  description: `Trade with ${BRAND_NAME} in any browser, on your phone, or on the desktop terminal. One account, the same server-side execution everywhere.`,
};

const RISK_LINE =
  'Trading leveraged products such as forex and CFDs carries a high level of risk and may not be suitable for all investors. You could lose more than your initial deposit.';

const IOS_STEPS = [
  'Open the terminal in Safari on your iPhone or iPad.',
  'Tap the Share button in the browser toolbar.',
  'Scroll down and choose “Add to Home Screen”.',
  'Confirm the name, then tap “Add”. The icon appears on your home screen.',
];

const ANDROID_STEPS = [
  'Open the terminal in Chrome on your Android phone.',
  'Tap the ⋮ menu in the top-right corner.',
  'Choose “Install app” (or “Add to Home screen”).',
  'Confirm, and the app is added to your launcher.',
];

function InstallSteps({ title, steps }: { title: string; steps: string[] }) {
  return (
    <article className="mk-card flex flex-col gap-4">
      <h3 className="mk-h3">{title}</h3>
      <ol className="flex flex-col gap-3">
        {steps.map((step, i) => (
          <li key={step} className="mk-body flex items-start gap-3">
            <span
              className="shrink-0 inline-flex items-center justify-center rounded-full"
              style={{
                width: '1.5rem',
                height: '1.5rem',
                marginTop: '0.1em',
                background: 'var(--mk-accent-soft)',
                color: 'var(--mk-accent)',
                fontSize: 'var(--mk-text-xs)',
                fontWeight: 700,
              }}
            >
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </article>
  );
}

function StatusBadge({ children }: { children: React.ReactNode }) {
  return <span className="mk-badge mk-badge--accent">{children}</span>;
}

export default function DownloadPage() {
  return (
    <main>
      <PageHero
        kicker="Trade anywhere"
        title="One account. Every screen."
        lead={`The ${BRAND_NAME} terminal runs in any modern browser, fits a phone screen, and is available as a desktop terminal on request. Orders and stop levels run on our servers, so they stay live whichever device you close.`}
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'Open the web terminal', href: '/trade' }}
      />

      {/* The four ways in */}
      <Section raised>
        <SectionHeading kicker="Platforms" title="Choose how you trade" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-12">
          <article className="mk-card mk-card--hover flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl shrink-0"
                style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
              >
                <Globe size={20} />
              </span>
              <StatusBadge>Available now</StatusBadge>
            </div>
            <h3 className="mk-h3">Web terminal</h3>
            <p className="mk-body">
              Nothing to download. Sign in from Chrome, Safari, Edge or Firefox and the full
              terminal — TradingView charts, order ticket, positions, account panel — is there.
            </p>
            <div className="flex flex-wrap gap-3 mt-auto">
              <Link href="/trade" className="mk-btn mk-btn--primary">Open the terminal</Link>
              <Link href="/platforms/web" className="mk-btn mk-btn--ghost">What is inside</Link>
            </div>
          </article>

          <article className="mk-card mk-card--hover flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl shrink-0"
                style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
              >
                <Smartphone size={20} />
              </span>
              <StatusBadge>Available now</StatusBadge>
            </div>
            <h3 className="mk-h3">Phone browser</h3>
            <p className="mk-body">
              The same terminal, laid out for a phone: chart, watchlist and a mobile order sheet.
              Add it to your home screen and it opens like an app.
            </p>
            <div className="flex flex-wrap gap-3 mt-auto">
              <Link href="#install" className="mk-btn mk-btn--ghost">Add to home screen</Link>
            </div>
          </article>

          <article className="mk-card mk-card--hover flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl shrink-0"
                style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
              >
                <Monitor size={20} />
              </span>
              <span className="mk-badge">On request</span>
            </div>
            <h3 className="mk-h3">Desktop terminal for Windows and macOS</h3>
            <p className="mk-body">
              A native desktop terminal with live watchlist, charts, order ticket and account
              panel. Available on request — ask support from your account and we will set you up.
            </p>
            <div className="flex flex-wrap gap-3 mt-auto">
              <Link href="/auth/login" className="mk-btn mk-btn--ghost">Sign in and ask support</Link>
            </div>
          </article>

          <article className="mk-card mk-card--hover flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl shrink-0"
                style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
              >
                <MonitorSmartphone size={20} />
              </span>
              <span className="mk-badge">Coming soon</span>
            </div>
            <h3 className="mk-h3">Android app</h3>
            <p className="mk-body">
              A native Android app is in the works. Until it ships, the terminal in your phone
              browser gives you every feature, with the same account and the same execution.
            </p>
          </article>
        </div>
      </Section>

      {/* Phone section with the real capture */}
      <Section>
        <div className="grid lg:grid-cols-2 gap-10 items-center">
          <div className="mx-auto w-full" style={{ maxWidth: 320 }}>
            <Image
              src="/marketing/screens/terminal-phone.png"
              alt={`${BRAND_NAME} in a phone browser`}
              width={390}
              height={844}
              sizes="(max-width: 1024px) 80vw, 320px"
              className="block h-auto w-full"
              style={{ borderRadius: 'var(--mk-radius-lg)', border: '1px solid var(--mk-line)' }}
            />
          </div>
          <div className="flex flex-col gap-4 items-start">
            <span className="mk-kicker">On your phone</span>
            <h2 className="mk-h2">Full terminal, phone-sized</h2>
            <p className="mk-lead">
              Open the terminal in your phone browser and trade the same 40+ instruments with
              market, limit, stop and stop-limit orders. Stop-loss and take-profit run on the
              server, so a locked phone never means an unprotected position.
            </p>
            <Link href="/trade" className="mk-btn mk-btn--primary">Open the terminal</Link>
          </div>
        </div>
      </Section>

      {/* PWA install */}
      <Section id="install" raised>
        <SectionHeading
          kicker="Install as an app"
          title="Add it to your home screen"
          lead="The web terminal installs to the home screen and launches full-screen from its own icon — no app store, no download."
        />
        <div className="grid md:grid-cols-2 gap-5 mt-12">
          <InstallSteps title="iPhone & iPad (Safari)" steps={IOS_STEPS} />
          <InstallSteps title="Android (Chrome)" steps={ANDROID_STEPS} />
        </div>
        <p className="mk-body mt-6" style={{ fontSize: 'var(--mk-text-sm)' }}>
          Menu wording varies slightly between browser versions. If you do not see the option,
          check that you are using Safari on iOS or Chrome on Android — other browsers may not
          offer home-screen installation.
        </p>
      </Section>

      <Section>
        <SectionHeading
          kicker="Same everywhere"
          title="What stays the same on every device"
        />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            { icon: Wifi,      title: 'One login, one account',  body: 'Desktop browser, installed phone app or desktop terminal — your accounts, positions and watchlist follow you.' },
            { icon: Server,    title: 'Server-side execution',   body: 'Pending orders, stop-loss and take-profit are held by the engine, not by your device. Close the tab and they keep working.' },
            { icon: RefreshCw, title: 'Always current',          body: 'The web terminal loads the latest version every time. There is no update to install.' },
            { icon: Plus,      title: 'A tap away on mobile',    body: 'Once installed, the terminal sits on your home screen and opens straight to your account.' },
            { icon: Globe,     title: 'Any modern browser',      body: 'Chrome, Safari, Edge and Firefox on desktop and mobile.' },
            { icon: Monitor,   title: 'Desktop when you want it', body: 'The native Windows/macOS terminal is available on request from support.' },
          ]}
        />
      </Section>

      <Section className="mk-section--tight">
        <p
          className="mk-body mx-auto text-center"
          style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text-muted)', maxWidth: '70ch' }}
        >
          <strong>Risk warning:</strong> {RISK_LINE}
        </p>
      </Section>

      <CtaBanner
        title="Trade from wherever you are"
        lead="Open an account, or try the terminal on a $10,000 demo — one click, no email."
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'Try a free demo', href: '/auth/login' }}
      />
    </main>
  );
}
