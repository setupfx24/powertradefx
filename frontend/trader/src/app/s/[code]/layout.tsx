import type { ReactNode } from 'react'

export const metadata = {
  title: 'Shared Trade — PowerTradeFX',
  description: 'A trader shared this position with you.',
  openGraph: {
    title: 'Shared Trade on PowerTradeFX',
    description: 'View a position card a PowerTradeFX trader shared.',
    type: 'website',
  },
}

export default function Layout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
