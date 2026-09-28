'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { Section, SectionHeading } from '@/marketing/components';
import { MarketArt } from './MarketArt';
import { INSTRUMENTS } from '../data';

/**
 * "All markets in one account" — the four asset groups on the platform,
 * each tile linking to its own landing page.
 *
 * Each tile carries a 4:3 art slot above the title. The art is an inline
 * SVG composition in brand colours (see MarketArt) rather than a bitmap,
 * so there is no asset to ship and it follows the theme tokens.
 */
export function MarketsGrid() {
  return (
    // tight-top: this section follows the full-bleed ticker strip, which
    // already separates it from the hero, so a full section-y on top reads
    // as dead space.
    <Section id="markets" className="mk-section--tight-top">
      <SectionHeading
        kicker="Markets"
        title="All markets in one account"
        lead="Forex, gold and metals, indices, energy and crypto — 40+ instruments on one terminal, with live bid, ask and spread in the watchlist."
      />

      <div className="mt-4 flex justify-center">
        <Link href="/markets" className="mk-link">
          See every instrument
          <ArrowUpRight size={15} />
        </Link>
      </div>

      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
        style={{ gap: 'var(--mk-space-5)', marginTop: 'var(--mk-space-7)' }}
      >
        {INSTRUMENTS.map(({ art, title, badge, body, href }, i) => (
          <motion.div
            key={title}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.05 * i }}
          >
            <Link href={href} className="mk-card mk-card--hover flex h-full flex-col gap-4">
              {/* Decorative: the heading below carries the meaning. */}
              <div
                className="relative w-full overflow-hidden"
                style={{ aspectRatio: '4 / 3', borderRadius: 'var(--mk-radius)' }}
              >
                <MarketArt kind={art} />
              </div>
              <div className="flex flex-col gap-2">
                <span
                  className="uppercase font-semibold"
                  style={{
                    fontSize: 'var(--mk-text-label)',
                    letterSpacing: 'var(--mk-tracking-label)',
                    color: 'var(--mk-accent)',
                  }}
                >
                  {badge}
                </span>
                <h3 className="mk-h3">{title}</h3>
                <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{body}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}
