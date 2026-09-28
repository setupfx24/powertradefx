import type { Metadata } from 'next';
import { BRAND_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: `Market News & Economic Calendar | ${BRAND_NAME}`,
  description:
    `An economic calendar with impact levels and live headlines, inside your ${BRAND_NAME} account and the web terminal. See what is scheduled before you place the trade.`,
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
