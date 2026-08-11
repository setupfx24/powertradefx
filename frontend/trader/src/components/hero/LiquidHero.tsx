'use client';

/**
 * LiquidHero — home-page hero: the liquid-metal shader hero from
 * components/ui plus the landing top bar (the landing layout hides
 * LandingNav on "/", so the hero owns its own chrome).
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import LiquidMetalHero from '@/components/ui/liquid-metal-hero';

export default function LiquidHero() {
  const router = useRouter();

  return (
    <div className="relative">
      <header className="absolute top-0 inset-x-0 z-30 flex items-center gap-6 h-[62px] px-5 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5 font-extrabold text-[17px] text-white" aria-label="PowerTradeFX home">
          <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
            <rect width="32" height="32" rx="7" className="fill-accent" />
            <path fillRule="evenodd" d="M11 6.5 H19.2 C23.3 6.5 26.2 9.3 26.2 13.2 C26.2 17.1 23.3 19.9 19.2 19.9 H15.2 V25.5 H11 Z M15.2 10.2 V16.2 H18.9 C20.9 16.2 22 15 22 13.2 C22 11.4 20.9 10.2 18.9 10.2 Z" style={{ fill: 'var(--hero-metal-back)' }} />
          </svg>
          <span>PowerTrade<em className="not-italic text-accent">FX</em></span>
        </Link>
        <nav className="hidden lg:flex gap-5 ml-4" aria-label="Primary">
          <Link href="/#markets" className="text-sm font-semibold text-white/60 hover:text-white transition-colors">Markets</Link>
          <Link href="/#features" className="text-sm font-semibold text-white/60 hover:text-white transition-colors">Platform</Link>
          <Link href="/contact" className="text-sm font-semibold text-white/60 hover:text-white transition-colors">Contact</Link>
        </nav>
        <div className="ml-auto flex items-center gap-4">
          <Link href="/auth/login" className="text-sm font-semibold text-white">Sign in</Link>
          <Link href="/auth/register" className="bg-accent hover:bg-accent-hover transition-colors text-white text-sm font-bold rounded-xl px-5 py-2.5">
            Open account
          </Link>
        </div>
      </header>

      <LiquidMetalHero
        badge="PowerTradeFX · Multi-asset trading"
        title="Trade the world's markets"
        subtitle="FX, metals, indices and crypto CFDs on one fast platform — tight spreads, instant execution and a professional web terminal."
        primaryCtaLabel="Open account"
        secondaryCtaLabel="View live markets"
        onPrimaryCtaClick={() => router.push('/auth/register')}
        onSecondaryCtaClick={() => router.push('/#markets')}
        features={['Tight raw spreads', 'Instant execution', 'Pro web terminal']}
      />
    </div>
  );
}
