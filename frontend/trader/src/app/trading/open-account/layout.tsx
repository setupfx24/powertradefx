import type { ReactNode } from 'react'

export const metadata = {
  title: 'Open Trading Account — SwissCresta',
  description: 'Choose your account type and open a new trading account.',
}

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
