'use client';

/**
 * On-chart quick trade: live SELL / BUY market buttons with a lot input.
 *
 * The buttons reflect quote freshness, not just presence: a symbol whose
 * market is open but whose feed is down (stale republish) shows the last
 * price greyed with FEED OFFLINE and cannot be traded — the backend refuses
 * such orders anyway, so the widget must not look tradeable. A closed
 * market shows CLOSED the same way.
 */
import { useState } from 'react';
import toast from 'react-hot-toast';
import { useTradingStore } from '@/stores/tradingStore';
import { sounds } from '@/lib/sounds';
import { getMarketStatus } from '@/lib/marketHours';
import { quoteFreshness, staleQuoteMessage } from '@/lib/quoteStatus';
import { cn } from '@/lib/utils';

export function ChartTradeWidget() {
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const sym = (selectedSymbol ?? 'EURUSD').toUpperCase();
  const tick = useTradingStore((s) => s.prices[sym]);
  const activeAccount = useTradingStore((s) => s.activeAccount);
  const placeOrder = useTradingStore((s) => s.placeOrder);
  const instruments = useTradingStore((s) => s.instruments);

  const [lots, setLots] = useState(0.01);
  const [busy, setBusy] = useState(false);

  const inst = instruments.find((i) => String(i.symbol).toUpperCase() === sym);
  const digits = inst?.digits ?? (sym.endsWith('JPY') ? 3 : sym.includes('USD') && !/^[A-Z]{6}$/.test(sym) ? 2 : 5);
  const marketStatus = getMarketStatus(sym, (inst as { segment?: string } | undefined)?.segment);
  const freshness = quoteFreshness(tick, marketStatus.isOpen);
  const tradeable = freshness === 'live';
  const blockedReason =
    freshness === 'stale' ? staleQuoteMessage(tick) : freshness === 'closed' ? marketStatus.reason || 'Market is closed' : null;
  const stateLabel = freshness === 'stale' ? 'FEED OFFLINE' : freshness === 'closed' ? 'CLOSED' : null;

  const bid = tick?.bid;
  const ask = tick?.ask;

  const fmt = (v?: number) => (v == null || !Number.isFinite(v) ? '—' : v.toFixed(digits));

  const trade = async (side: 'buy' | 'sell') => {
    if (busy) return;
    if (!activeAccount?.id) {
      toast.error('Select an account first');
      return;
    }
    if (!tradeable) {
      toast.error(blockedReason ?? 'No live price');
      return;
    }
    const lot = Math.max(0.01, Number(lots) || 0.01);
    // Fire the click sound BEFORE the request, like the order panel does — the
    // tap should feel synchronous instead of waiting on the server round-trip.
    // (The success toast still waits for the API, so a rejected order never
    // shows a fake confirmation.)
    sounds.orderPlaced();
    setBusy(true);
    try {
      await placeOrder({ account_id: activeAccount.id, symbol: sym, side, order_type: 'market', lots: lot });
      toast.success(`${side.toUpperCase()} ${lot} ${sym} @ ${fmt(side === 'buy' ? ask : bid)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Order failed');
    } finally {
      setBusy(false);
    }
  };

  const sideBtn = (side: 'buy' | 'sell') => {
    const price = side === 'buy' ? ask : bid;
    const live = tradeable && price != null;
    return (
      <button
        type="button"
        disabled={busy || price == null || !tradeable}
        onClick={() => trade(side)}
        aria-disabled={!tradeable || undefined}
        className={cn(
          'flex flex-col items-center justify-center rounded-md px-3 py-1 shadow-md transition-colors disabled:cursor-not-allowed',
          live
            ? side === 'buy'
              ? 'bg-buy hover:bg-buy-light text-text-inverse'
              : 'bg-sell hover:bg-sell-light text-text-on-accent'
            : 'bg-bg-tertiary border border-border-primary text-text-tertiary',
        )}
        title={live ? `${side === 'buy' ? 'Buy' : 'Sell'} at market` : blockedReason ?? 'No live price'}
      >
        <span className="font-mono tabular-nums text-sm font-extrabold leading-none">{fmt(price)}</span>
        <span className={cn('text-[10px] font-bold tracking-wider', !live && 'text-warning')}>
          {live ? side.toUpperCase() : stateLabel ?? side.toUpperCase()}
        </span>
      </button>
    );
  };

  return (
    <div className="pointer-events-auto flex items-stretch gap-1 select-none">
      {sideBtn('sell')}

      {/* Lot input sits between SELL and BUY (typing only — no stepper arrows). */}
      <input
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0.01"
        name="chart-quick-lots"
        id="chart-quick-lots"
        value={lots}
        disabled={!tradeable}
        onChange={(e) => setLots(Math.max(0.01, Number(e.target.value) || 0.01))}
        className="w-16 self-stretch rounded-md bg-bg-overlay text-text-primary text-xs px-1 text-center border border-border-strong focus:outline-none focus:border-accent/70 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0"
        title="Lot size"
        aria-label="Lot size"
      />

      {sideBtn('buy')}
    </div>
  );
}

export default ChartTradeWidget;
