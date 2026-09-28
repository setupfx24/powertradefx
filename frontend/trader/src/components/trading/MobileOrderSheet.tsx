'use client';

import { useState } from 'react';
import { useTradingStore } from '@/stores/tradingStore';
import { useUIStore } from '@/stores/uiStore';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { ChevronDown, LineChart, Minus, Plus, X } from 'lucide-react';
import { sounds, unlockAudio } from '@/lib/sounds';
import { Button, Input, Segmented } from '@/components/ui';

interface MobileOrderSheetProps {
  symbol: string;
  onClose: () => void;
  onGoToChart?: () => void;
}

type PendingSubtype = 'buy_limit' | 'sell_limit' | 'buy_stop' | 'sell_stop';

const PENDING_SUBTYPES: { id: PendingSubtype; label: string }[] = [
  { id: 'buy_limit', label: 'Buy Limit' },
  { id: 'sell_limit', label: 'Sell Limit' },
  { id: 'buy_stop', label: 'Buy Stop' },
  { id: 'sell_stop', label: 'Sell Stop' },
];

function pendingSubtypeToApi(sub: PendingSubtype): { order_type: 'limit' | 'stop'; side: 'buy' | 'sell' } {
  switch (sub) {
    case 'buy_limit':
      return { order_type: 'limit', side: 'buy' };
    case 'sell_limit':
      return { order_type: 'limit', side: 'sell' };
    case 'buy_stop':
      return { order_type: 'stop', side: 'buy' };
    case 'sell_stop':
      return { order_type: 'stop', side: 'sell' };
  }
}

/** Sheet field caption — the terminal's eyebrow scale. */
function Caption({ children }: { children: React.ReactNode }) {
  return <span className="text-xxs font-bold text-text-tertiary uppercase tracking-[0.12em] block ml-1">{children}</span>;
}

