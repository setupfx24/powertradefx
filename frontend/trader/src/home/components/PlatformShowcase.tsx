'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowUpRight, Bot, Check, Globe2, Users, type LucideIcon } from 'lucide-react';
import { Section } from '@/marketing/components';
import { PLATFORM_FEATURES, PLATFORMS, DEMO_HREF } from '../data';
import { BRAND_NAME } from '@/lib/brand';

const platformIcons: Record<string, LucideIcon> = { Globe2, Bot, Users };

/**
 * Platform showcase — two-column band: the light-theme terminal
 * screenshot on the left, a headline plus ticked capability list and a
 * CTA on the right. A three-card strip underneath points at the other
 * ways to trade (AI & algo, copy trading & PAMM).
 */
export function PlatformShowcase() {
  return (
    <Section id="platforms">
      <div
        className="grid grid-cols-1 items-center lg:grid-cols-2"
        style={{ gap: 'var(--mk-space-8)' }}
      >
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        >
          <div
            className="overflow-hidden"
            style={{
              borderRadius: 'clamp(12px, 1.2vw, 20px)',
              border: '1px solid var(--mk-line)',
              boxShadow: 'var(--mk-shadow-card)',
            }}
          >
            <Image
              src="/marketing/screens/terminal-light.png"
              alt={`${BRAND_NAME} web terminal in the light theme, with the chart, order ticket and positions panel`}
              width={1600}
              height={1000}
              sizes="(max-width: 1024px) 100vw, 560px"
              className="h-auto w-full"
            />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
          className="flex flex-col"
          style={{ gap: 'var(--mk-space-5)' }}
        >
          <span className="mk-kicker">Web terminal</span>
          <h2 className="mk-h2">A terminal that runs in your browser</h2>

          <ul className="flex flex-col" style={{ gap: 'var(--mk-space-3)' }}>
            {PLATFORM_FEATURES.map((feature) => (
              <li key={feature} className="flex items-start" style={{ gap: 'var(--mk-space-3)' }}>
                <span
                  className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                  style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
                  aria-hidden
                >
                  <Check size={13} strokeWidth={3} />
                </span>
                <span className="mk-body" style={{ color: 'var(--mk-text)' }}>{feature}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-wrap items-center" style={{ gap: 'var(--mk-space-3)' }}>
            <Link href="/platforms/web" className="mk-btn mk-btn--primary">Explore the terminal</Link>
            <Link href={DEMO_HREF} className="mk-btn mk-btn--ghost">Try a free demo</Link>
          </div>
        </motion.div>
      </div>

      {/* The other ways to trade — one card each, linking to its page. */}
      <div
        className="grid grid-cols-1 md:grid-cols-3"
        style={{ gap: 'var(--mk-space-5)', marginTop: 'var(--mk-space-8)' }}
      >
        {PLATFORMS.map(({ icon, title, body, href }, i) => {
          const Icon = platformIcons[icon] ?? Globe2;
          return (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.06 * i }}
            >
              <Link href={href} className="mk-card mk-card--hover flex h-full flex-col" style={{ gap: 'var(--mk-space-3)' }}>
                <span
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
                  aria-hidden
                >
                  <Icon size={22} strokeWidth={2.25} />
                </span>
                <h3 className="mk-h3">{title}</h3>
                <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{body}</p>
                <span className="mk-link" style={{ marginTop: 'auto', paddingTop: 'var(--mk-space-2)' }}>
                  Learn more
                  <ArrowUpRight size={15} />
                </span>
              </Link>
            </motion.div>
          );
        })}
      </div>
    </Section>
  );
}
