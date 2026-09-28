/**
 * Quote freshness — mirrors the backend `is_tick_stale` guard so the UI never
 * presents a frozen price as live.
 *
 * A quote is stale when the server flagged it (`stale: true`, republished by
 * market-data because the upstream feed stopped) or when its publish time is
 * older than STALE_AFTER_MS. Over a weekend a closed market legitimately has
 * an old quote, so callers pass the market-open state and get one of three
 * answers instead of a bare boolean:
 *
 *   live    — fresh tick, trade normally
 *   closed  — market closed; the last price is shown as reference
 *   stale   — market OPEN but no live tick: the feed is down. Show the price
 *             greyed with the last-update time and block new orders (the
 *             backend refuses them anyway).
 */
import type { TickData } from '@/stores/tradingStore';

export const STALE_AFTER_MS = 60_000;

export type QuoteFreshness = 'live' | 'closed' | 'stale';

export function isQuoteStale(tick: Pick<TickData, 'stale' | 'ts_ms'> | null | undefined, now = Date.now()): boolean {
  if (!tick) return true;
  if (tick.stale) return true;
  if (typeof tick.ts_ms === 'number' && Number.isFinite(tick.ts_ms)) {
    return now - tick.ts_ms > STALE_AFTER_MS;
  }
  return false; // legacy payload without markers: fail open, same as the backend
}

export function quoteFreshness(
  tick: Pick<TickData, 'stale' | 'ts_ms'> | null | undefined,
  marketOpen: boolean,
  now = Date.now(),
): QuoteFreshness {
  if (!isQuoteStale(tick, now)) return 'live';
  return marketOpen ? 'stale' : 'closed';
}

/** "7 Sep, 03:41" style label of the last real tick, for stale quotes. */
export function lastUpdateLabel(tick: Pick<TickData, 'last_live_ms' | 'ts_ms' | 'timestamp'> | null | undefined): string | null {
  if (!tick) return null;
  const ms =
    (typeof tick.last_live_ms === 'number' && tick.last_live_ms) ||
    (typeof tick.ts_ms === 'number' && tick.ts_ms) ||
    (tick.timestamp ? Date.parse(tick.timestamp) : NaN);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Human copy for the stale state, e.g. "Live price unavailable — last update 7 Sep, 03:41". */
export function staleQuoteMessage(tick: Parameters<typeof lastUpdateLabel>[0]): string {
  const when = lastUpdateLabel(tick);
  return when ? `Live price unavailable — last update ${when}` : 'Live price unavailable — price feed is reconnecting';
}
