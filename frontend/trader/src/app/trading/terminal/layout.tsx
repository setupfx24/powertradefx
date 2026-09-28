import type { ReactNode } from 'react'

export const metadata = {
  title: 'Trading Terminal — SwissCresta',
  description: 'Professional trading terminal: charts, order panel, positions, and watchlists.',
}

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
