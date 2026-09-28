import type { ReactNode } from 'react'

export const metadata = {
  title: 'Shared Trade — SwissCresta',
  description: 'A trader shared this position with you.',
  openGraph: {
    title: 'Shared Trade on SwissCresta',
    description: 'View a position card a SwissCresta trader shared.',
    type: 'website',
  },
}

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
