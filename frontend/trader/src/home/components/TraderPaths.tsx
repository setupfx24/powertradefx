'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import { Section, SectionHeading } from '@/marketing/components';
import { MarketArt } from './MarketArt';
import { TRADER_PATHS } from '../data';

/**
 * "Everything you need to trade" — split into two audience columns
 * (traders and partners), each with an inline art panel above a short
 * list of deep links.
 *
 * The art panels are 3:2 inline SVG compositions from MarketArt, so the
 * two columns always line up and nothing has to be shipped as a bitmap.
 */
export function TraderPaths() {
  return (
    <Section raised>
      <SectionHeading
        title="Everything you need to trade — or to partner with us"
        lead="One login for your accounts, wallet, terminal and partner dashboard."
      />

      <div
        className="grid grid-cols-1 md:grid-cols-2"
        style={{ gap: 'var(--mk-space-7)', marginTop: 'var(--mk-space-7)' }}
      >
        {TRADER_PATHS.map(({ heading, art, links }, i) => (
          <motion.div
            key={heading}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.08 * i }}
            className="flex flex-col"
            style={{ gap: 'var(--mk-space-4)' }}
          >
            <h3 className="mk-h3">{heading}</h3>
            {/* Decorative: the heading above and the link list below carry
                the meaning. */}
            <div
              className="overflow-hidden"
              style={{
                aspectRatio: '3 / 2',
                borderRadius: 'clamp(12px, 1.2vw, 20px)',
                border: '1px solid var(--mk-line)',
              }}
            >
              <MarketArt kind={art} />
            </div>
            <ul className="flex flex-col" style={{ gap: 'var(--mk-space-2)' }}>
              {links.map(({ label, href }) => (
                <li key={href}>
                  <Link href={href} className="mk-link">
                    {label}
                    <ArrowUpRight size={14} />
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}
