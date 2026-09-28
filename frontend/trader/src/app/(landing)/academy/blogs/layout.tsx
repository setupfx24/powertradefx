import type { Metadata } from 'next';
import { BRAND_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: `Trader Guides | ${BRAND_NAME}`,
  description: `Short guides on using the ${BRAND_NAME} platform and on the basics — limit orders, margin and leverage, funding with USDT, copy trading, the AI strategy builder and the Algo Connector.`,
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
