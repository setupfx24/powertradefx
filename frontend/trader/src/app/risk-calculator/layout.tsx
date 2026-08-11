import type { ReactNode } from 'react'

export const metadata = {
  title: 'Risk Calculator — PowerTradeFX',
  description: 'Calculate position size, pip value, and margin requirements.',
}

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
