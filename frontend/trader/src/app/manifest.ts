import type { MetadataRoute } from 'next'

/**
 * PWA manifest. Mobile "Add to home screen" prompts pick up the name,
 * icons, and theme colors from here.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PowerTradeFX — Professional Trading Platform',
    short_name: 'PowerTradeFX',
    description: 'Professional forex and CFD trading platform',
    start_url: '/',
    display: 'standalone',
    background_color: '#0A0D14', // matches the app's dark ink
    theme_color: '#2563EB', // --brand-600; manifest requires a literal (parsed without CSS)
    icons: [
      { src: '/marketing/powertradefx_fevicon.png', sizes: '128x128', type: 'image/png' },
      { src: '/icon.png', sizes: '512x512', type: 'image/png' },
    ],
  }
}
