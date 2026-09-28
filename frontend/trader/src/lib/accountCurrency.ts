/**
 * Quote-currency → account-currency (USD) conversion for client-side
 * estimates. lots × contract size × price is in the instrument's QUOTE
 * currency: yen for USDJPY/EURJPY, euro for GER40. Showing it as dollars
 * overstated the margin preview about 150× on JPY pairs.
 *
 * Mirrors the server's `quote_value_to_account` so the order ticket shows the
 * margin the server will actually reserve. The server stays authoritative.
 */

export interface CurrencyInstrument {
  symbol: string;
  contract_size?: number | null;
  base_currency?: string | null;
  quote_currency?: string | null;
}

type PriceMap = Record<string, { bid?: number | null } | undefined>;

function currencies(inst: CurrencyInstrument | null | undefined, symbol: string): [string, string] {
  const sym = String(symbol || inst?.symbol || '').toUpperCase();
  const base = String(inst?.base_currency || (sym.length >= 6 ? sym.slice(0, 3) : '')).toUpperCase();
  const quote = String(inst?.quote_currency || (sym.length >= 6 ? sym.slice(3, 6) : '')).toUpperCase();
  return [base, quote];
}

/** Convert `value` (in the instrument's quote currency) to USD. Falls back to
 *  the unconverted value when no USD rate is streaming yet. */
export function quoteToUsd(
  value: number,
  inst: CurrencyInstrument | null | undefined,
  symbol: string,
  refPrice: number,
  prices: PriceMap,
): number {
  if (!value) return value;
  const [base, quote] = currencies(inst, symbol);
  if (!quote || quote === 'USD') return value;
  if (base === 'USD') return refPrice > 0 ? value / refPrice : value;
  const usdQ = prices[`USD${quote}`]?.bid;
  if (usdQ && usdQ > 0) return value / usdQ;
  const qUsd = prices[`${quote}USD`]?.bid;
  if (qUsd && qUsd > 0) return value * qUsd;
  return value;
}

/** Margin in USD for `lots` at `price` with the account's leverage. */
export function marginUsd(
  lots: number,
  price: number,
  inst: CurrencyInstrument | null | undefined,
  symbol: string,
  leverage: number,
  prices: PriceMap,
): number {
  if (!price || !lots) return 0;
  const cs = Number(inst?.contract_size) || 100000;
  const lev = leverage > 0 ? leverage : 1;
  return quoteToUsd(lots * cs * price, inst, symbol, price, prices) / lev;
}
