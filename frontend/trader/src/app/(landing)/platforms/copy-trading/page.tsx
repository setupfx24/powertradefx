import type { Metadata } from 'next';
import Link from 'next/link';
import { Copy, Users, TrendingUp, Shield, BarChart2, Settings, Check, HandCoins } from 'lucide-react';
import { Section, SectionHeading, PageHero, FeatureGrid, CtaBanner } from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Platforms → Copy Trading. The /social feature of the live platform,
 * described for the two people who use it: followers who mirror a master
 * trader, and masters who build a track record and earn a performance fee.
 * There is no product screenshot for this surface, so the illustration is
 * an inline SVG (master → followers fan-out) in brand colours.
 */

export const metadata: Metadata = {
  title: `Copy Trading | ${BRAND_NAME}`,
  description: `Follow master traders on the ${BRAND_NAME} leaderboard, set an allocation and mirror their trades automatically — or trade as a master and earn a performance fee.`,
};

const RISK_LINE =
  'Trading leveraged products such as forex and CFDs carries a high level of risk and may not be suitable for all investors. You could lose more than your initial deposit.';

const STEPS = [
  { step: '01', title: 'Open a live account', desc: 'Copy trading runs on live accounts. Open one, fund it, and go to Social in the app.' },
  { step: '02', title: 'Browse the leaderboard', desc: 'Sort master traders by return, number of followers or Sharpe ratio, and open any profile.' },
  { step: '03', title: 'Set an allocation and follow', desc: 'Choose how much of your balance to commit. From then on, every trade the master opens or closes is mirrored in your account.' },
  { step: '04', title: 'Watch, adjust, stop', desc: 'Track the copied positions in your terminal. Change the allocation or stop following at any time.' },
];

const MASTER_POINTS = [
  'Trade your own live account as normal — nothing changes in your terminal',
  'Your return, follower count and Sharpe ratio appear on the public leaderboard',
  'Set a performance fee that followers pay on the profit you make for them',
  'Followers can join or leave at any time; your trading is never interrupted',
];

function FanOutIllustration() {
  const followers = [22, 66, 110, 154, 198];
  return (
    <svg
      viewBox="0 0 220 180"
      role="img"
      aria-label="One master trader with five follower accounts mirroring their trades"
      className="w-full h-auto"
      style={{ maxWidth: 360 }}
    >
      {followers.map((x) => (
        <path
          key={x}
          d={`M110 46 C110 90, ${x} 90, ${x} 130`}
          fill="none"
          stroke="var(--mk-accent)"
          strokeWidth="1.5"
          strokeOpacity="0.6"
        />
      ))}
      <rect x="70" y="14" width="80" height="34" rx="9" fill="var(--mk-ink)" />
      <text x="110" y="35" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">
        MASTER
      </text>
      {followers.map((x, i) => (
        <g key={x}>
          <rect x={x - 18} y="128" width="36" height="30" rx="8" fill="var(--mk-surface-2)" stroke="var(--mk-accent)" strokeWidth="1.5" />
          <text x={x} y="147" textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--mk-ink)">
            {`F${i + 1}`}
          </text>
        </g>
      ))}
      <text x="110" y="174" textAnchor="middle" fontSize="8" fill="var(--mk-text-muted)">
        one trade opened → mirrored to every follower
      </text>
    </svg>
  );
}

export default function CopyTradingPage() {
  return (
    <main>
      <PageHero
        kicker="Copy trading"
        title="Follow the traders you trust"
        lead="Pick a master trader from the leaderboard, choose how much to allocate, and their trades are mirrored in your account automatically. Stop any time."
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'Try a free demo', href: '/auth/login' }}
      />

      <Section raised>
        <SectionHeading kicker="For followers" title="How it works" lead="Four steps from sign-up to your first mirrored trade." />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-12">
          {STEPS.map((s) => (
            <article key={s.step} className="mk-card mk-card--hover flex flex-col gap-3">
              <span
                className="font-extrabold"
                style={{ fontSize: 'var(--mk-text-h2)', color: 'var(--mk-accent)', lineHeight: 1 }}
              >
                {s.step}
              </span>
              <h3 className="mk-h3">{s.title}</h3>
              <p className="mk-body">{s.desc}</p>
            </article>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeading kicker="What you get" title="Built into your trading account" />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            { icon: Users,      title: 'A ranked leaderboard',    body: 'Master traders sorted by return %, number of followers or Sharpe ratio, so you can compare performance and consistency before you commit.' },
            { icon: Copy,       title: 'Automatic mirroring',     body: 'Every position the master opens or closes is copied to your account by the engine — no manual re-entry, no missed trades.' },
            { icon: Settings,   title: 'Your allocation',         body: 'You decide how much capital follows each master. Raise it, lower it or move it to another trader.' },
            { icon: Shield,     title: 'Stop at any time',        body: 'Unfollow with one click. Copying stops immediately and you keep full control of what is already open.' },
            { icon: BarChart2,  title: 'Everything in one terminal', body: 'Copied trades sit alongside your own in the positions panel, with balance, equity and margin always visible.' },
            { icon: HandCoins,  title: 'Performance fees, not subscriptions', body: 'Masters can charge a performance fee on the profit they make for you. No profit, no fee.' },
          ]}
        />
      </Section>

      <Section raised>
        <div className="mk-card">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="flex flex-col gap-4">
              <span className="mk-kicker">For master traders</span>
              <h2 className="mk-h2">Build a track record and get paid for it</h2>
              <ul className="flex flex-col gap-2.5">
                {MASTER_POINTS.map((item) => (
                  <li key={item} className="flex items-start gap-3 mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>
                    <Check size={16} className="shrink-0 mt-1" style={{ color: 'var(--mk-accent)' }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-3 mt-2">
                <Link href="/auth/register" className="mk-btn mk-btn--primary">
                  Open account
                  <TrendingUp size={16} />
                </Link>
                <Link href="/platforms/web" className="mk-btn mk-btn--ghost">See the terminal</Link>
              </div>
            </div>
            <div className="flex justify-center">
              <FanOutIllustration />
            </div>
          </div>
        </div>
      </Section>

      <Section className="mk-section--tight">
        <p
          className="mk-body mx-auto text-center"
          style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text-muted)', maxWidth: '70ch' }}
        >
          <strong>Risk warning:</strong> {RISK_LINE} Past performance of a master trader is not a
          guide to future results; copied trades can lose money.
        </p>
      </Section>

      <CtaBanner
        title="Start copying, or start leading"
        lead="Copy trading needs a live account. Open one in minutes, or explore the terminal first on a $10,000 demo."
        primary={{ label: 'Open account', href: '/auth/register' }}
        secondary={{ label: 'Try a free demo', href: '/auth/login' }}
      />
    </main>
  );
}
