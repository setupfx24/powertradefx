import type { MetadataRoute } from 'next'

/**
 * Crawler directives. Allow the marketing surface (home, markets and
 * trading pages, platform, partner, learn, company and legal pages),
 * block everything authenticated. Search engines have no business
 * indexing /dashboard or /wallet — those require login anyway, but
 * disallowing them keeps the crawl budget on the marketing pages.
 *
 * The three account-tier marketing pages live under /accounts/*, which
 * is also the trader app's accounts route, so they are allowed
 * explicitly (a longer `allow` wins over the shorter `disallow`).
 */
export default function robots(): MetadataRoute.Robots {
  const host = process.env.NEXT_PUBLIC_MARKETING_HOST
    ? `https://${process.env.NEXT_PUBLIC_MARKETING_HOST}`
    : 'https://powertradefx.com'

  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/accounts/standard',
          '/accounts/pro',
          '/accounts/demo',
        ],
        disallow: [
          '/api/',
          '/auth/',
          '/dashboard',
          '/kyc',
          '/wallet',
          '/deposit',
          '/portfolio',
          '/transactions',
          '/profile',
          '/trading/terminal',
          '/trading/open-account',
          '/trade',
          '/chart',
          '/app-chart',
          '/social',
          '/news',
          '/business',
          '/pamm',
          '/accounts',
          '/ai-strategies',
          '/algo-connector',
          '/support',
          '/more',
          '/risk-calculator',
          '/tenant-home',
          '/s/',
        ],
      },
    ],
    sitemap: `${host}/sitemap.xml`,
    host,
  }
}
