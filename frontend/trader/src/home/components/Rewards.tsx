'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { Section, SectionHeading } from '@/marketing/components';
import { MarketArt } from './MarketArt';
import { REWARDS, SIGNUP_HREF } from '../data';

/**
 * Earn-more band — two large art-led cards: copy trading and the IB
 * programme, the two ways to earn on the platform beyond your own trading.
 *
 * The art slot is deliberately large (16:10) rather than a thumbnail; it
 * holds an inline SVG composition from MarketArt. The grid only splits
 * into two columns when REWARDS actually holds more than one entry — one
 * card in a half-width column reads as a layout bug.
 */
export function Rewards() {
  return (
    <Section raised>
      <SectionHeading
        kicker="Earn more"
        title="Copy the best, or earn from your network"
        lead="Mirror a master trader's positions with an allocation you choose, or share your referral link and earn a per-lot commission on every trade your clients place."
      />

      <div
        className={`mx-auto grid grid-cols-1 ${
          REWARDS.length > 1 ? 'md:grid-cols-2' : 'max-w-2xl'
        }`}
        style={{ gap: 'var(--mk-space-5)', marginTop: 'var(--mk-space-7)' }}
      >
        {REWARDS.map(({ art, title, body, href }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.08 * i }}
          >
            <Link href={href} className="mk-card mk-card--hover flex h-full flex-col gap-5">
              {/* Decorative: the heading below carries the meaning. */}
              <div
                className="relative w-full overflow-hidden"
                style={{ aspectRatio: '16 / 10', borderRadius: 'var(--mk-radius)' }}
              >
                <MarketArt kind={art} />
              </div>
              <div className="flex flex-col gap-2">
                <h3 className="mk-h3">{title}</h3>
                <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{body}</p>
                <span className="mk-link" style={{ marginTop: 'var(--mk-space-2)' }}>
                  Learn more
                  <ArrowUpRight size={15} />
                </span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      <div
        className="flex flex-wrap items-center justify-center"
        style={{ gap: 'var(--mk-space-3)', marginTop: 'var(--mk-space-7)' }}
      >
        <Link href={SIGNUP_HREF} className="mk-btn mk-btn--primary">Open account</Link>
        <Link href="/how-it-works" className="mk-btn mk-btn--ghost">See how it works</Link>
      </div>
    </Section>
  );
}
