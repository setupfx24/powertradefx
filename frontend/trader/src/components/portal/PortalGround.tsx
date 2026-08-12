'use client';

import { useEffect } from 'react';

/**
 * Borrows the document ground for the portal surface.
 *
 * The app shell hard-codes a light background and an accent gradient onto
 * <html> (see app/layout.tsx and components/ThemeProvider.tsx). Without
 * this, overscroll and the area behind the page flash white on a page
 * that is otherwise near-black. Restores the previous values on unmount
 * so navigating back into the trading app leaves no trace.
 *
 * Renders nothing. PortalPage does the same inline for the home route.
 */
export default function PortalGround() {
  useEffect(() => {
    const root = document.documentElement;
    const prevBg = root.style.backgroundColor;
    const prevFg = root.style.color;
    const prevImg = root.style.backgroundImage;
    root.style.backgroundColor = '#0A0C0E';
    root.style.color = '#EDE7DC';
    root.style.backgroundImage = 'none';
    return () => {
      root.style.backgroundColor = prevBg;
      root.style.color = prevFg;
      root.style.backgroundImage = prevImg;
    };
  }, []);

  return null;
}
