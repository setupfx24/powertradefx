import type { ReactNode } from 'react'

export const metadata = {
  title: 'More — PowerTradeFX',
  description: 'Additional tools, settings, and account features.',
}

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
