import { redirect } from 'next/navigation';

/**
 * The standalone "/trading" account picker was retired — the Accounts
 * page (/accounts) is now the canonical place to pick an account and
 * launch the terminal (its per-card "Trade" button deep-links to
 * /trading/terminal?account=<id>). Clicking "Trade" in the navbar lands
 * here and redirects so users never see the old dark TopBar chrome.
 */
export default function TradingIndexRedirect() {
  redirect('/accounts');
}
