'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Users, Zap, Wallet, CheckCircle2, Link2, Gift } from 'lucide-react';
import {
  Section, SectionHeading, PageHero, FeatureGrid, CtaBanner, FaqAccordion,
} from '@/marketing/components';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Products → Refer a friend. PowerTradeFX's own referral programme for
 * traders: share your link or code, and earn a reward when a friend
 * signs up and qualifies. The ladder and the qualification rules are
 * read from the live engine so the page never drifts from what pays.
 */

const SIGNUP_HREF = '/auth/register';

/** Wire shape from /api/v1/referral/tiers — only the fields this page
 *  renders. Admin owns the data in /config/referral-tiers
 *  (system_settings.referral_tiers).
 *
 *  These names must match the API exactly. The referral ladder used to share
 *  the IB key and shipped `per_lot` / `min_activations`; when it moved to its
 *  own key those became `per_referral_bounty` / `min_referrals`, but this type
 *  wasn't updated — every field read `undefined`, so the table rendered "$0"
 *  and a "1-1" range regardless of what admin configured. (fixed 2026-07-20) */
type ApiTier = {
  label: string;
  per_referral_bounty: number;
  min_referrals: number;
  max_referrals: number | null;
  instant_payout: boolean;
};

type DisplayTier = {
  label: string;        // "Bronze"
  perLot: string;       // reward shown in the table, e.g. "$5"
  requirement: string;  // "5+ activations"
  range: string;        // activation count range shown in the header, e.g. "1-20", "101+"
};

/** Qualification conditions surfaced under the table. The server enforces
 *  these in referral_service.maybe_pay_referral_after_trades — this is
 *  what the page renders so the copy always matches the live engine. */
type Qualification = {
  requires_kyc: boolean;
  requires_funded_account: boolean;
  required_trades: number;
};

const DEFAULT_QUALIFICATION: Qualification = {
  requires_kyc: true,
  requires_funded_account: true,
  required_trades: 3,
};

/** Fallback shown while the API is loading or empty, so a fresh install
 *  still renders the ladder rather than going blank. */
const FALLBACK_TIERS: DisplayTier[] = [
  { label: 'Bronze', perLot: '$5',  requirement: '5+ activations',  range: '1-20' },
  { label: 'Silver', perLot: '$7',  requirement: '20+ activations', range: '21-100' },
  { label: 'Gold',   perLot: '$10', requirement: '50+ activations', range: '101+' },
];

