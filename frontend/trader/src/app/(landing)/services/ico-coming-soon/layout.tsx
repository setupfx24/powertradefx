import type { Metadata } from 'next';
import { BRAND_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: `Token Launches — Coming Soon | ${BRAND_NAME}`,
  description:
    `Early access to vetted token sales for ${BRAND_NAME} account holders is coming soon. Join the waitlist to be told when it opens.`,
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
