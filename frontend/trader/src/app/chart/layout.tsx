import type { ReactNode } from 'react';

export const metadata = {
  title: 'Chart — PowerTradeFX',
  // Chrome-free: this page is embedded by the web terminal and the mobile
  // app's WebView, so it must render nothing but the chart.
};

export default function ChartLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
