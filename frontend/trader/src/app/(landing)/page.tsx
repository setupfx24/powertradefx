'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight, Bot, CandlestickChart, Copy, LineChart, ShieldCheck, Timer, Wallet,
  UserPlus, Banknote,
} from 'lucide-react';
import { useLandingLang } from '@/components/landing/i18n';
import { MarketsTable } from '@/components/landing/LiveMarkets';
import dynamic from 'next/dynamic';

// Liquid-metal shader hero — WebGL canvas, client-only.
const LiquidHero = dynamic(() => import('@/components/hero/LiquidHero'), { ssr: false });
const ClarixShowcase = dynamic(() => import('@/components/landing/clarix/ClarixShowcase'), { ssr: false });

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
} as const;

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs uppercase tracking-[0.22em] font-semibold text-accent mb-3">
      {children}
    </p>
  );
}

export default function Home() {
  const { t } = useLandingLang();

  const features = [
    { icon: Timer, k: '1' }, { icon: LineChart, k: '2' }, { icon: Copy, k: '3' },
    { icon: Bot, k: '4' }, { icon: ShieldCheck, k: '5' }, { icon: CandlestickChart, k: '6' },
  ];

  const steps = [
    { icon: UserPlus, k: '1' },
    { icon: Banknote, k: '2' },
    { icon: CandlestickChart, k: '3' },
  ];

  return (
    <>
      <LiquidHero />


      {/* ── STEPS ────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-5 lg:px-8 py-20 lg:py-28">
        <motion.div {...fadeUp} className="max-w-2xl">
          <Eyebrow>PowerTradeFX</Eyebrow>
          <h2 className="font-display font-bold text-white text-3xl sm:text-4xl mb-4">
            {t('steps.title')}
          </h2>
        </motion.div>
        <div className="grid sm:grid-cols-3 gap-5 mt-10">
          {steps.map(({ icon: Icon, k }, i) => (
            <motion.div
              key={k}
              {...fadeUp}
              transition={{ ...fadeUp.transition, delay: i * 0.12 }}
              className={`rounded-2xl p-7 ${i === 2 ? 'lx-card-hot' : 'lx-card'}`}
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${
                i === 2 ? 'bg-white/15' : 'bg-accent/10'
              }`}>
                <Icon className={`w-6 h-6 ${i === 2 ? 'text-white' : 'text-accent'}`} />
              </div>
              <p className={`text-xs font-mono mb-2 ${i === 2 ? 'text-white/70' : 'text-gray-500'}`}>
                0{i + 1}
              </p>
              <h3 className="font-display font-semibold text-white text-lg mb-2">
                {t(`steps.${k}.t`)}
              </h3>
              <p className={`text-sm leading-relaxed ${i === 2 ? 'text-white/80' : 'text-gray-400'}`}>
                {t(`steps.${k}.d`)}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      <ClarixShowcase />

      {/* ── FEATURES ─────────────────────────────────────────────── */}
      <section id="features" className="border-t border-white/5 bg-black/20">
        <div className="max-w-7xl mx-auto px-5 lg:px-8 py-20 lg:py-28">
          <motion.div {...fadeUp} className="max-w-2xl mb-12">
            <Eyebrow>{t('feat.eyebrow')}</Eyebrow>
            <h2 className="font-display font-bold text-white text-3xl sm:text-4xl">
              {t('feat.title')}
            </h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(({ icon: Icon, k }, i) => (
              <motion.div
                key={k}
                {...fadeUp}
                transition={{ ...fadeUp.transition, delay: (i % 3) * 0.1 }}
                className="lx-card rounded-2xl p-6 hover:border-accent/30 transition-colors group"
              >
                <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center mb-4 group-hover:bg-accent/20 transition-colors">
                  <Icon className="w-5 h-5 text-accent" />
                </div>
                <h3 className="font-display font-semibold text-white mb-1.5">{t(`feat.${k}.t`)}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{t(`feat.${k}.d`)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── LIVE MARKETS ─────────────────────────────────────────── */}
      <section id="markets" className="max-w-7xl mx-auto px-5 lg:px-8 py-20 lg:py-28">
        <motion.div {...fadeUp} className="max-w-2xl mb-10">
          <Eyebrow>{t('mkt.eyebrow')}</Eyebrow>
          <h2 className="font-display font-bold text-white text-3xl sm:text-4xl">{t('mkt.title')}</h2>
        </motion.div>
        <motion.div {...fadeUp}>
          <MarketsTable />
        </motion.div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-t border-white/5">
        <div className="max-w-4xl mx-auto px-5 lg:px-8 py-20 lg:py-28 text-center relative">
          <motion.div {...fadeUp}>
            <div className="mx-auto w-14 h-14 mb-6">
              <svg viewBox="0 0 32 32" aria-hidden="true" className="w-14 h-14 lx-pulse rounded-[14px]">
                <rect width="32" height="32" rx="7" className="fill-accent" />
                <path fillRule="evenodd" d="M11 6.5 H19.2 C23.3 6.5 26.2 9.3 26.2 13.2 C26.2 17.1 23.3 19.9 19.2 19.9 H15.2 V25.5 H11 Z M15.2 10.2 V16.2 H18.9 C20.9 16.2 22 15 22 13.2 C22 11.4 20.9 10.2 18.9 10.2 Z" fill="#ffffff" />
              </svg>
            </div>
            <h2 className="font-display font-bold text-white text-3xl sm:text-5xl mb-4">
              {t('cta.title')}
            </h2>
            <p className="text-gray-400 text-base sm:text-lg mb-9 max-w-xl mx-auto">{t('cta.sub')}</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/auth/register"
                className="lx-cta inline-flex items-center gap-2 text-white font-semibold px-8 py-4 rounded-xl hover:brightness-110 transition"
              >
                <Wallet className="w-4 h-4" />
                {t('nav.open')}
              </Link>
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 text-gray-200 font-semibold px-8 py-4 rounded-xl border border-white/15 hover:border-accent/60 transition"
              >
                {t('nav.signin')}
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
