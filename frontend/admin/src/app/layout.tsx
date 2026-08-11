import React from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import ThemeInitScript from '@/components/ThemeInitScript';
import AppToaster from '@/components/AppToaster';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'PowerTradeFX Admin',
  description: 'PowerTradeFX broker administration panel',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable} style={{ ['--font-jetbrains' as string]: "ui-monospace, 'Cascadia Code', Menlo, Consolas, monospace" }}>
      {/* `suppressHydrationWarning` on <body> is required because several
          browser extensions inject attributes into <body> after page
          load (ColorZilla → `cz-shortcut-listen`, Grammarly →
          `data-new-gr-c-s-check-loaded`, Honey, LastPass, dark-reader,
          etc.). The server never renders those attributes, so React's
          hydration check on the body element will always fail unless we
          tell it to ignore mismatches on this one node. The flag only
          affects the body's own attributes, not its children — every
          real mismatch deeper in the tree still surfaces. Same flag
          already lives on <html> above for the theme-init script. */}
      <body
        className={`${inter.className} min-h-screen bg-bg-page text-text-primary antialiased`}
        suppressHydrationWarning
      >
        <ThemeInitScript />
        {children}
        <AppToaster />
      </body>
    </html>
  );
}
