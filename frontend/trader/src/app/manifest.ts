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
    /* All three are the same FX badge, cut from public/portal/fevicon.png.
       `/icon.png` and `/apple-icon.png` are served by the App Router file
       convention (src/app/icon.png, src/app/apple-icon.png); the 192 is a
       plain public asset because Android install prompts want that size.
       Sizes here MUST match the files — the previous entry claimed
       /icon.png was 512x512 when it was not. */
    icons: [
      { src: '/portal/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon.png', sizes: '256x256', type: 'image/png' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  }
}
