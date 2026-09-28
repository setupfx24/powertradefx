import HomePage from '@/home/HomePage'

/**
 * Public homepage at the root of the marketing domain.
 *
 * Renders the marketing home (src/home), which brings its own Navbar
 * and footer. The (landing) layout detects the `/` path and suppresses
 * its shared chrome so the two don't stack.
 */
export default function LandingHomePage() {
  return <HomePage />
}