const fmtUsd = (n: number) => `$${(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

function adaptApi(t: ApiTier): DisplayTier {
  const lo = t.min_referrals > 0 ? t.min_referrals : 1;
  return {
    label: t.label,
    perLot: fmtUsd(t.per_referral_bounty || 0),
    requirement: `${lo}+ activations`,
    range: `${lo}+`, // refined in buildTiers once max / neighbours are known
  };
}

/** Turn a sorted list of API tiers into display rows whose activation header
 *  reads as a range ("1-20", "21-100", … last "+"). Prefer the tier's own
 *  max_referrals (admin sets it explicitly); fall back to one below the next
 *  tier's threshold when max is open-ended but a higher tier exists. */
function buildTiers(apiTiers: ApiTier[]): DisplayTier[] {
  return apiTiers.map((t, i) => {
    const d = adaptApi(t);
    const lo = t.min_referrals > 0 ? t.min_referrals : 1;
    const next = apiTiers[i + 1];
    const hi = t.max_referrals ?? (next ? (next.min_referrals || lo) - 1 : null);
    d.range = hi != null ? `${lo}-${Math.max(lo, hi)}` : `${lo}+`;
    return d;
  });
}

/** Comma-join with " and " before the last element so the activation
 *  sentence reads naturally for 1, 2, or 3 conditions. */
function joinClauses(parts: string[]): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

/** Inline "share card" illustration: a referral link, a code and the
 *  friend who signs up through it. Decorative. */
function ShareCard() {
  return (
    <svg viewBox="0 0 560 370" aria-hidden className="w-full h-auto" style={{ borderRadius: 'var(--mk-radius-lg)', display: 'block' }}>
      <rect x="0" y="0" width="560" height="370" fill="var(--mk-surface-2)" />
      {/* link card */}
      <rect x="40" y="40" width="480" height="120" rx="14" fill="var(--mk-bg)" stroke="var(--mk-line)" />
      <text x="64" y="72" fill="var(--mk-text-faint)" fontSize="11" fontFamily="var(--mk-font-mono)" letterSpacing="1">YOUR REFERRAL LINK</text>
      <rect x="64" y="86" width="312" height="40" rx="8" fill="var(--mk-surface)" />
      <text x="80" y="111" fill="var(--mk-text)" fontSize="13" fontFamily="var(--mk-font-mono)">powertradefx.com/s/YOURCODE</text>
      <rect x="388" y="86" width="108" height="40" rx="8" fill="var(--mk-accent)" />
      <text x="442" y="111" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="700" fontFamily="var(--mk-font-mono)">COPY</text>
      {/* arrow */}
      <line x1="280" y1="176" x2="280" y2="214" stroke="var(--mk-line-strong)" strokeWidth="2" strokeDasharray="4 4" />
      <polygon points="272,212 288,212 280,224" fill="var(--mk-line-strong)" />
      {/* sign-up card */}
      <rect x="120" y="236" width="320" height="96" rx="14" fill="var(--mk-bg)" stroke="var(--mk-line)" />
      <circle cx="160" cy="284" r="20" fill="var(--mk-ink)" />
      <text x="160" y="289" textAnchor="middle" fill="#ffffff" fontSize="12" fontWeight="700" fontFamily="var(--mk-font-mono)">A</text>
      <text x="196" y="276" fill="var(--mk-text)" fontSize="13" fontWeight="700">Your friend signs up</text>
      <text x="196" y="298" fill="var(--mk-text-muted)" fontSize="11" fontFamily="var(--mk-font-mono)">referral code: YOURCODE</text>
      <rect x="352" y="270" width="68" height="26" rx="13" fill="var(--mk-accent-soft)" stroke="var(--mk-accent-line)" />
      <text x="386" y="287" textAnchor="middle" fill="var(--mk-accent)" fontSize="10" fontWeight="700" fontFamily="var(--mk-font-mono)">LINKED</text>
    </svg>
  );
}

export default function ReferralPage() {
  // Admin-managed tiers + qualification gates. Both fall back to the
  // documented defaults if the API is unreachable so the page never goes
  // blank or out of sync with the engine on first deploy.
  const [tiers, setTiers] = useState<DisplayTier[]>(FALLBACK_TIERS);
  const [qual, setQual] = useState<Qualification>(DEFAULT_QUALIFICATION);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/v1/referral/tiers', { credentials: 'omit' });
        if (!res.ok) return;
        const data: {
          tiers?: ApiTier[];
          qualification?: Partial<Qualification>;
        } = await res.json();
        if (cancelled) return;
        const list = buildTiers(data.tiers || []);
        if (list.length > 0) setTiers(list);
        if (data.qualification) {
          setQual({
            requires_kyc: data.qualification.requires_kyc ?? DEFAULT_QUALIFICATION.requires_kyc,
            requires_funded_account:
              data.qualification.requires_funded_account ?? DEFAULT_QUALIFICATION.requires_funded_account,
            required_trades:
              data.qualification.required_trades ?? DEFAULT_QUALIFICATION.required_trades,
          });
        }
      } catch {
        /* keep fallback — public marketing page must never error out */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Compose the activation copy from the live gates so the card stays
  // accurate when KYC / funded are switched off for a promotion. Always
  // lists "signs up via your referral link" — that's structural, not a toggle.
  const activationBits: string[] = ['signs up through your referral link or code'];
  if (qual.requires_kyc) activationBits.push('completes KYC verification');
  if (qual.requires_funded_account) activationBits.push('funds a live account');
  const activationSentence = `Your friend ${joinClauses(activationBits)}.`;
  const tradesTitle = `Minimum ${qual.required_trades} trade${qual.required_trades === 1 ? '' : 's'}`;
  const tradesBody = `Your friend places at least ${qual.required_trades} trade${qual.required_trades === 1 ? '' : 's'} after activation. When the ${ordinal(qual.required_trades)} trade closes, your reward is credited to your account.`;

  return (
    <main>
      <PageHero
        kicker="Refer a friend"
        title="Share your link. Earn when they trade."
        lead={`Every ${BRAND_NAME} account comes with a personal referral link and code. When a friend signs up through it and starts trading, you earn a reward, credited straight to your account.`}
        primary={{ label: 'Open account', href: SIGNUP_HREF }}
        secondary={{ label: 'See the rewards', href: '#tiers' }}
      />

      {/* Intro */}
      <Section raised>
        <div className="grid lg:grid-cols-[1.2fr_1fr] gap-8 items-center">
          <div className="flex flex-col gap-4 items-start">
            <span className="mk-kicker">How it works</span>
            <h2 className="mk-h2">
              Share. They trade. <span style={{ color: 'var(--mk-accent)' }}>You are rewarded.</span>
            </h2>
            <p className="mk-lead">
              Copy your link from the platform or give a friend your code to enter on the sign-up page. Once they
              activate and meet the trade threshold, the reward is credited to you automatically. No forms, no claims.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href={SIGNUP_HREF} className="mk-btn mk-btn--primary">Open account</Link>
              <Link href="/auth/login" className="mk-btn mk-btn--ghost">Sign in to get your link</Link>
            </div>
          </div>
          <ShareCard />
        </div>
      </Section>

      {/* Reward ladder */}
      <Section id="tiers">
        <SectionHeading
          kicker="Rewards"
          title="Rewards that grow with your referrals"
          lead="The more friends who activate, the higher your reward for each new one. You move up the ladder automatically."
        />

        <div className="overflow-x-auto mt-12">
          <div
            className="min-w-[560px] overflow-hidden"
            style={{ border: '1px solid var(--mk-line)', borderRadius: 'var(--mk-radius)' }}
          >
            <table className="w-full" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th
                    className="px-5 py-4 text-left"
                    style={{
                      background: 'var(--mk-surface)',
                      borderRight: '1px solid var(--mk-line)',
                      fontSize: 'var(--mk-text-label)',
                      letterSpacing: 'var(--mk-tracking-label)',
                      textTransform: 'uppercase',
                      color: 'var(--mk-text-faint)',
                    }}
                  >
                    Activations
                  </th>
                  {tiers.map((t, i) => {
                    const top = i === tiers.length - 1;
                    return (
                      <th
                        key={`${t.label}-${i}`}
                        className="px-5 py-4 text-center font-bold"
                        style={{
                          background: top ? 'var(--mk-accent)' : 'var(--mk-surface-2)',
                          color: top ? '#fff' : 'var(--mk-text)',
                          borderRight: i < tiers.length - 1 ? '1px solid var(--mk-line)' : undefined,
                          fontSize: 'var(--mk-text-sm)',
                          letterSpacing: 'var(--mk-tracking-label)',
                          textTransform: 'uppercase',
                        }}
                      >
                        {t.range}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {/* Reward row */}
                <tr style={{ borderTop: '1px solid var(--mk-line)' }}>
                  <td
                    className="px-5 py-4"
                    style={{
                      background: 'var(--mk-surface)',
                      borderRight: '1px solid var(--mk-line)',
                      fontSize: 'var(--mk-text-sm)',
                      color: 'var(--mk-text-muted)',
                    }}
                  >
                    Reward per activation
                  </td>
                  {tiers.map((t, i) => {
                    const top = i === tiers.length - 1;
                    return (
                      <td
                        key={`perlot-${i}`}
                        className="px-5 py-4 text-center font-bold"
                        style={{
                          background: top ? 'var(--mk-accent-soft)' : 'var(--mk-bg-raised)',
                          color: top ? 'var(--mk-accent)' : 'var(--mk-text)',
                          borderRight: i < tiers.length - 1 ? '1px solid var(--mk-line)' : undefined,
                          fontSize: 'var(--mk-text-sm)',
                        }}
                      >
                        {t.perLot}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <p
          className="mt-6 text-center mx-auto max-w-2xl"
          style={{ fontSize: 'var(--mk-text-xs)', lineHeight: 'var(--mk-leading-body)', color: 'var(--mk-text-faint)' }}
        >
          You earn the reward of the highest tier you have reached; a tier unlocks once your activations cross its
          threshold. An activation is a friend who completes the conditions below. Rewards and thresholds are set by{' '}
          {BRAND_NAME} and may change; the figures shown are the current ones.
        </p>
      </Section>

      {/* Qualification */}
      <Section raised>
        <SectionHeading
          kicker="Conditions"
          title="When a referral counts"
          lead="Two things have to happen before a reward is released."
        />
        <ol className="grid sm:grid-cols-2 gap-5 mt-12 mx-auto max-w-3xl">
          {[
            { n: '1', title: 'Activation',  body: activationSentence },
            { n: '2', title: tradesTitle,   body: tradesBody },
          ].map((t) => (
            <li key={t.n} className="mk-card mk-card--hover flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span
                  className="font-extrabold"
                  style={{ fontSize: 'var(--mk-text-h2)', color: 'var(--mk-accent)', lineHeight: 1 }}
                >
                  {t.n}
                </span>
                <CheckCircle2 size={20} style={{ color: 'var(--mk-accent)' }} aria-hidden />
              </div>
              <h3 className="mk-h3">{t.title}</h3>
              <p className="mk-body">{t.body}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Why refer */}
      <Section>
        <SectionHeading kicker="Why refer" title={`Refer a friend to ${BRAND_NAME}`} />
        <FeatureGrid
          className="mt-12"
          columns={3}
          items={[
            { icon: Link2,  title: 'Link and code, ready now',   body: 'Your referral link and code are in your account from day one. Share the link, or let a friend type the code on the sign-up page.' },
            { icon: Zap,    title: 'Credited automatically',     body: 'No claim to file. When a friend meets the conditions, the reward lands in your account.' },
            { icon: Users,  title: 'No limit on friends',        body: 'Refer as many people as you like. Each activation counts, and your tier only moves up.' },
            { icon: Gift,   title: 'Something for them too',     body: 'Your friend gets the same platform you use: a free $10,000 demo in one click, then a live account when they are ready.' },
            { icon: Wallet, title: 'Shows up in your history',   body: 'Each reward is credited to your account and listed in your wallet transaction history.' },
            { icon: CheckCircle2, title: 'Grow into an IB',      body: 'Bringing in a lot of traders? The IB programme pays a per-lot commission on every trade in your network.' },
          ]}
        />
      </Section>

      {/* FAQ */}
      <Section raised id="faq">
        <SectionHeading kicker="Questions" title="Referral FAQ" />
        <div className="mt-12 mx-auto max-w-3xl">
          <FaqAccordion
            items={[
              {
                q: 'Where do I find my referral link?',
                a: <>Sign in; your referral link and code are shown in your account, ready to copy. A friend can also enter the code in the referral field on the sign-up page.</>,
              },
              {
                q: 'When is the reward paid?',
                a: <>As soon as your friend has activated and closed the required number of trades, the reward is credited to your account automatically.</>,
              },
              {
                q: 'What counts as an activation?',
                a: <>A friend who signs up through your link or code and meets the conditions listed above, currently including the trade threshold. Only live-account trades count; demo trades do not.</>,
              },
              {
                q: 'Can I refer myself or a second account of my own?',
                a: <>No. Referrals are for other people. Self-referrals are not credited.</>,
              },
              {
                q: 'What is the difference between this and the IB programme?',
                a: <>Refer a friend pays a one-time reward per qualifying friend. The <Link href="/products/ib-referral" className="underline underline-offset-2">IB programme</Link> pays a per-lot commission on every trade your network places, for as long as they trade. If you plan to bring in many traders, apply for the IB programme from the Business page in the platform.</>,
              },
            ]}
          />
        </div>
      </Section>

      <CtaBanner
        title="Get your referral link"
        lead={`Open a ${BRAND_NAME} account and your link and code are ready to share the same minute.`}
        primary={{ label: 'Open account', href: SIGNUP_HREF }}
        secondary={{ label: 'Sign in', href: '/auth/login' }}
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
