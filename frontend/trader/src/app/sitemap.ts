import type { MetadataRoute } from 'next'

/**
 * Sitemap for crawlable marketing routes. Keep in sync with the
 * `allow` / `disallow` sets in robots.ts — anything disallowed from
 * crawling should NOT appear here. Excludes route groups (those vanish
 * from URLs) and authenticated trader-app pages.
 *
 * Priority hint: home > markets and platform pages > everything else >
 * legal pages. changeFrequency is advisory; Google mostly ignores it.
 */
const MARKETING_ROUTES = [
  '/',
  // Trading
  '/markets',
  '/trading/forex', '/trading/commodities', '/trading/indices', '/trading/crypto',
  '/account-types', '/accounts/standard', '/accounts/pro', '/accounts/demo',
  '/deposit-withdrawal',
  // Platform
  '/platforms/web', '/platforms/copy-trading', '/platforms/super-admin',
  '/platforms/prop-trading', '/services/portfolio-management', '/download',
  // Partners
  '/platforms/ib-management', '/products/ib-referral', '/products/referral',
  '/products/insurance',
  // Learn
  '/how-it-works', '/faq',
  '/education/tutorials', '/education/blog', '/education/news',
  '/academy/blogs', '/academy/pdfs',
  '/services/market-research', '/services/education',
  // Company
  '/company/about', '/company/why-powertradefx', '/company/contact', '/careers',
  // Legal
  '/terms', '/privacy', '/risk', '/risk-warning', '/restricted-countries',
  '/delete-account',
] as const

const LEGAL = new Set<string>([
  '/terms', '/privacy', '/risk', '/risk-warning', '/restricted-countries', '/delete-account',
])

function priorityFor(path: string): number {
  if (path === '/') return 1.0
  if (path === '/markets' || path.startsWith('/trading/') || path.startsWith('/platforms/')) return 0.8
  if (LEGAL.has(path)) return 0.3
  return 0.6
}

export default function sitemap(): MetadataRoute.Sitemap {
  const host = process.env.NEXT_PUBLIC_MARKETING_HOST
    ? `https://${process.env.NEXT_PUBLIC_MARKETING_HOST}`
    : 'https://powertradefx.com'
  const lastModified = new Date()

  return MARKETING_ROUTES.map((path) => ({
    url: `${host}${path}`,
    lastModified,
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority: priorityFor(path),
  }))
}
