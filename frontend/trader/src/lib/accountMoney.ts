/**
 * Account-money display — the ONE place that knows about Cent accounts.
 *
 * Every account's money is stored and sent by the server in USD. A Cent
 * account (account_group.is_cent) shows its own amounts ×100 as US cents:
 * $10.00 balance → "1,000.00 USC". Only amounts that BELONG to that account
 * are converted (balance, equity, margin, free margin, P&L, commission, swap,
 * margin estimates). Wallet balances, deposits, withdrawals, IB earnings and
 * any cross-account totals stay in USD.
 *
 * Use these helpers for every account-scoped amount instead of hand-rolled
 * `$${n.toFixed(2)}`, so a Cent account can never show dollars in one panel
 * and cents in another.
 */

export const CENT_FACTOR = 100;
export const CENT_CODE = 'USC';

export interface CentAware {
  account_group?: { is_cent?: boolean | null } | null;
  is_cent?: boolean | null;
}

export function isCentAccount(acc: CentAware | null | undefined): boolean {
  return Boolean(acc?.account_group?.is_cent ?? acc?.is_cent);
}

/** USD amount → the account's display unit (cents for a Cent account). */
export function toAccountUnits(usd: number | null | undefined, acc: CentAware | null | undefined): number {
  const v = Number(usd);
  if (!Number.isFinite(v)) return 0;
  return isCentAccount(acc) ? v * CENT_FACTOR : v;
}

/** Amount typed in the account's display unit → USD (for inputs). */
export function fromAccountUnits(amount: number, acc: CentAware | null | undefined): number {
  return isCentAccount(acc) ? amount / CENT_FACTOR : amount;
}

export function accountCurrencyCode(acc: CentAware | null | undefined): 'USC' | 'USD' {
  return isCentAccount(acc) ? CENT_CODE : 'USD';
}

const num2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface MoneyOpts {
  /** Prefix "+" on non-negative values (P&L cells). */
  signed?: boolean;
  /** Style: 'symbol' → "$10.00" / "1,000.00 USC"; 'code' → "10.00 USD" / "1,000.00 USC". */
  style?: 'symbol' | 'code';
}

/**
 * Format a USD amount for an account. USD accounts keep the caller's style
 * ("$1,234.56" or "1,234.56 USD"); Cent accounts always read "123,456.00 USC".
 */
export function formatAccountMoney(
  usd: number | null | undefined,
  acc: CentAware | null | undefined,
  opts: MoneyOpts = {},
): string {
  const v = toAccountUnits(usd, acc);
  const abs = num2.format(Math.abs(v));
  const sign = v < 0 ? '-' : opts.signed ? '+' : '';
  if (isCentAccount(acc)) return `${sign}${abs} ${CENT_CODE}`;
  return opts.style === 'code' ? `${sign}${abs} USD` : `${sign}$${abs}`;
}
