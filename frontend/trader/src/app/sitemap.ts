import type { MetadataRoute } from 'next'
import { ASSET_CLASSES, classHref } from '@/components/portal/marketData'

/**
 * Sitemap for crawlable marketing routes. Keep in sync with the
 * `allow` set in robots.ts — anything disallowed from crawling should
 * NOT appear here. Excludes route groups (those vanish from URLs) and
 * authenticated trader-app pages.
 *
 * Priority hint: home > product overviews > legal pages.
 * changeFrequency is advisory; Google mostly ignores it nowadays.
 */
const MARKETING_ROUTES = [
  '/',
  // Portal product overviews. Markets, Platform and Contact are the three
  // top-bar links; classes/sessions hang off /platform and the footer.
  '/markets', '/platform', '/classes', '/sessions',
  '/contact',
  '/privacy', '/terms', '/risk', '/policy', '/account-deletion',
] as const

/** Product pages rank above legal pages, below the home page. The
 *  per-class pages count as product content, not boilerplate. */
const OVERVIEWS = new Set<string>([
  '/markets', '/platform', '/classes', '/sessions', '/contact',
  ...ASSET_CLASSES.map((c) => classHref(c.slug)),
])

/* Derived, not typed out: a class added to marketData.ts gets its page
   listed here automatically, the same way it gets a roster row. */
const CLASS_ROUTES = ASSET_CLASSES.map((c) => classHref(c.slug))

export default function sitemap(): MetadataRoute.Sitemap {
  const host = process.env.NEXT_PUBLIC_MARKETING_HOST
    ? `https://${process.env.NEXT_PUBLIC_MARKETING_HOST}`
    : 'https://powertradefx.com'
  const lastModified = new Date()

  return [...MARKETING_ROUTES, ...CLASS_ROUTES].map((path) => ({
    url: `${host}${path}`,
    lastModified,
    changeFrequency: path === '/' ? 'weekly' : 'monthly',
    priority: path === '/' ? 1.0 : OVERVIEWS.has(path) ? 0.8 : 0.6,
  }))
}
