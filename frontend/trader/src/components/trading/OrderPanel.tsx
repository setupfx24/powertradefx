'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { Minus, Plus, X, ChevronDown, ChevronLeft, Wifi, WifiOff, Zap } from 'lucide-react';
import { useTradingStore, type TradingAccount } from '@/stores/tradingStore';
import { useUIStore } from '@/stores/uiStore';
import api from '@/lib/api/client';
import { sounds, unlockAudio } from '@/lib/sounds';
import { getDigits } from '@/lib/utils';
import { getMarketStatus } from '@/lib/marketHours';
import { quoteFreshness, staleQuoteMessage } from '@/lib/quoteStatus';
import { wsManager } from '@/lib/ws/wsManager';
import { Button, Input, Segmented } from '@/components/ui';
import OrderPanelSymbolPicker from '@/components/trading/OrderPanelSymbolPicker';
import SymbolIcon from '@/components/trading/SymbolIcon';

type OrderSide = 'buy' | 'sell';
type OrderType = 'market' | 'pending';
type PendingKind = 'limit' | 'stop' | 'stop_limit';

const ORDER_TAB_LABEL: Record<OrderType, string> = {
  market: 'Market',
  pending: 'Limit / Stop',
};
const PENDING_KINDS: readonly PendingKind[] = ['limit', 'stop', 'stop_limit'];
/** Quick-size chips: tap to set volume directly. */
const QUICK_LOTS = ['0.01', '0.1', '1.00', '10', '100'] as const;

/** MT5-style name for a pending order, e.g. "Buy Limit", "Sell Stop-Limit". */
function pendingKindLabel(side: 'buy' | 'sell', kind: PendingKind): string {
  const s = side === 'buy' ? 'Buy' : 'Sell';
  return kind === 'limit' ? `${s} Limit` : kind === 'stop' ? `${s} Stop` : `${s} Stop-Limit`;
}

