import type { Metadata } from 'next';
import { BRAND_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: `Trading Guides | ${BRAND_NAME}`,
  description: `Reference guides to the ${BRAND_NAME} web terminal, order types, margin and leverage, funding, copy trading and automation — read online, no download needed.`,
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
