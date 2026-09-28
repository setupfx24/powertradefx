'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';

/**
 * Mirrors the persisted theme onto <html> (data-theme + theme-* class) and
 * wraps the app in a matching container. Every colour comes from the token
 * blocks in globals.css — this component paints nothing itself.
 *
 * The trading terminal is always the dark desk: token lookup is
 * ancestor-based, so the nearer data-theme="dark" wrapper wins even when
 * the user's preference is light.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const stored = useUIStore((s) => s.theme);
  const pathname = usePathname();
  const theme = pathname?.startsWith('/trading/terminal') ? 'dark' : stored;

  useEffect(() => {
    const el = document.documentElement;
    el.setAttribute('data-theme', theme);
    el.classList.toggle('theme-dark', theme === 'dark');
    el.classList.toggle('theme-light', theme === 'light');
    el.style.colorScheme = theme;
  }, [theme]);

  return (
    <div
      data-theme={theme}
      className={cn('flex min-h-full w-full flex-col', theme === 'dark' ? 'theme-dark' : 'theme-light')}
    >
      {children}
    </div>
  );
}
