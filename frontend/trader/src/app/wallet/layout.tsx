import type { ReactNode } from 'react'

export const metadata = {
  title: 'Wallet — SwissCresta',
  description: 'Deposit, withdraw, and manage funds across your trading accounts.',
}

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
