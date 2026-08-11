import type { ReactNode } from 'react'

export const metadata = {
  title: 'Sign In — PowerTradeFX',
  description: 'Choose how to sign in to your PowerTradeFX trading account.',
}

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
