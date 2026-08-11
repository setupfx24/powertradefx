'use client';

/**
 * LiquidMetalHero — full-screen hero over a flowing liquid-metal shader
 * (@paper-design/shaders-react). Ported from a shadcn/ui community
 * component and adapted to this codebase: the shadcn Button/Badge/Card
 * primitives are replaced with token-styled elements (this project has
 * its own design system — no foreground/background theme keys), and the
 * shader colors are read from the brand tokens in globals.css at mount
 * so no hex lives in TSX.
 *
 * Motion runs unconditionally — client machines have OS animations off,
 * so nothing here may gate on prefers-reduced-motion.
 */

import { useEffect, useState } from 'react';
import { LiquidMetal, liquidMetalPresets } from '@paper-design/shaders-react';
import { motion } from 'framer-motion';

interface LiquidMetalHeroProps {
  badge?: string;
  title: string;
  subtitle: string;
  primaryCtaLabel: string;
  secondaryCtaLabel?: string;
  onPrimaryCtaClick: () => void;
  onSecondaryCtaClick?: () => void;
  features?: string[];
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { delayChildren: 0.2, staggerChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 },
};

const buttonVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1 },
};

/** "Backdrop" preset params with brand-token colors swapped in. */
function useShaderParams() {
  const [colors, setColors] = useState<{ back: string; tint: string } | null>(null);
  useEffect(() => {
    const css = getComputedStyle(document.documentElement);
    const back = css.getPropertyValue('--hero-metal-back').trim();
    const tint = css.getPropertyValue('--hero-metal-tint').trim();
    if (back && tint) setColors({ back, tint });
  }, []);
  const preset = liquidMetalPresets.find((p) => p.name === 'Backdrop') ?? liquidMetalPresets[0];
  if (!colors || !preset) return null;
  return { ...preset.params, colorBack: colors.back, colorTint: colors.tint };
}

export default function LiquidMetalHero({
  badge,
  title,
  subtitle,
  primaryCtaLabel,
  secondaryCtaLabel,
  onPrimaryCtaClick,
  onSecondaryCtaClick,
  features = [],
}: LiquidMetalHeroProps) {
  const shader = useShaderParams();

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[var(--hero-metal-back)]">
      {shader && (
        <LiquidMetal {...shader} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />
      )}
      {/* legibility veil over the shader */}
      <div
        className="absolute inset-0 z-[1] pointer-events-none"
        style={{ background: 'radial-gradient(70% 60% at 50% 45%, rgba(0,0,0,.36), rgba(0,0,0,.62))' }}
        aria-hidden="true"
      />

      <div className="relative z-10 container mx-auto px-6 lg:px-8 max-w-7xl py-28">
        <motion.div
          className="text-center space-y-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {badge && (
            <motion.div className="flex justify-center" variants={itemVariants}>
              <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 backdrop-blur-sm px-4 py-1.5 text-xs font-semibold tracking-wide text-white">
                {badge}
              </span>
            </motion.div>
          )}

          <motion.div className="space-y-6" variants={itemVariants}>
            <motion.h1
              className="text-5xl sm:text-6xl lg:text-7xl xl:text-8xl font-bold text-white leading-tight tracking-tight"
              variants={itemVariants}
            >
              {title}
            </motion.h1>

            <motion.p
              className="max-w-3xl mx-auto text-xl sm:text-2xl text-white/85 leading-relaxed"
              variants={itemVariants}
            >
              {subtitle}
            </motion.p>
          </motion.div>

          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            variants={buttonVariants}
          >
            <motion.button
              type="button"
              onClick={onPrimaryCtaClick}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-accent text-white hover:bg-accent-hover transition-colors duration-300 shadow-2xl text-lg px-8 py-4 font-semibold rounded-xl"
            >
              {primaryCtaLabel}
            </motion.button>

            {secondaryCtaLabel && onSecondaryCtaClick && (
              <motion.button
                type="button"
                onClick={onSecondaryCtaClick}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="border border-white/30 text-white hover:bg-white/10 hover:border-white/50 transition-all duration-300 backdrop-blur-sm text-lg px-8 py-4 font-semibold rounded-xl"
              >
                {secondaryCtaLabel}
              </motion.button>
            )}
          </motion.div>

          {features.length > 0 && (
            <motion.div className="pt-12" variants={itemVariants}>
              <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.3 }}>
                <div className="rounded-2xl border border-white/15 bg-white/10 backdrop-blur-md shadow-2xl">
                  <div className="p-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {features.map((feature, index) => (
                        <motion.div
                          key={feature}
                          className="flex items-center justify-center text-center"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.6, delay: 0.8 + index * 0.1 }}
                        >
                          <p className="text-white/90 font-medium text-lg">{feature}</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </section>
  );
}
