'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Gauge, LineChart, Zap, type LucideIcon } from 'lucide-react';
import { LiveTickerBar } from './LiveTickerBar';
import { HERO, HERO_TRUST_PILLS, SIGNUP_HREF } from '../data';
import { BRAND_NAME } from '@/lib/brand';

/** Shared entrance transition; the global reduced-motion guard in
 *  marketing/tokens.css neutralises it for users who ask for that. */
const rise = (delay: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
});

/** Trust-pill icons, keyed by the lucide name used in data.ts. */
const pillIcons: Record<string, LucideIcon> = { Gauge, LineChart, Zap };

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* A single very faint neutral wash that stops the fold from being
          flat without competing with the screenshot below. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, var(--mk-bg-raised) 0%, var(--mk-bg) 62%)',
        }}
      />

      <div
        className="mk-container relative flex flex-col items-center text-center"
        style={{
          /* Clears the fixed 64px header with room to breathe underneath. */
          paddingTop: 'clamp(6.25rem, 4.25rem + 8vw, 9.75rem)',
          paddingBottom: 'var(--mk-space-8)',
          gap: 'var(--mk-space-5)',
        }}
      >
        <motion.span {...rise(0.05)} className="mk-kicker">
          <span className="relative inline-flex items-center justify-center" aria-hidden>
            <span
              className="absolute size-1.5 rounded-full animate-ping opacity-75"
              style={{ background: 'var(--mk-accent)' }}
            />
            <span className="relative size-1.5 rounded-full" style={{ background: 'var(--mk-accent)' }} />
          </span>
          {HERO.pill}
        </motion.span>

        {/* No measure cap on purpose — at the clamped display size the
            line fits the container and wraps on its own for phones. */}
        <motion.h1 {...rise(0.12)} className="mk-display" style={{ maxWidth: '22ch' }}>
          {HERO.headline}
        </motion.h1>

        <motion.p {...rise(0.2)} className="mk-lead" style={{ maxWidth: '56ch' }}>
          {HERO.sub}
        </motion.p>

        <motion.div
          {...rise(0.28)}
          className="flex flex-wrap items-center justify-center"
          style={{ gap: 'var(--mk-space-3)', paddingTop: 'var(--mk-space-2)' }}
        >
          <Link href={SIGNUP_HREF} className="mk-btn mk-btn--primary mk-btn--lg">
            {HERO.ctaPrimary}
            <ArrowUpRight size={16} />
          </Link>
          <Link href={HERO.ctaSecondaryHref} className="mk-btn mk-btn--ghost mk-btn--lg">
            {HERO.ctaSecondary}
          </Link>
        </motion.div>
      </div>

      {/* Product shot — a real screenshot of the web terminal, the fold's
          anchor. Runs wider than .mk-container's 1200px measure on its own
          1440px bound, keeping just the page gutter either side. */}
      <div
        className="relative mx-auto w-full"
        style={{
          maxWidth: '1440px',
          paddingInline: 'var(--mk-gutter)',
          paddingBottom: 'var(--mk-space-8)',
        }}
      >
        <motion.div
          {...rise(0.44)}
          className="overflow-hidden"
          style={{
            borderRadius: 'clamp(16px, 1.6vw, 28px)',
            border: '1px solid var(--mk-line)',
            boxShadow: 'var(--mk-shadow-lift)',
          }}
        >
          <Image
            src="/marketing/screens/terminal.png"
            alt={`${BRAND_NAME} web terminal showing a TradingView chart, watchlist, order ticket and open positions`}
            width={1600}
            height={1000}
            /* Above the fold, so it is the LCP candidate — preload it
               rather than letting it lazy-load. */
            priority
            sizes="(max-width: 1440px) 100vw, 1360px"
            className="h-auto w-full"
          />
        </motion.div>
      </div>

      {/* Three verified platform facts, before any scroll. The ticker
          strip below is a full-bleed divider in its own right, so the hero
          only needs to clear it. */}
      <div className="mk-container relative" style={{ paddingBottom: 'var(--mk-space-7)' }}>
        <motion.ul
          {...rise(0.5)}
          className="grid w-full grid-cols-1 gap-4 text-left sm:grid-cols-3"
        >
          {HERO_TRUST_PILLS.map(({ icon, label, sub }) => {
            const Icon = pillIcons[icon] ?? Zap;
            return (
              <li
                key={label}
                className="mk-card mk-card--outline flex items-start"
                style={{ gap: 'var(--mk-space-3)', padding: 'var(--mk-space-5)' }}
              >
                <span
                  className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
                  aria-hidden
                >
                  <Icon size={22} strokeWidth={2.25} />
                </span>
                <span className="min-w-0">
                  <span className="block font-bold" style={{ fontSize: 'var(--mk-text-sm)' }}>
                    {label}
                  </span>
                  <span
                    className="block"
                    style={{ fontSize: 'var(--mk-text-xs)', color: 'var(--mk-text-faint)', marginTop: 2 }}
                  >
                    {sub}
                  </span>
                </span>
              </li>
            );
          })}
        </motion.ul>
      </div>

      <p className="sr-only">
        {BRAND_NAME} — an online multi-asset broker. Trade forex, gold and
        metals, indices, oil and crypto from one account on a web terminal
        with TradingView charts.
      </p>

      {/* Real market data, straight from the TradingView tape. */}
      <LiveTickerBar />
    </section>
  );
}
