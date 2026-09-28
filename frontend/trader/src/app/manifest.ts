import type { MetadataRoute } from 'next'

/**
 * PWA manifest. Mobile "Add to home screen" prompts pick up the name,
 * icons, and theme colors from here.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SwissCresta — Professional Trading Platform',
    short_name: 'SwissCresta',
    description: 'Professional forex and CFD trading platform',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#E94E1B',
    icons: [
      { src: '/marketing/swisscresta_fevicon.png', sizes: 'any', type: 'image/png' },
    ],
  }
}
