import { Syne, Sora } from 'next/font/google';

/**
 * Type faces for the portal design system.
 *
 * Declared here rather than in src/styles/fonts.ts so only the routes
 * that actually use the portal surface pay for them. Follows the
 * codebase convention of `next/font/google`, which self-hosts and
 * subsets the files instead of fetching gstatic at runtime.
 *
 *   - Syne 600-800 — wordmark and every heading
 *   - Sora 400-600 — all small type
 *
 * Apply `portalFontClass` to a wrapper element; portal.module.css binds
 * to the two CSS variables it exposes.
 */
export const portalDisplay = Syne({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--label-display',
  display: 'swap',
});

export const portalBody = Sora({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--label-body',
  display: 'swap',
});

export const portalFontClass = `${portalDisplay.variable} ${portalBody.variable}`;
