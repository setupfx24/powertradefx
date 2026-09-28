import type { ReactNode } from 'react'

export const metadata = {
  title: 'PAMM — SwissCresta',
  description: 'Percentage Allocation Management Module: invest with proven money managers.',
}

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
