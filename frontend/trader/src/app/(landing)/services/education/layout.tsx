import type { Metadata } from 'next';
import { BRAND_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: `Learn to Trade | Guides & Tutorials | ${BRAND_NAME}`,
  description:
    `Free guides and tutorials on using the ${BRAND_NAME} platform and on the basics — orders, margin and leverage, funding, copy trading and automation. Practise on a free demo.`,
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
