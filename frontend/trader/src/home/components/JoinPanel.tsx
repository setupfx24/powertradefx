'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Section } from '@/marketing/components';
import { HOW_IT_WORKS, SIGNUP_HREF, DEMO_HREF } from '../data';
import { BRAND_NAME } from '@/lib/brand';

/**
 * "Join" panel — a tinted rounded panel: the numbered signup steps on the
 * left, the phone dashboard screenshot in a phone-sized frame on the right.
 *
 * Steps come from HOW_IT_WORKS so the homepage and the /how-it-works page
 * cannot drift apart.
 */
export function JoinPanel() {
  return (
    <Section>
      <div
        className="overflow-hidden"
        style={{
          background: 'var(--mk-bg-raised)',
          borderRadius: 'var(--mk-radius-lg)',
        }}
      >
        <div
          className="grid grid-cols-1 items-center lg:grid-cols-2"
          style={{ gap: 'var(--mk-space-7)', padding: 'clamp(1.75rem, 1rem + 3vw, 3.5rem)' }}
        >
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col"
            style={{ gap: 'var(--mk-space-5)' }}
          >
            <div className="flex flex-col" style={{ gap: 'var(--mk-space-2)' }}>
              <h2 className="mk-h2">Join {BRAND_NAME}</h2>
              <p className="mk-lead">Three steps from sign-up to your first trade.</p>
            </div>

            <ol className="flex flex-col" style={{ gap: 'var(--mk-space-4)' }}>
              {HOW_IT_WORKS.map(({ n, title, body }) => (
                <li key={n} className="flex items-start" style={{ gap: 'var(--mk-space-3)' }}>
                  <span
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-bold"
                    style={{
                      background: 'var(--mk-accent)',
                      color: '#fff',
                      fontSize: 'var(--mk-text-xs)',
                    }}
                    aria-hidden
                  >
                    {n}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-bold" style={{ fontSize: 'var(--mk-text-body)' }}>
                      {title}
                    </span>
                    <span className="mk-body block" style={{ fontSize: 'var(--mk-text-sm)' }}>
                      {body}
                    </span>
                  </span>
                </li>
              ))}
            </ol>

            <div className="flex flex-wrap items-center" style={{ gap: 'var(--mk-space-3)' }}>
              <Link href={SIGNUP_HREF} className="mk-btn mk-btn--primary">Open account</Link>
              <Link href={DEMO_HREF} className="mk-btn mk-btn--ghost">Try a free demo</Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
            className="flex justify-center"
          >
            {/* Phone-sized frame around the real phone dashboard shot. The
                frame is CSS only: an ink bezel with a rounded screen. */}
            <div
              className="overflow-hidden"
              style={{
                width: 'min(300px, 80vw)',
                padding: 10,
                borderRadius: 44,
                background: 'var(--mk-ink)',
                boxShadow: 'var(--mk-shadow-lift)',
              }}
            >
              <div className="overflow-hidden" style={{ borderRadius: 34 }}>
                <Image
                  src="/marketing/screens/dashboard-phone.png"
                  alt={`${BRAND_NAME} account dashboard on a phone: balance, equity and open positions`}
                  width={390}
                  height={844}
                  sizes="300px"
                  className="h-auto w-full"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </Section>
  );
}
