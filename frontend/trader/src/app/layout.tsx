import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Suspense } from 'react';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AuthProvider } from '@/components/providers/AuthProvider';
import GoogleAuthProvider from '@/components/providers/GoogleAuthProvider';
import NotificationListener from '@/components/NotificationListener';
import ProfileCompleteGate from '@/components/profile/ProfileCompleteGate';
import OnboardingGate from '@/components/auth/OnboardingGate';
import TopLoader from '@/components/TopLoader';
import { fontVariableClass } from '@/styles/fonts';

/**
 * Favicon comes from `src/app/icon.png` — Next.js App Router auto-
 * registers it. No `metadata.icons` override needed (any override
 * here would beat the file convention).
 */
export const metadata: Metadata = {
  title: 'PowerTradeFX',
  description: 'PowerTradeFX — professional forex and CFD trading platform',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Pinch-zoom intentionally allowed for WCAG 2.1.4 compliance.
  // Earlier `maximumScale: 1` + `userScalable: false` blocked
  // low-vision users — dropped per accessibility audit.
  themeColor: '#ffffff',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // `fontVariableClass` applies the three CSS-var fonts
    // (--font-display = Fraunces, --font-body = Inter Tight,
    //  --font-mono = JetBrains Mono) globally. Tailwind picks them
    // up via the font-family extensions in tailwind.config.ts —
    // `font-display`, `font-body`, `font-mono`.
    // translate="no" + the matching <meta> below tell Google Translate (and
    // Chrome's built-in translate prompt) to leave the DOM alone. Translate
    // injects <font> wrappers around text nodes inside the live tree; React's
    // reconciler then trips over the unexpected children with
    // "NotFoundError: Failed to execute 'removeChild' / 'insertBefore' on
    // 'Node'" the next time it tries to commit, taking the whole app to
    // error.tsx. Trading pages are the worst hit because they re-render on
    // every price tick. Hard-opting the page out of translation is the
    // canonical fix for that React/Translate collision.
    // lang="en" matches the actual copy on every page. Earlier this was
    // "fr" — a leftover from the original French marketing scaffold — which
    // made Chrome think every English screen needed translating and triggered
    // the auto-translate prompt on the trading terminal. The `translate="no"`
    // attributes below are still the belt-and-suspenders guard against
    // standalone Translate extensions.
    <html lang="en" translate="no" suppressHydrationWarning className={fontVariableClass}>
      <head>
        <meta name="google" content="notranslate" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var d=document.documentElement;d.setAttribute('data-theme','light');d.classList.add('theme-light');d.style.backgroundColor='#ffffff';d.style.color='#0A0A0A';}catch(e){document.documentElement.setAttribute('data-theme','light');document.documentElement.style.backgroundColor='#ffffff';document.documentElement.style.color='#0A0A0A';}})();`,
          }}
        />
      </head>
      <body className="min-h-full notranslate" translate="no" suppressHydrationWarning>
        <Suspense fallback={null}>
          <TopLoader />
        </Suspense>
        <ThemeProvider>
          <AuthProvider>
            <GoogleAuthProvider>
            <NotificationListener />
            {/* Two-stage onboarding gate. ProfileCompleteGate enforces the
                profile-fields step (always renders first if profile is
                incomplete); OnboardingGate then enforces wallet + email
                verification on top. Order matters: only one of them ever
                shows at a time, and they chain — finish the profile, then
                the wallet/email gate kicks in. Both are non-dismissible. */}
            <ProfileCompleteGate />
            <OnboardingGate />
            {children}
            <Toaster
              position="top-center"
              containerClassName="powertradefx-toaster"
              gutter={10}
              // Belt-and-suspenders cap on the lib's outer container.
              // The CSS rule on .powertradefx-toaster also clamps this,
              // but inline styles always win over a possibly-stale CSS
              // chunk, so this guarantees no toast overflows even if
              // the stylesheet hasn't loaded yet.
              containerStyle={{
                maxWidth: 'min(440px, calc(100vw - 32px))',
              }}
              toastOptions={{
                duration: 2500,
                className: 'powertradefx-hot-toast',
                // maxWidth caps the toast at a readable column so long
                // backend error messages (e.g. balance-gate copy) wrap
                // onto a second line instead of stretching across the
                // chart and overlapping other UI. Tested down to 320 px
                // mobile widths — copy still readable.
                style: {
                  background: 'var(--toast-bg)',
                  color: 'var(--toast-fg)',
                  border: '1px solid var(--toast-border)',
                  maxWidth: 'min(420px, calc(100vw - 32px))',
                  width: 'auto',
                  minWidth: 0,
                  lineHeight: 1.4,
                  whiteSpace: 'normal',
                  overflowWrap: 'anywhere',
                },
                success: {
                  duration: 2200,
                  className: 'powertradefx-hot-toast',
                  // White check on a green disc — universal "success" that
                  // reads instantly on both the dark and light toast surfaces.
                  // (The old amber disc was a leftover from the gold-brand era.)
                  iconTheme: { primary: '#10B981', secondary: '#ffffff' },
                },
                error: {
                  duration: 4000,
                  className: 'powertradefx-hot-toast',
                  // White X on a saturated red disc — high contrast on the
                  // dark toast background, no fade-out into the BG colour.
                  iconTheme: { primary: '#EF4444', secondary: '#ffffff' },
                },
                loading: {
                  duration: Infinity,
                  className: 'powertradefx-hot-toast',
                  iconTheme: { primary: 'rgb(var(--accent-rgb))', secondary: 'var(--toast-bg)' },
                },
              }}
            />
            </GoogleAuthProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