export default function MobileOrderSheet({ symbol, onClose, onGoToChart }: MobileOrderSheetProps) {
  // Narrow selectors: needs live `prices` but no longer re-renders on
  // positions/accounts/etc. Action references are stable in zustand.
  const prices = useTradingStore((s) => s.prices);
  const instruments = useTradingStore((s) => s.instruments);
  const activeAccount = useTradingStore((s) => s.activeAccount);
  const placeOrder = useTradingStore((s) => s.placeOrder);
  const setActiveBottomTab = useUIStore((s) => s.setActiveBottomTab);
  const [orderType, setOrderType] = useState<'market' | 'pending'>('market');
  const [pendingSubtype, setPendingSubtype] = useState<PendingSubtype>('buy_limit');
  const [submitting, setSubmitting] = useState(false);
  const [lots, setLots] = useState(0.01);
  const [lotsInput, setLotsInput] = useState('0.01');
  const [leverage, setLeverage] = useState('1:100');
  const [sl, setSl] = useState('');
  const [tp, setTp] = useState('');
  const [entryPrice, setEntryPrice] = useState('');

  const instrument = instruments.find(i => i.symbol === symbol);
  const price = prices[symbol];
  const digits = instrument?.digits ?? 5;
  const spread = price ? (price.ask - price.bid) * Math.pow(10, digits - 1) : 0;

  // Margin required for the selected lots — same formula as the desktop
  // OrderPanel (lots × contract_size × price ÷ leverage); server stays
  // authoritative at execution.
  const contractSize = instrument?.contract_size ?? 100000;
  const execPrice = price ? price.ask : 0;
  const marginRequired = activeAccount && execPrice
    ? (lots * contractSize * execPrice) / activeAccount.leverage
    : 0;
  const freeMargin = activeAccount?.free_margin || 0;
  const hasEnoughMargin = freeMargin >= marginRequired;

  // Entry-price helper (parity with the desktop OrderPanel): the rule the
  // server enforces for the chosen order type plus an explicit "Use <price>"
  // suggestion, so the field is never mistaken for pre-filled. 0 = no quote.
  const pendingLabel = PENDING_SUBTYPES.find((t) => t.id === pendingSubtype)?.label ?? pendingSubtype;
  const suggestedEntry = !price
    ? 0
    : pendingSubtype === 'buy_limit'
      ? price.ask * 0.999
      : pendingSubtype === 'sell_limit'
        ? price.bid * 1.001
        : pendingSubtype === 'buy_stop'
          ? price.ask * 1.001
          : price.bid * 0.999;
  const entryRule = !price
    ? 'Waiting for a quote'
    : pendingSubtype === 'buy_limit'
      ? `must be below ${price.ask.toFixed(digits)}`
      : pendingSubtype === 'sell_limit'
        ? `must be above ${price.bid.toFixed(digits)}`
        : pendingSubtype === 'buy_stop'
          ? `must be above ${price.ask.toFixed(digits)}`
          : `must be below ${price.bid.toFixed(digits)}`;

  const handleAdjustLots = (delta: number) => {
    setLots(prev => {
      const next = Math.max(0.01, parseFloat((prev + delta).toFixed(2)));
      setLotsInput(next.toString());
      return next;
    });
  };

  const handlePlaceOrder = async (overrideSide?: 'buy' | 'sell') => {
    if (!activeAccount) {
      toast.error('No active account selected');
      return;
    }
    unlockAudio();

    let apiOrderType: 'market' | 'limit' | 'stop';
    let side: 'buy' | 'sell';
    let priceVal: number | undefined;

    if (orderType === 'market') {
      if (!overrideSide) {
        toast.error('Select Buy or Sell');
        return;
      }
      apiOrderType = 'market';
      side = overrideSide;
      priceVal = undefined;
    } else {
      const mapped = pendingSubtypeToApi(pendingSubtype);
      apiOrderType = mapped.order_type;
      side = mapped.side;
      const p = parseFloat(entryPrice);
      if (!Number.isFinite(p) || p <= 0) {
        toast.error('Enter a valid entry price');
        return;
      }
      priceVal = p;
    }

    if (!Number.isFinite(lots) || lots <= 0) {
      toast.error('Invalid volume');
      return;
    }

    const slNum = sl.trim() ? parseFloat(sl) : NaN;
    const tpNum = tp.trim() ? parseFloat(tp) : NaN;

    // Optimistic: instant feedback, API fires in background. Market orders
    // toast immediately (the store injects the optimistic position row);
    // a pending order toasts only once the server accepts it, because a
    // resting order is NOT a fill and the message must not race a 400.
    sounds.orderPlaced();
    const isPending = orderType !== 'market';
    if (!isPending) toast.success(`${side.toUpperCase()} ${lots} ${symbol}`);
    onClose();
    placeOrder({
      account_id: activeAccount.id,
      symbol,
      side,
      order_type: apiOrderType,
      lots,
      price: priceVal,
      stop_loss: Number.isFinite(slNum) ? slNum : undefined,
      take_profit: Number.isFinite(tpNum) ? tpNum : undefined,
    }).then(() => {
      if (!isPending || priceVal == null) return;
      // placeOrder already re-fetched pending orders for a limit/stop, so
      // the Pending tab is current — bring it into view.
      toast.success(
        `${pendingLabel} ${lots} ${symbol} @ ${priceVal.toFixed(digits)} placed — waiting for price`,
        { duration: 5000 },
      );
      setActiveBottomTab('pending');
    }).catch((err: unknown) => {
      // api/client.ts throws Error(detail) for 4xx — surface the server's
      // exact reason (e.g. "Buy limit must be below the current ask (...)").
      const msg = err instanceof Error && err.message ? err.message : 'Failed to place order';
      toast.error(msg, { duration: 6000 });
    });
  };

  const canPlacePending = Boolean(entryPrice.trim()) && !submitting;

  return (
    <div className="fixed inset-0 z-[80] md:hidden">
      {/* Backdrop — dimmed app background so it reads correctly in light mode too. */}
      <div className="absolute inset-0 bg-bg-overlay animate-fade-in" onClick={onClose} aria-hidden />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Order ticket ${symbol}`}
        className="absolute bottom-0 left-0 right-0 bg-card rounded-t-sheet border-t border-border-primary shadow-lg animate-slide-up flex flex-col max-h-[92vh] select-none"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-border-strong rounded-full" />
        </div>

        {/* Header */}
        <div className="px-6 py-3 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-text-primary tracking-tight font-mono">{symbol}</h2>
            <p className="text-xxs text-text-tertiary font-bold uppercase tracking-[0.12em] mt-0.5">
              {instrument?.display_name || symbol}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onGoToChart && (
              <Button
                variant="outline"
                size="md"
                iconOnly
                onClick={() => { onClose(); onGoToChart(); }}
                title="Open chart"
                aria-label="Open chart"
              >
                <LineChart size={18} aria-hidden />
              </Button>
            )}
            <Button variant="outline" size="md" iconOnly onClick={onClose} aria-label="Close">
              <X size={20} aria-hidden />
            </Button>
          </div>
        </div>

        <div className="px-6 pb-10 flex-1 overflow-y-auto space-y-5 scrollbar-none">
          {/* Leverage Selector */}
          <div className="flex items-center justify-between p-3.5 bg-bg-tertiary rounded-lg border border-border-primary">
            <span className="text-xs font-bold text-text-tertiary">Leverage</span>
            <div className="flex items-center gap-1.5 text-warning font-bold text-xs font-mono">
              {leverage}
              <ChevronDown size={12} strokeWidth={3} aria-hidden />
            </div>
          </div>

          {/* Quick Bid/Ask Boxes */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-sell text-text-on-accent rounded-lg p-3 flex flex-col items-center justify-center shadow-sm">
              <span className="text-xxs font-bold uppercase tracking-[0.12em] opacity-70 mb-0.5">Sell Price</span>
              <span className="text-xl font-bold font-mono tabular-nums tracking-tighter">
                {price?.bid.toFixed(digits) || '--'}
              </span>
            </div>
            <div className="bg-buy text-text-inverse rounded-lg p-3 flex flex-col items-center justify-center shadow-sm">
              <span className="text-xxs font-bold uppercase tracking-[0.12em] opacity-70 mb-0.5">Buy Price</span>
              <span className="text-xl font-bold font-mono tabular-nums tracking-tighter">
                {price?.ask.toFixed(digits) || '--'}
              </span>
            </div>
          </div>

          <div className="text-center">
            <span className="text-xxs font-bold text-text-tertiary uppercase tracking-[0.2em] -mt-2 block">Spread: {spread.toFixed(1)} pips</span>
          </div>

          {/* Market/Pending Switch */}
          <Segmented
            fullWidth
            size="md"
            aria-label="Order type"
            value={orderType}
            onChange={setOrderType}
            options={[
              { value: 'market', label: 'Market' },
              { value: 'pending', label: 'Pending' },
            ]}
          />

          {/* Pending Specific Section */}
          {orderType === 'pending' && (
            <div className="space-y-4 animate-slide-down">
              <div className="space-y-2">
                <Caption>Order Type</Caption>
                <div className="grid grid-cols-2 gap-2">
                  {PENDING_SUBTYPES.map((t) => {
                    const active = pendingSubtype === t.id;
                    return (
                      <Button
                        key={t.id}
                        size="md"
                        variant={active ? (t.id.includes('buy') ? 'buy' : 'sell') : 'outline'}
                        aria-pressed={active}
                        onClick={() => setPendingSubtype(t.id)}
                        className="uppercase tracking-wide"
                      >
                        {t.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Caption>Entry Price</Caption>
                <Input
                  type="number"
                  inputMode="decimal"
                  size="lg"
                  numeric
                  placeholder="Enter price"
                  value={entryPrice}
                  onChange={(e) => setEntryPrice(e.target.value)}
                  className="font-bold"
                  aria-label="Entry price"
                  hint={
                    <span className="flex items-center justify-between gap-2 min-h-7">
                      <span className="font-mono tabular-nums truncate">{entryRule}</span>
                      {suggestedEntry > 0 && (
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => setEntryPrice(suggestedEntry.toFixed(digits))}
                          className="shrink-0 font-mono tabular-nums !text-xs"
                          aria-label={`Use ${suggestedEntry.toFixed(digits)} as the entry price`}
                        >
                          Use {suggestedEntry.toFixed(digits)}
                        </Button>
                      )}
                    </span>
                  }
                />
              </div>
            </div>
          )}

          {/* Volume Control */}
          <div className="space-y-2">
            <Caption>Volume (Lots)</Caption>
            <div className="flex items-center gap-3">
              <Button variant="secondary" size="lg" iconOnly onClick={() => handleAdjustLots(-0.01)} aria-label="Decrease volume">
                <Minus size={18} strokeWidth={3} aria-hidden />
              </Button>
              <div className="flex-1 min-w-0">
                <Input
                  type="text"
                  inputMode="decimal"
                  size="lg"
                  numeric
                  value={lotsInput}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === '' || /^\d*\.?\d*$/.test(raw)) {
                      setLotsInput(raw);
                      const v = parseFloat(raw);
                      if (Number.isFinite(v) && v > 0) setLots(v);
                    }
                  }}
                  onBlur={() => {
                    const v = parseFloat(lotsInput);
                    const safe = Number.isFinite(v) && v >= 0.01 ? parseFloat(v.toFixed(2)) : 0.01;
                    setLots(safe);
                    setLotsInput(safe.toString());
                  }}
                  className="text-center text-lg font-bold"
                  aria-label="Volume in lots"
                />
              </div>
              <Button variant="secondary" size="lg" iconOnly onClick={() => handleAdjustLots(0.01)} aria-label="Increase volume">
                <Plus size={18} strokeWidth={3} aria-hidden />
              </Button>
            </div>
            {/* Cost of the selected volume — parity with the desktop panel
                and the mobile app; red when free margin can't cover it. */}
            <div className="flex items-center justify-between mt-2 px-1">
              <span className="text-xxs font-bold text-text-tertiary uppercase tracking-[0.12em]">Margin Required</span>
              <span className={clsx('text-xs font-mono font-bold tabular-nums', hasEnoughMargin ? 'text-text-secondary' : 'text-danger')}>
                ≈ ${marginRequired.toFixed(2)}
                <span className="font-normal text-text-tertiary"> · Free ${freeMargin.toFixed(2)}</span>
              </span>
            </div>
          </div>

          {/* SL/TP Controls */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Caption>Stop Loss</Caption>
              <Input
                type="number"
                size="lg"
                numeric
                placeholder="Optional"
                value={sl}
                onChange={(e) => setSl(e.target.value)}
                className="text-center font-bold"
                aria-label="Stop loss"
              />
            </div>
            <div className="space-y-2">
              <Caption>Take Profit</Caption>
              <Input
                type="number"
                size="lg"
                numeric
                placeholder="Optional"
                value={tp}
                onChange={(e) => setTp(e.target.value)}
                className="text-center font-bold"
                aria-label="Take profit"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-3">
            {orderType === 'market' ? (
              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="sell"
                  size="lg"
                  fullWidth
                  disabled={submitting}
                  onClick={() => handlePlaceOrder('sell')}
                  className="!h-14 text-lg uppercase tracking-widest"
                >
                  Sell
                </Button>
                <Button
                  variant="buy"
                  size="lg"
                  fullWidth
                  disabled={submitting}
                  onClick={() => handlePlaceOrder('buy')}
                  className="!h-14 text-lg uppercase tracking-widest"
                >
                  Buy
                </Button>
              </div>
            ) : (
              <Button
                variant={canPlacePending ? 'primary' : 'secondary'}
                size="lg"
                fullWidth
                onClick={() => handlePlaceOrder()}
                disabled={!canPlacePending}
                className="!h-14 text-lg uppercase tracking-widest"
              >
                {submitting ? 'Placing…' : `Place ${pendingSubtype.replace('_', ' ')}`}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