/** Eyebrow caption used above every control in the ticket. */
function Caption({ children, tone = 'default', className }: { children: React.ReactNode; tone?: 'default' | 'danger' | 'success'; className?: string }) {
  return (
    <span
      className={clsx(
        'text-xxs font-semibold uppercase tracking-[0.12em]',
        tone === 'danger' ? 'text-danger' : tone === 'success' ? 'text-success' : 'text-text-tertiary',
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Inline warning line under the ticket (danger / warning tone). */
function Notice({ children, tone = 'danger', className }: { children: React.ReactNode; tone?: 'danger' | 'warning'; className?: string }) {
  return (
    <div className={clsx('text-xxs font-semibold text-center leading-tight', tone === 'danger' ? 'text-danger' : 'text-warning', className)}>
      {children}
    </div>
  );
}

/** Market-closed reason box. */
function ClosedBanner({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('rounded-md px-3 py-2 text-xs text-danger leading-snug text-center bg-danger/10 border border-danger/20', className)}>
      {children}
    </div>
  );
}

export default function OrderPanel({
  onOrderPlaced,
}: {
  /** Called right after an order is dispatched (validation passed) — hosts
   *  like the draggable window / mobile sheet close themselves on it. */
  onOrderPlaced?: () => void;
} = {}) {
  const pathname = usePathname();
  const isTradingTerminal = Boolean(pathname?.startsWith('/trading/terminal'));
  const {
    terminalMarketsOpen,
    toggleTerminalMarkets,
    oneClickTrading,
    setOneClickTrading,
  } = useUIStore();

  // Narrow selectors: the order ticket needs live `prices`, but selecting each
  // slice individually drops re-renders from unrelated store updates
  // (action references are stable in zustand).
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const setSelectedSymbol = useTradingStore((s) => s.setSelectedSymbol);
  const prices = useTradingStore((s) => s.prices);
  const instruments = useTradingStore((s) => s.instruments);
  const activeAccount = useTradingStore((s) => s.activeAccount);
  const positions = useTradingStore((s) => s.positions);
  const setPositions = useTradingStore((s) => s.setPositions);
  const refreshPositions = useTradingStore((s) => s.refreshPositions);
  const refreshAccount = useTradingStore((s) => s.refreshAccount);
  const orderFormCloneDraft = useTradingStore((s) => s.orderFormCloneDraft);
  const setOrderFormCloneDraft = useTradingStore((s) => s.setOrderFormCloneDraft);
  const setTerminalMarketsOpen = useUIStore((s) => s.setTerminalMarketsOpen);
  const setTerminalNewsOpen = useUIStore((s) => s.setTerminalNewsOpen);

  const [side, setSide] = useState<OrderSide>('buy');
  const [orderTab, setOrderTab] = useState<OrderType>('market');
  const [pendingKind, setPendingKind] = useState<PendingKind>('limit');
  const [triggerPrice, setTriggerPrice] = useState('');
  const [stopLimitPrice, setStopLimitPrice] = useState('');
  const [lots, setLots] = useState('0.01');
  const [slEnabled, setSlEnabled] = useState(false);
  const [tpEnabled, setTpEnabled] = useState(false);
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [symbolPickerOpen, setSymbolPickerOpen] = useState(false);
  const [wsStatus, setWsStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const tick = prices[selectedSymbol];
  const instrumentInfo = instruments.find((i) => i.symbol === selectedSymbol);
  const segment = (instrumentInfo as any)?.segment as string | undefined;
  const digits = getDigits(selectedSymbol);
  const contractSize = instrumentInfo?.contract_size || 100000;

  const marketStatus = useMemo(
    () => getMarketStatus(selectedSymbol, segment),
    [selectedSymbol, segment, Math.floor(Date.now() / 60_000)],
  );
  // Feed health for the selected symbol. 'stale' = market open but no live
  // tick (upstream feed down). The backend refuses orders on a stale quote,
  // so the panel says so up front instead of letting the click bounce.
  const feedStale = quoteFreshness(tick, marketStatus.isOpen) === 'stale';

  const bid = tick?.bid ?? 0;
  const ask = tick?.ask ?? 0;
  const execPrice = tick ? (side === 'buy' ? tick.ask : tick.bid) : 0;
  const lotsNum = parseFloat(lots) || 0;

  const marginRequired = useMemo(() => {
    if (!execPrice || !activeAccount) return 0;
    return (lotsNum * contractSize * execPrice) / activeAccount.leverage;
  }, [execPrice, lotsNum, activeAccount, contractSize]);

  const freeMargin = activeAccount?.free_margin || 0;
  const hasEnoughMargin = freeMargin >= marginRequired;

  // Account-tier minimum-balance gate (Micro $10 / Standard $100 /
  // Pro $500 / Elite $1000). Server rejects trades when
  // account.balance < group.minimum_deposit; mirror it client-side so
  // the Buy/Sell button visibly disables and the user reads the
  // requirement up-front instead of after tapping.
  const minDepositGate = activeAccount?.account_group?.minimum_deposit ?? 0;
  const accountBalance = activeAccount?.balance ?? 0;
  const meetsMinBalance = minDepositGate <= 0 || accountBalance >= minDepositGate;

  /** Pending tab requires a positive trigger price. Stop-limit also
   *  requires the second (limit/target) price. Side-vs-mid validity is
   *  enforced in handleSubmit so the button only blocks on simplest
   *  preconditions here. */
  const pendingTriggerValid = orderTab !== 'pending'
    ? true
    : (() => {
        const t = parseFloat(triggerPrice);
        if (!Number.isFinite(t) || t <= 0) return false;
        if (pendingKind === 'stop_limit') {
          const sl = parseFloat(stopLimitPrice);
          if (!Number.isFinite(sl) || sl <= 0) return false;
        }
        return true;
      })();

  /** Submit button wording: "Buy" at market, "Buy Limit" / "Sell Stop" …
   *  for pending; the price shown is the trigger the order will rest at,
   *  not the current quote. */
  const submitAction = orderTab === 'market'
    ? (side === 'buy' ? 'Buy' : 'Sell')
    : pendingKindLabel(side, pendingKind);
  const submitPrice = orderTab === 'market'
    ? execPrice
    : (() => { const t = parseFloat(triggerPrice); return Number.isFinite(t) && t > 0 ? t : 0; })();

  useEffect(() => {
    const unsub = wsManager.onStatusChange(setWsStatus);
    setWsStatus(wsManager.status);
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!orderFormCloneDraft) return;
    const d = orderFormCloneDraft;
    setSelectedSymbol(d.symbol);
    setSide(d.side);
    setLots(Math.max(0.01, Number(d.lots.toFixed(4))).toString());
    if (d.stop_loss != null && d.stop_loss !== undefined && !Number.isNaN(Number(d.stop_loss))) {
      setSlEnabled(true);
      setStopLoss(String(d.stop_loss));
    } else {
      setSlEnabled(false);
      setStopLoss('');
    }
    if (d.take_profit != null && d.take_profit !== undefined && !Number.isNaN(Number(d.take_profit))) {
      setTpEnabled(true);
      setTakeProfit(String(d.take_profit));
    } else {
      setTpEnabled(false);
      setTakeProfit('');
    }
    setOrderTab('market');
    setOrderFormCloneDraft(null);
    setTerminalMarketsOpen(false);
    setTerminalNewsOpen(false);
    toast.success('Order form filled — review and place');
  }, [orderFormCloneDraft, setSelectedSymbol, setOrderFormCloneDraft, setTerminalMarketsOpen, setTerminalNewsOpen]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setSymbolPickerOpen(false);
      }
    }
    if (symbolPickerOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [symbolPickerOpen]);

  // Auto-set SL/TP defaults
  useEffect(() => {
    if (slEnabled && !stopLoss && execPrice > 0) {
      setStopLoss((side === 'buy' ? execPrice * 0.99 : execPrice * 1.01).toFixed(digits));
    }
  }, [slEnabled]);

  useEffect(() => {
    if (tpEnabled && !takeProfit && execPrice > 0) {
      setTakeProfit((side === 'buy' ? execPrice * 1.02 : execPrice * 0.98).toFixed(digits));
    }
  }, [tpEnabled]);

  const adjustLots = (delta: number) => {
    setLots(Math.max(0.01, parseFloat((lotsNum + delta).toFixed(2))).toString());
  };

  // 1-second grace window after a click during which the button stays
  // visually stable (no opacity-flash to disabled) even if hasEnoughMargin
  // briefly flickers while the account refresh and the optimistic position
  // settle. Without this the button appeared to "disappear" for a second
  // after every trade.
  const justClickedRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [recentlyClicked, setRecentlyClicked] = useState(false);
  const markRecentlyClicked = () => {
    setRecentlyClicked(true);
    if (justClickedRef.current) clearTimeout(justClickedRef.current);
    justClickedRef.current = setTimeout(() => setRecentlyClicked(false), 1000);
  };

  const handleSubmit = async () => {
    unlockAudio();
    if (!activeAccount) return;
    markRecentlyClicked();
    if (orderTab === 'market' && !marketStatus.isOpen) {
      toast.error(marketStatus.reason || 'Market is closed');
      return;
    }
    if (orderTab === 'market' && feedStale) {
      toast.error(staleQuoteMessage(tick));
      return;
    }
    if (!hasEnoughMargin) {
      toast.error(`Insufficient margin`);
      return;
    }
    // Preflight the server-side "Account balance must be ≥ min_deposit
    // for this account type" gate (trading_service.py:141-150). Catching
    // it client-side means the user gets a clean toast IMMEDIATELY,
    // without the optimistic UI / "orderPlaced" sound / success message
    // racing the rejection.
    const minDeposit = activeAccount.account_group?.minimum_deposit ?? 0;
    if (minDeposit > 0 && (activeAccount.balance ?? 0) < minDeposit) {
      toast.error(`Minimum $${minDeposit.toFixed(0)} balance required for this account. Deposit funds first.`);
      return;
    }
    // Pending orders require a trigger price + must be on the correct
    // side of the current market (server re-validates but bail early so
    // the user gets a clear toast instead of a 400).
    let triggerPx: number | null = null;
    let stopLimitPx: number | null = null;
    if (orderTab === 'pending') {
      const t = parseFloat(triggerPrice);
      if (!Number.isFinite(t) || t <= 0) {
        toast.error('Enter a trigger price');
        return;
      }
      triggerPx = t;
      if (pendingKind === 'limit') {
        if (side === 'buy' && t >= ask) {
          toast.error(`Buy limit must be below ask (${ask.toFixed(digits)})`);
          return;
        }
        if (side === 'sell' && t <= bid) {
          toast.error(`Sell limit must be above bid (${bid.toFixed(digits)})`);
          return;
        }
      } else if (pendingKind === 'stop') {
        if (side === 'buy' && t <= ask) {
          toast.error(`Buy stop must be above ask (${ask.toFixed(digits)})`);
          return;
        }
        if (side === 'sell' && t >= bid) {
          toast.error(`Sell stop must be below bid (${bid.toFixed(digits)})`);
          return;
        }
      } else {
        // stop_limit — stop triggers the order, limit is the resulting
        // limit-order price. Backend rule: buy stop > ask AND limit < stop.
        const sl = parseFloat(stopLimitPrice);
        if (!Number.isFinite(sl) || sl <= 0) {
          toast.error('Enter a stop-limit (target) price');
          return;
        }
        stopLimitPx = sl;
        if (side === 'buy') {
          if (t <= ask) {
            toast.error(`Buy stop must be above ask (${ask.toFixed(digits)})`);
            return;
          }
          if (sl >= t) {
            toast.error('Buy stop-limit: limit price must be below the stop price');
            return;
          }
        } else {
          if (t >= bid) {
            toast.error(`Sell stop must be below bid (${bid.toFixed(digits)})`);
            return;
          }
          if (sl <= t) {
            toast.error('Sell stop-limit: limit price must be above the stop price');
            return;
          }
        }
      }
    }
    // Optimistic: instant feedback, API fires in background. Sound
    // plays NOW so the tap feels synchronous, but the toast.success
    // only fires after the API confirms — otherwise the user sees
    // "BUY 0.01 EURUSD" success even when the server rejects the
    // trade for insufficient balance, which is confusing.
    sounds.orderPlaced();

    // Only market orders hit the book immediately — show the position in
    // the panel without waiting for the API round-trip so the UI feels
    // synchronous with the tap.
    const optimisticId = `optim-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    let rollback: (() => void) | null = null;
    if (orderTab === 'market') {
      const nowIso = new Date().toISOString();
      const optimisticPos = {
        id: optimisticId,
        account_id: activeAccount.id,
        symbol: selectedSymbol,
        side,
        lots: lotsNum,
        open_price: execPrice,
        current_price: execPrice,
        stop_loss: slEnabled && stopLoss ? parseFloat(stopLoss) : undefined,
        take_profit: tpEnabled && takeProfit ? parseFloat(takeProfit) : undefined,
        swap: 0,
        commission: 0,
        profit: 0,
        trade_type: 'market',
        created_at: nowIso,
      } as (typeof positions)[number];
      const prev = positions;
      setPositions([optimisticPos, ...prev]);
      rollback = () => setPositions(prev);
    }

    api.post<{ id: string; position_id: string | null }>('/orders/', {
      account_id: activeAccount.id,
      symbol: selectedSymbol,
      order_type: orderTab === 'market' ? 'market' : pendingKind,
      price: orderTab === 'pending' && triggerPx != null ? triggerPx : undefined,
      stop_limit_price:
        orderTab === 'pending' && pendingKind === 'stop_limit' && stopLimitPx != null
          ? stopLimitPx
          : undefined,
      side,
      lots: lotsNum,
      stop_loss: slEnabled && stopLoss ? parseFloat(stopLoss) : undefined,
      take_profit: tpEnabled && takeProfit ? parseFloat(takeProfit) : undefined,
    }).then(async () => {
      // Confirm success only now — the request actually went through.
      toast.success(`${side.toUpperCase()} ${lotsNum} ${selectedSymbol}`);

      // Note: we no longer swap the optimistic row's id with the real
      // position_id here. The store's refreshPositions does that merge
      // by matching on (account_id, symbol, side, lots) and preserving
      // the optimistic React key, which is what actually prevents the
      // unmount/remount flicker. Swapping the id here would just churn
      // the key between this microtask and the next poll.

      // refreshAccount updates balance/margin numbers. refreshPositions
      // would tear down + rebuild the row we just swapped — skip it,
      // the periodic poll already syncs server-side fields without
      // remounting React rows.
      refreshAccount().catch(() => {});
    }).catch((e: any) => {
      if (rollback) rollback();
      toast.error(e.message || 'Order failed');
    });

    // Order is on its way (optimistic, same as the sound above) — let the
    // hosting window/sheet close so the chart is visible again. Failure
    // still surfaces via the global toast + optimistic-row rollback.
    onOrderPlaced?.();
  };

  const isConnected = wsStatus === 'connected';

  const pad = isTradingTerminal ? 'px-2 py-2 space-y-2' : 'p-4 space-y-4';
  const ctrl = isTradingTerminal ? 'sm' : 'md';
  const priceStep = execPrice > 100 ? 0.01 : 0.00001;
  const submitDisabled =
    !recentlyClicked &&
    (!hasEnoughMargin || !meetsMinBalance || !activeAccount || (orderTab === 'market' && (!marketStatus.isOpen || feedStale)) || !pendingTriggerValid);
  /** Quick-size chip that matches the typed volume (so "1" and "1.00" both light "1.00"). */
  const activeQuickLot = QUICK_LOTS.find((v) => parseFloat(v) === parseFloat(lots)) ?? '';

  const submitLabel = (
    <>
      {`${submitAction} ${lotsNum} ${selectedSymbol}`}
      {submitPrice > 0 && (
        <span className="ml-1.5 font-mono font-bold tabular-nums opacity-85 normal-case">
          @ {submitPrice.toFixed(digits)}
        </span>
      )}
    </>
  );

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-bg-base">
      {/* ═══ Header ═══ */}
      <div
        className={clsx('shrink-0 flex items-center justify-between border-b border-border-primary bg-bg-secondary', isTradingTerminal ? 'px-2 py-2' : 'px-4 py-2.5')}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <div className="relative flex items-center gap-1.5 min-w-0" ref={dropdownRef}>
            <SymbolIcon symbol={selectedSymbol} size={isTradingTerminal ? 16 : 18} />
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setSymbolPickerOpen((o) => !o)}
              aria-haspopup="listbox"
              aria-expanded={symbolPickerOpen}
              className="!px-1 font-mono min-w-0"
              rightIcon={
                <ChevronDown
                  size={isTradingTerminal ? 12 : 14}
                  className={clsx('text-text-tertiary shrink-0 transition-transform', symbolPickerOpen && 'rotate-180')}
                  aria-hidden
                />
              }
            >
              <span className={clsx('font-bold text-text-primary truncate', isTradingTerminal ? 'text-xs' : 'text-sm')}>
                {selectedSymbol}
              </span>
            </Button>
            {symbolPickerOpen && (
              <div className="absolute top-full left-0 z-50 w-64 mt-1 rounded-lg border border-border-primary shadow-lg bg-card overflow-hidden">
                <OrderPanelSymbolPicker
                  onPick={(sym) => {
                    setSelectedSymbol(sym);
                    setSymbolPickerOpen(false);
                  }}
                />
              </div>
            )}
          </div>
          {isTradingTerminal ? (
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="outline"
                size="xs"
                onClick={() => {
                  setSymbolPickerOpen(false);
                  toggleTerminalMarkets();
                }}
                aria-label={terminalMarketsOpen ? 'Hide markets' : 'Open markets'}
                aria-expanded={terminalMarketsOpen}
                className={clsx('uppercase tracking-wider !text-xxs', terminalMarketsOpen && 'text-accent border-accent/40')}
                leftIcon={
                  <ChevronLeft
                    className={clsx('w-3.5 h-3.5 transition-transform duration-200', terminalMarketsOpen && '-rotate-90')}
                    aria-hidden
                  />
                }
              >
                Markets
              </Button>
              <Button
                variant={oneClickTrading ? 'primary' : 'ghost'}
                size="sm"
                iconOnly
                title={oneClickTrading ? 'One-click trading on' : 'One-click trading off'}
                aria-label={oneClickTrading ? 'Disable one-click trading' : 'Enable one-click trading'}
                aria-pressed={oneClickTrading}
                onClick={() => setOneClickTrading(!oneClickTrading)}
              >
                <Zap size={15} strokeWidth={1.75} aria-hidden />
              </Button>
            </div>
          ) : null}
        </div>
        <div className="flex flex-col items-end shrink-0">
          <div className="flex items-center gap-1">
            <span
              className={clsx('text-xxs font-bold', !marketStatus.isOpen || feedStale ? 'text-warning' : 'text-success')}
              title={feedStale ? staleQuoteMessage(tick) : undefined}
            >
              {!marketStatus.isOpen ? 'CLOSED' : feedStale ? 'FEED OFFLINE' : 'OPEN'}
            </span>
            {isConnected ? (
              <Wifi size={isTradingTerminal ? 11 : 12} className="text-success" aria-label="Feed connected" />
            ) : (
              <WifiOff size={isTradingTerminal ? 11 : 12} className="text-warning" aria-label="Feed disconnected" />
            )}
          </div>
        </div>
      </div>

      {isTradingTerminal ? (
        <div className="h-px w-full shrink-0 bg-accent" aria-hidden />
      ) : null}

      <div
        className={clsx('flex-1 min-h-0 flex flex-col bg-bg-base', isTradingTerminal && 'overflow-hidden')}
      >
        <div
          className={clsx(
            'min-h-0',
            isTradingTerminal
              ? 'flex-1 overflow-y-auto overscroll-y-contain'
              : 'flex-1 overflow-y-auto min-h-0',
          )}
        >
          <div className={pad}>
          {/* Market / Limit-Stop tabs. The pending tab is labelled by what it
              contains (MT5 users look for "limit" / "stop", not "pending"). */}
          <Segmented
            fullWidth
            size={isTradingTerminal ? 'xs' : 'sm'}
            aria-label="Order type"
            value={orderTab}
            onChange={setOrderTab}
            options={(['market', 'pending'] as const).map((t) => ({ value: t, label: ORDER_TAB_LABEL[t] }))}
          />

          {/* Side selector — split ticket: two price cards joined by a live
              spread rail underneath (rail fades sell→buy with the pip cost
              pinned at the midpoint). The selected side tints its card. */}
          <div>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Side">
              <button
                type="button"
                role="radio"
                aria-checked={side === 'sell'}
                onClick={() => setSide('sell')}
                className={clsx(
                  'rounded-lg border flex flex-col items-start transition-colors duration-150 active:translate-y-px',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45',
                  isTradingTerminal ? 'px-3 py-2' : 'px-4 py-2.5',
                  side === 'sell'
                    ? 'border-sell bg-sell/15'
                    : 'border-border-primary bg-bg-secondary hover:border-sell/40',
                )}
              >
                <Caption tone={side === 'sell' ? 'danger' : 'default'} className="font-bold tracking-[0.16em]">Sell</Caption>
                <span className={clsx(
                  'font-mono font-bold tabular-nums',
                  isTradingTerminal ? 'text-base' : 'text-lg',
                  side === 'sell' ? 'text-sell' : 'text-text-primary',
                )}>
                  {tick ? tick.bid.toFixed(digits) : '---'}
                </span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={side === 'buy'}
                onClick={() => setSide('buy')}
                className={clsx(
                  'rounded-lg border flex flex-col items-end transition-colors duration-150 active:translate-y-px',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45',
                  isTradingTerminal ? 'px-3 py-2' : 'px-4 py-2.5',
                  side === 'buy'
                    ? 'border-buy bg-buy/15'
                    : 'border-border-primary bg-bg-secondary hover:border-buy/40',
                )}
              >
                <Caption tone={side === 'buy' ? 'success' : 'default'} className="font-bold tracking-[0.16em]">Buy</Caption>
                <span className={clsx(
                  'font-mono font-bold tabular-nums',
                  isTradingTerminal ? 'text-base' : 'text-lg',
                  side === 'buy' ? 'text-buy' : 'text-text-primary',
                )}>
                  {tick ? tick.ask.toFixed(digits) : '---'}
                </span>
              </button>
            </div>

            {/* spread rail */}
            {tick && (() => {
              const pipSize = instrumentInfo?.pip_size || 0.0001;
              const pips = tick.spread / pipSize;
              const pipsLabel = pips >= 100 ? pips.toFixed(0) : pips.toFixed(1);
              const priceDiff = tick.spread.toFixed(digits);
              return (
                <div className="relative h-6 mt-1" aria-hidden="true">
                  <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-px bg-gradient-to-r from-sell/55 via-border-primary to-buy/55" />
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-baseline gap-1 px-2 py-0.5 rounded-full border border-border-primary bg-card">
                    <span className="text-xxs font-bold uppercase tracking-[0.1em] text-text-tertiary">spread</span>
                    <span className="text-xxs font-mono font-bold tabular-nums text-text-primary">{pipsLabel}</span>
                    <span className="text-xxs font-mono text-text-tertiary tabular-nums">{priceDiff}</span>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* SL / TP — separate Add / Remove buttons. Click to toggle the
              corresponding input field below; visually distinct red (SL) /
              green (TP) chips so the trader can tell them apart at a glance. */}
          <div className={clsx('flex items-center flex-wrap', isTradingTerminal ? 'gap-2 pt-1' : 'gap-2 pt-2')}>
            <Button
              size="xs"
              variant={slEnabled ? 'danger' : 'outline'}
              onClick={() => { setSlEnabled((p) => !p); if (slEnabled) setStopLoss(''); }}
              title={slEnabled ? 'Remove Stop Loss' : 'Add Stop Loss'}
              aria-pressed={slEnabled}
              className="uppercase tracking-wider"
              leftIcon={slEnabled ? <X size={11} aria-hidden /> : <Plus size={11} aria-hidden />}
            >
              SL
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={() => { setTpEnabled((p) => !p); if (tpEnabled) setTakeProfit(''); }}
              title={tpEnabled ? 'Remove Take Profit' : 'Add Take Profit'}
              aria-pressed={tpEnabled}
              className={clsx('uppercase tracking-wider', tpEnabled && '!bg-success/10 !text-success !border-success/25 hover:!bg-success/20')}
              leftIcon={tpEnabled ? <X size={11} aria-hidden /> : <Plus size={11} aria-hidden />}
            >
              TP
            </Button>
            {activeAccount && (
              <LeveragePicker
                account={activeAccount}
                onChanged={() => { void refreshAccount(); }}
              />
            )}
          </div>

          {/* Volume */}
          <div className={isTradingTerminal ? 'pt-1' : 'pt-2'}>
            <div className={clsx('flex items-center justify-between', isTradingTerminal ? 'mb-1' : 'mb-1.5')}>
              <Caption>Volume</Caption>
              <div className="flex gap-0.5">
                <span className="px-1.5 py-0.5 rounded-sm text-xxs font-medium bg-bg-hover text-text-secondary">Lots</span>
                <span className="px-1.5 py-0.5 rounded-sm text-xxs font-medium text-text-tertiary hover:text-text-secondary cursor-pointer transition-colors">Units</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="secondary" size={ctrl} iconOnly onClick={() => adjustLots(-0.01)} aria-label="Decrease volume">
                <Minus size={isTradingTerminal ? 12 : 14} aria-hidden />
              </Button>
              <div className="flex-1 min-w-0">
                <Input
                  type="text"
                  inputMode="decimal"
                  size={ctrl}
                  numeric
                  value={lots}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) setLots(v);
                  }}
                  onBlur={() => {
                    const n = parseFloat(lots);
                    if (!Number.isFinite(n) || n <= 0) setLots('0.01');
                    else setLots(n.toFixed(2));
                  }}
                  className="text-center font-bold"
                  aria-label="Volume in lots"
                />
              </div>
              <Button variant="secondary" size={ctrl} iconOnly onClick={() => adjustLots(0.01)} aria-label="Increase volume">
                <Plus size={isTradingTerminal ? 12 : 14} aria-hidden />
              </Button>
            </div>
            {/* Quick-size chips: tap to set volume directly. */}
            <Segmented
              fullWidth
              size="xs"
              aria-label="Quick volume"
              className="mt-1.5 font-mono"
              value={activeQuickLot}
              onChange={(v) => setLots(v)}
              options={QUICK_LOTS.map((v) => ({ value: v as string, label: v }))}
            />
          </div>

          {/* Pending order — type toggle + trigger price (+ stop-limit
              target). Only renders on the Pending tab. */}
          {orderTab === 'pending' && (
            <div className="pt-2 space-y-2">
              <div>
                <Caption className="block mb-1.5">Pending type</Caption>
                <Segmented
                  fullWidth
                  size="xs"
                  aria-label="Pending order type"
                  value={pendingKind}
                  onChange={setPendingKind}
                  options={PENDING_KINDS.map((k) => ({ value: k, label: pendingKindLabel(side, k) }))}
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Caption>{pendingKind === 'stop_limit' ? 'Stop (trigger) price' : 'Trigger price'}</Caption>
                  <span className="text-xxs text-text-tertiary font-mono tabular-nums">
                    {pendingKind === 'limit'
                      ? side === 'buy'
                        ? `< ${ask.toFixed(digits)}`
                        : `> ${bid.toFixed(digits)}`
                      : side === 'buy'
                        ? `> ${ask.toFixed(digits)}`
                        : `< ${bid.toFixed(digits)}`}
                  </span>
                </div>
                <Input
                  type="number"
                  inputMode="decimal"
                  size={ctrl}
                  numeric
                  value={triggerPrice}
                  onChange={(e) => setTriggerPrice(e.target.value)}
                  step={priceStep}
                  placeholder={(
                    pendingKind === 'limit'
                      ? side === 'buy'
                        ? ask * 0.999
                        : bid * 1.001
                      : side === 'buy'
                        ? ask * 1.001
                        : bid * 0.999
                  ).toFixed(digits)}
                  aria-label={pendingKind === 'stop_limit' ? 'Stop (trigger) price' : 'Trigger price'}
                />
              </div>
              {/* Second price input only for stop-limit */}
              {pendingKind === 'stop_limit' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Caption>Limit (target) price</Caption>
                    <span className="text-xxs text-text-tertiary font-mono">
                      {side === 'buy' ? '< stop' : '> stop'}
                    </span>
                  </div>
                  <Input
                    type="number"
                    inputMode="decimal"
                    size={ctrl}
                    numeric
                    value={stopLimitPrice}
                    onChange={(e) => setStopLimitPrice(e.target.value)}
                    step={priceStep}
                    placeholder={
                      Number.isFinite(parseFloat(triggerPrice))
                        ? (
                            side === 'buy'
                              ? parseFloat(triggerPrice) * 0.999
                              : parseFloat(triggerPrice) * 1.001
                          ).toFixed(digits)
                        : '—'
                    }
                    aria-label="Limit (target) price"
                  />
                </div>
              )}
            </div>
          )}

          {/* SL input */}
          {slEnabled && (
            <div className="pt-2">
              <Caption tone="danger" className="font-bold mb-1.5 block">Stop Loss</Caption>
              <Input
                type="number"
                size={ctrl}
                numeric
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                step={priceStep}
                placeholder={`e.g. ${(execPrice * (side === 'buy' ? 0.99 : 1.01)).toFixed(digits)}`}
                className="!border-danger/40 !text-danger"
                aria-label="Stop loss price"
              />
            </div>
          )}

          {/* TP input */}
          {tpEnabled && (
            <div className="pt-2">
              <Caption tone="success" className="font-bold mb-1.5 block">Take Profit</Caption>
              <Input
                type="number"
                size={ctrl}
                numeric
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                step={priceStep}
                placeholder={`e.g. ${(execPrice * (side === 'buy' ? 1.02 : 0.98)).toFixed(digits)}`}
                className="!border-success/40 !text-success"
                aria-label="Take profit price"
              />
            </div>
          )}

          {!isTradingTerminal ? (
            <>
              <div className="py-2" />
              <div className="rounded-lg p-3 space-y-2 bg-bg-secondary border border-border-primary">
                {[
                  { label: 'Exec. Price', value: execPrice > 0 ? execPrice.toFixed(digits) : '—', tone: 'text-text-primary' },
                  { label: 'Margin Required', value: `$${marginRequired.toFixed(2)}`, tone: !hasEnoughMargin ? 'text-danger' : 'text-text-secondary' },
                  { label: 'Free Margin', value: `$${freeMargin.toFixed(2)}`, tone: !hasEnoughMargin ? 'text-danger' : 'text-success' },
                  { label: 'Feed', value: isConnected ? '● Connected' : '○ Disconnected', tone: isConnected ? 'text-success' : 'text-warning' },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-xs text-text-tertiary">{row.label}</span>
                    <span className={clsx('text-xs font-mono font-semibold tabular-nums', row.tone)}>{row.value}</span>
                  </div>
                ))}
                {!hasEnoughMargin && (
                  <Notice className="pt-2 mt-2 border-t border-danger/15 !text-xs font-bold">⚠ Insufficient margin</Notice>
                )}
                {hasEnoughMargin && !meetsMinBalance && (
                  <Notice className="pt-2 mt-2 border-t border-danger/15 !text-xs font-bold leading-snug">
                    ⚠ Minimum ${minDepositGate.toFixed(0)} balance required
                  </Notice>
                )}
              </div>
              <div className="py-2" />
              <Button
                variant={side}
                size="lg"
                fullWidth
                onClick={handleSubmit}
                disabled={submitDisabled}
                className="font-black tracking-wide uppercase"
              >
                {submitLabel}
              </Button>
              {orderTab === 'market' && (!marketStatus.isOpen || feedStale) && (
                <ClosedBanner className="mt-4">
                  {!marketStatus.isOpen ? marketStatus.reason : staleQuoteMessage(tick)}
                </ClosedBanner>
              )}
            </>
          ) : null}
          </div>
        </div>

        {isTradingTerminal ? (
          <div className="shrink-0 border-t border-border-primary bg-bg-secondary px-2 pt-2 pb-2 space-y-1.5">
            <div className="flex items-center justify-between py-1.5 px-2 rounded-md bg-card border border-border-primary">
              {/* Market orders show the required Margin here (the standalone
                  "Mrgn $.." line below was removed); pending orders keep the
                  Trigger price since that's the essential value to confirm. */}
              <span className="text-xxs text-text-tertiary">
                {orderTab === 'pending' ? 'Trigger' : 'Margin'}
              </span>
              <span className="text-xs font-mono font-semibold text-text-primary tabular-nums">
                {orderTab === 'pending'
                  ? (Number.isFinite(parseFloat(triggerPrice)) && parseFloat(triggerPrice) > 0
                      ? parseFloat(triggerPrice).toFixed(digits)
                      : '—')
                  : `$${marginRequired.toFixed(2)}`}
              </span>
            </div>
            <div className="flex items-center justify-between gap-1 px-1 text-xxs text-text-tertiary">
              <span className={clsx('shrink-0 font-mono tabular-nums', hasEnoughMargin ? 'text-text-secondary' : 'text-danger')}>
                Free ${freeMargin.toFixed(2)}
              </span>
              <span
                className={clsx('shrink-0 font-mono', isConnected ? 'text-success' : 'text-warning')}
                title={isConnected ? 'Feed connected' : 'Feed disconnected'}
              >
                {isConnected ? '●' : '○'}
              </span>
            </div>
            {!hasEnoughMargin && (
              <Notice>Insufficient margin</Notice>
            )}
            {hasEnoughMargin && !meetsMinBalance && (
              <Notice>Min ${minDepositGate.toFixed(0)} balance required</Notice>
            )}
            {orderTab === 'pending' && !pendingTriggerValid && hasEnoughMargin && meetsMinBalance && (
              <Notice tone="warning">Enter a trigger price to place the order</Notice>
            )}
            <Button
              variant={side}
              size="md"
              fullWidth
              onClick={handleSubmit}
              disabled={submitDisabled}
              className="font-black tracking-wide uppercase"
            >
              {submitLabel}
            </Button>
            {orderTab === 'market' && (!marketStatus.isOpen || feedStale) && (
              <ClosedBanner className="!px-2 !py-1 !text-xxs">
                {!marketStatus.isOpen ? marketStatus.reason : staleQuoteMessage(tick)}
              </ClosedBanner>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Dropdown that lets the trader lower their leverage to any preset value up to
 * the admin-set `account_group.leverage_default` ceiling. Persists the change
 * via PATCH /accounts/:id/leverage.
 */
function LeveragePicker({
  account,
  onChanged,
}: {
  account: TradingAccount;
  onChanged: () => void;
}) {
  const setActiveAccount = useTradingStore((s) => s.setActiveAccount);
  const positions = useTradingStore((s) => s.positions);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const maxLev = account.account_group?.leverage_default ?? account.leverage;
  const presets = useMemo(() => {
    const base = [1, 10, 25, 50, 100, 200, 300, 400, 500, 1000];
    const filtered = base.filter((v) => v <= maxLev);
    if (!filtered.includes(maxLev)) filtered.push(maxLev);
    return Array.from(new Set(filtered)).sort((a, b) => a - b);
  }, [maxLev]);

  // Backend blocks leverage changes when the account has open positions
  // (account_service.py:548-552). Mirror that on the client so the user
  // gets a clear locked indicator + tooltip BEFORE clicking, instead of
  // a generic toast after the API rejects them.
  const openOnThisAccount = positions.filter((p) => p.account_id === account.id).length;
  const locked = openOnThisAccount > 0;
  const lockReason = `You have ${openOnThisAccount} open position${openOnThisAccount === 1 ? '' : 's'} on this account. Close ${openOnThisAccount === 1 ? 'it' : 'them all'} to change leverage.`;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const apply = async (lev: number) => {
    if (lev === account.leverage) { setOpen(false); return; }
    setSaving(true);
    try {
      await api.patch(`/accounts/${account.id}/leverage`, { leverage: lev });
      // Optimistic local update so the pill reflects the new value immediately.
      setActiveAccount({ ...account, leverage: lev });
      toast.success(`Leverage set to 1:${lev}`);
      onChanged();
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not change leverage');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ml-auto relative" ref={ref}>
      <Button
        variant="ghost"
        size="xs"
        onClick={() => {
          if (locked) {
            toast(lockReason, { icon: '🔒', duration: 4000 });
            return;
          }
          setOpen((p) => !p);
        }}
        disabled={saving}
        aria-haspopup="listbox"
        aria-expanded={open && !locked}
        className={clsx('font-mono tabular-nums !text-xxs !px-1.5', locked && '!cursor-not-allowed text-text-tertiary')}
        title={locked ? lockReason : `Max 1:${maxLev} — click to change`}
        rightIcon={!locked ? <ChevronDown size={10} aria-hidden /> : undefined}
      >
        {locked && <span aria-hidden>🔒</span>}
        1:{account.leverage}
      </Button>
      {open && !locked && (
        <div className="absolute right-0 bottom-full mb-1 w-28 rounded-lg border border-border-primary bg-card shadow-lg py-1 z-[1000]" role="listbox">
          <div className="px-2 pb-1 pt-0.5 text-xxs uppercase tracking-[0.12em] text-text-tertiary font-bold border-b border-border-primary mb-1">
            Max 1:{maxLev}
          </div>
          <div className="max-h-[220px] overflow-y-auto">
            {presets.map((v) => (
              <button
                key={v}
                type="button"
                role="option"
                aria-selected={v === account.leverage}
                onClick={() => void apply(v)}
                className={clsx(
                  'w-full text-left px-2 py-1 text-xs font-mono tabular-nums transition-colors',
                  v === account.leverage
                    ? 'bg-accent/15 text-accent font-bold'
                    : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
                )}
              >
                1:{v}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
