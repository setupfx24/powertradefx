import type { Metadata } from 'next';
import { BRAND_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: `PAMM — Managed Accounts | ${BRAND_NAME}`,
  description:
    `Invest with approved PAMM managers sorted by ROI, or apply to manage a pooled account. Performance-fee based, run from inside your ${BRAND_NAME} account.`,
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
