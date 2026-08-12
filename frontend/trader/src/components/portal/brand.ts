import type { PortalLink } from './PortalNav';

/**
 * Brand + chrome shared by every portal surface, so the fixed bar and the
 * footer are identical on the home page and on every sub-page. Change a
 * nav link once, here.
 *
 * The bar carries THREE links by design — Markets, Platform, Contact.
 * /classes and /sessions are still live pages, reached from /platform and
 * from the footer, they are just not top-level any more.
 *
 * Every route linked from here must also be listed in PUBLIC_EXACT_PATHS
 * in components/providers/AuthProvider.tsx, or logged-out visitors get
 * bounced to /auth/login.
 */
export const PORTAL_BRAND = {
  /** Hero wordmark, split into the two halves that travel apart. */
  wordmark: { a: 'POWER', b: 'TRADEFX' },
  /** Full mark with its trailing period. Still what the closing fold sets
   *  in type, and the alt text for the nav logo below. */
  mark: 'POWERTRADEFX.',
  /** Wordmark lockup for the fixed bar. A full lockup, so it REPLACES the
   *  type mark rather than sitting beside it — showing both would print the
   *  brand name twice. Left unset by /label, which keeps the type mark. */
  logo: '/portal/logo.png',
  links: [
    { label: 'Markets', href: '/markets' },
    { label: 'Platform', href: '/platform' },
    { label: 'Contact', href: '/contact' },
  ] as PortalLink[],
  cta: { label: 'Open account', href: '/auth/register' } as PortalLink,
  foot: {
    left: 'PowerTradeFX — forex & CFD trading',
    right: 'Trading involves risk',
  },
  /** Registered name, used for the copyright line in the closing fold. */
  legalName: 'PowerTradeFX Ltd',
  contact: {
    email: 'support@powertradefx.com',
    /* Matches the platform's own trading hours — the desk is not staffed
       against a schedule this repo can verify beyond market hours. */
    hours: 'Desk open 24/5, with the markets.',
  },
  /* Every href below MUST be public — see PUBLIC_EXACT_PATHS in
     components/providers/AuthProvider.tsx. A link to a gated route sends
     logged-out visitors straight to /auth/login from the footer. */
  footerNav: [
    {
      title: 'Platform',
      links: [
        { label: 'Overview', href: '/platform' },
        { label: 'Markets', href: '/markets' },
        /* Off the top bar since it went to three links, so the footer is
           now the main way in to these two. */
        { label: 'Asset classes', href: '/classes' },
        { label: 'Market sessions', href: '/sessions' },
      ] as PortalLink[],
    },
    {
      title: 'Legal',
      links: [
        { label: 'Privacy', href: '/privacy' },
        { label: 'Terms', href: '/terms' },
        { label: 'Risk disclosure', href: '/risk' },
        { label: 'Policy', href: '/policy' },
        { label: 'Data deletion', href: '/account-deletion' },
      ] as PortalLink[],
    },
  ],
  /**
   * The closing fold's sign-up block. There is no public newsletter
   * endpoint in this repo — market updates are a per-account notification
   * preference (see the Newsletter row in app/profile/page.tsx). So the
   * field is a plain GET form onto the signup page, which seeds its email
   * field from ?email= (see components/ui/full-screen-signup.tsx). Copy
   * below says exactly that; do not reword it into a subscribe promise.
   */
  updates: {
    title: 'Market updates',
    note: 'Weekly market analysis, sent to you. Start with an account — updates are a switch in your profile.',
    action: '/auth/register',
    placeholder: 'you@email.com',
    submit: 'Submit',
  },
  /** Standard leveraged-products warning. Deliberately carries NO
   *  percentage — a firm-specific loss figure is not ours to invent. */
  riskWarning:
    'CFDs are leveraged products and carry a high risk of losing money rapidly. Make sure you understand how they work and whether you can afford to take that risk.',
} as const;
