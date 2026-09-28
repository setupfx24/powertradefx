'use client';

import Link from 'next/link';
import Image from 'next/image';

import { useEffect, useState, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { clsx } from 'clsx';
import { CandlestickChart, List, Minimize2, Minus, Plus, Search, X } from 'lucide-react';
import { Badge, Button, EmptyState, Input } from '@/components/ui';
import { useUIStore } from '@/stores/uiStore';
import { TERMINAL_RESIZE, maxBottomPanelHeightPx } from '@/lib/terminalLayout';
import PanelResizeHandle from '@/components/trading/PanelResizeHandle';
import { useTradingStore, InstrumentInfo } from '@/stores/tradingStore';
import toast from 'react-hot-toast';
import { sounds, unlockAudio } from '@/lib/sounds';
import { getMarketStatus } from '@/lib/marketHours';
import { setPersistedTradingAccountId, tradingTerminalUrl } from '@/lib/tradingNav';
import { wsManager } from '@/lib/ws/wsManager';
import Watchlist from '@/components/trading/Watchlist';
import InstrumentsTable from '@/components/trading/InstrumentsTable';
import DraggableOrderModal from '@/components/trading/DraggableOrderModal';
import OrderPanel from '@/components/trading/OrderPanel';
import RiskCalculator from '@/components/trading/RiskCalculator';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import PositionsPanel from '@/components/trading/PositionsPanel';
import { ActiveAccountBadge } from '@/components/trading/ActiveAccountBadge';
import TerminalLeftRail, { type TerminalSpaceId } from '@/components/trading/TerminalLeftRail';

const TradingViewChart = dynamic(() => import('@/components/charts/TradingViewChart'), { ssr: false });
import { ChartErrorBoundary } from '@/components/charts/ChartErrorBoundary';
const TradingViewNewsTimeline = dynamic(() => import('@/components/charts/TradingViewNewsTimeline'), {
  ssr: false,
});

const ORDER_MIN = 250;
const ORDER_MAX = 560;
const MARKETS_MIN = 440;
const MARKETS_MAX = 1200;
const BOTTOM_MIN = 160;

export default function TradingTerminalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const accountId = searchParams.get('account');
  const {
    orderPanelWidth,
    bottomPanelHeight,
    terminalMarketsOpen,
    terminalNewsOpen,
    setTerminalMarketsOpen,
    setTerminalNewsOpen,
    setOrderPanelWidth,
    setBottomPanelHeight,
    toggleTerminalMarkets,
  } = useUIStore();

  useDocumentTitle();

  const [opW, setOpW] = useState(orderPanelWidth);
  const [bpH, setBpH] = useState(bottomPanelHeight);
  const [isMobile, setIsMobile] = useState(false);

  /** Snapshot at pointer-down: stable clamps while store updates mid-drag. */
  const layoutDragStartRef = useRef({ op: 0, bp: 0, vw: 0, colH: 0 });
  const centerColumnRef = useRef<HTMLDivElement>(null);
  const bottomRestoreRef = useRef(320);
  const [activeSpace, setActiveSpace] = useState<TerminalSpaceId>('balanced');
  const [bottomCollapsed, setBottomCollapsed] = useState(false);
  const [chartExpanded, setChartExpanded] = useState(false);
  // Stable so the memoized chart isn't re-rendered every tick.
  const enterFullscreen = useCallback(() => setChartExpanded(true), []);
  const [terminalCalcOpen, setTerminalCalcOpen] = useState(false);
  // The Buy/Sell order panel now lives in a movable floating window instead
  // of a pinned right column, so the chart can be full-width.
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const openOrderModal = useCallback(() => setOrderModalOpen(true), []);

  const snapshotLayout = useCallback(() => {
    const s = useUIStore.getState();
    const rect = centerColumnRef.current?.getBoundingClientRect();
    const col =
      rect?.height ??
      (typeof window !== 'undefined' ? window.innerHeight - 8 : 0);
    layoutDragStartRef.current = {
      op: s.orderPanelWidth,
      bp: s.bottomPanelHeight,
      vw: typeof window !== 'undefined' ? window.innerWidth : 0,
      colH: Math.max(120, col),
    };
  }, []);

  /** Between chart and order+markets rail: drag right widens the rail. */
  const onChartRailDrag = useCallback(
    (dx: number) => {
      const { op, vw } = layoutDragStartRef.current;
      const hardMax = terminalMarketsOpen ? MARKETS_MAX : ORDER_MAX;
      const hardMin = terminalMarketsOpen ? MARKETS_MIN : ORDER_MIN;
      const maxOp = Math.min(
        hardMax,
        vw - TERMINAL_RESIZE.handlesSlack - TERMINAL_RESIZE.chartMinWidth,
      );
      const next = Math.max(hardMin, Math.min(maxOp, op - dx));
      setOpW(next);
      setOrderPanelWidth(next);
    },
    [setOrderPanelWidth, terminalMarketsOpen],
  );

  const onBottomDrag = useCallback(
    (dy: number) => {
      const { bp, colH } = layoutDragStartRef.current;
      const maxBp = maxBottomPanelHeightPx(colH);
      const next = Math.max(BOTTOM_MIN, Math.min(maxBp, bp - dy));
      setBpH(next);
      setBottomPanelHeight(next);
    },
    [setBottomPanelHeight],
  );

  useEffect(() => {
    setOpW(orderPanelWidth);
  }, [orderPanelWidth]);

  /** Auto-size the right rail when switching to/from Markets view. */
  const orderWidthBeforeMarketsRef = useRef<number | null>(null);
  useEffect(() => {
    if (terminalMarketsOpen) {
      if (orderWidthBeforeMarketsRef.current == null) {
        orderWidthBeforeMarketsRef.current = opW;
      }
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1600;
      const target = Math.min(MARKETS_MAX, Math.max(MARKETS_MIN, Math.round(vw * 0.4)));
      setOpW(target);
      setOrderPanelWidth(target);
    } else if (orderWidthBeforeMarketsRef.current != null) {
      const restored = orderWidthBeforeMarketsRef.current;
      orderWidthBeforeMarketsRef.current = null;
      setOpW(restored);
      setOrderPanelWidth(restored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminalMarketsOpen]);

  useEffect(() => {
    setBpH(bottomPanelHeight);
  }, [bottomPanelHeight]);

  useEffect(() => {
    if (!bottomCollapsed) bottomRestoreRef.current = bottomPanelHeight;
  }, [bottomPanelHeight, bottomCollapsed]);

  const applySpace = useCallback(
    (id: TerminalSpaceId) => {
      setActiveSpace(id);
      setBottomCollapsed(false);
      if (id === 'balanced') {
        setOrderPanelWidth(340);
        setOpW(340);
        setBottomPanelHeight(320);
        setBpH(320);
      } else if (id === 'chart') {
        setOrderPanelWidth(ORDER_MIN);
        setOpW(ORDER_MIN);
        setBottomPanelHeight(200);
        setBpH(200);
      } else {
        setOrderPanelWidth(480);
        setOpW(480);
        setBottomPanelHeight(360);
        setBpH(360);
      }
    },
    [setOrderPanelWidth, setBottomPanelHeight],
  );

  const onToggleBottomPanel = useCallback(() => {
    const s = useUIStore.getState();
    if (bottomCollapsed) {
      const h = Math.max(BOTTOM_MIN, bottomRestoreRef.current);
      setBottomPanelHeight(h);
      setBpH(h);
      setBottomCollapsed(false);
    } else {
      bottomRestoreRef.current = s.bottomPanelHeight;
      setBottomPanelHeight(BOTTOM_MIN);
      setBpH(BOTTOM_MIN);
      setBottomCollapsed(true);
    }
  }, [bottomCollapsed, setBottomPanelHeight]);

  const onFocusSymbolSearch = useCallback(() => {
    setTerminalNewsOpen(false);
    setTerminalMarketsOpen(true);
    setChartExpanded(false);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.querySelector<HTMLInputElement>('[data-terminal-symbol-search]')?.focus();
      });
    });
  }, [setTerminalMarketsOpen, setTerminalNewsOpen]);

  // Rail panel buttons are TOGGLES — clicking an already-active panel
  // closes back to the "Order" default. Previously each handler only
  // set its own panel ON, so users got stuck in News / Chart focus /
  // Calc with no way to leave from the rail itself.
  const resetAllPanels = useCallback(() => {
    setTerminalMarketsOpen(false);
    setTerminalNewsOpen(false);
    setChartExpanded(false);
    setTerminalCalcOpen(false);
  }, [setTerminalMarketsOpen, setTerminalNewsOpen]);

  const onPanelsSelectMarkets = useCallback(() => {
    if (terminalMarketsOpen && !terminalNewsOpen && !chartExpanded && !terminalCalcOpen) {
      resetAllPanels();
      return;
    }
    setTerminalNewsOpen(false);
    setChartExpanded(false);
    setTerminalCalcOpen(false);
    setTerminalMarketsOpen(true);
  }, [terminalMarketsOpen, terminalNewsOpen, chartExpanded, terminalCalcOpen, setTerminalMarketsOpen, setTerminalNewsOpen, resetAllPanels]);

  const onPanelsSelectOrder = useCallback(() => {
    // The order panel is a floating window now — the rail's "Order" button
    // closes any side panel and pops the order window.
    resetAllPanels();
    openOrderModal();
  }, [resetAllPanels, openOrderModal]);

  const onExpandFullChartFromRail = useCallback(() => {
    if (chartExpanded) {
      resetAllPanels();
      return;
    }
    setTerminalNewsOpen(false);
    setTerminalMarketsOpen(false);
    setTerminalCalcOpen(false);
    setChartExpanded(true);
  }, [chartExpanded, setTerminalMarketsOpen, setTerminalNewsOpen, resetAllPanels]);

  const onPanelsSelectNews = useCallback(() => {
    if (terminalNewsOpen && !chartExpanded) {
      resetAllPanels();
      return;
    }
    setChartExpanded(false);
    setTerminalCalcOpen(false);
    setTerminalNewsOpen(true);
  }, [terminalNewsOpen, chartExpanded, setTerminalNewsOpen, resetAllPanels]);

  const onPanelsSelectCalc = useCallback(() => {
    if (terminalCalcOpen && !chartExpanded && !terminalNewsOpen) {
      resetAllPanels();
      return;
    }
    setTerminalNewsOpen(false);
    setChartExpanded(false);
    setTerminalMarketsOpen(false);
    setTerminalCalcOpen(true);
  }, [terminalCalcOpen, terminalNewsOpen, chartExpanded, setTerminalMarketsOpen, setTerminalNewsOpen, resetAllPanels]);
  const [lotSize, setLotSize] = useState('0.01');
  const [chartTabs, setChartTabs] = useState<string[]>([]);
  // orderSubmitting removed — MT5-style: never block rapid-fire clicks
  const [mobileSymbolSearch, setMobileSymbolSearch] = useState(false);
  // Full order ticket (market + limit/stop/stop-limit + SL/TP) as a
  // full-screen sheet — the quick bar below only does market orders.
  const [mobileOrderTicket, setMobileOrderTicket] = useState(false);
  const [mobileSearchQuery, setMobileSearchQuery] = useState('');
  const mobileSearchRef = useRef<HTMLInputElement>(null);

  // Narrow selectors: only re-render on the slices this page actually reads
  // (action references are stable in zustand, so selecting them is free).
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const prices = useTradingStore((s) => s.prices);
  const instruments = useTradingStore((s) => s.instruments);
  const setSelectedSymbol = useTradingStore((s) => s.setSelectedSymbol);
  const activeAccount = useTradingStore((s) => s.activeAccount);
  const placeOrder = useTradingStore((s) => s.placeOrder);

  const instrumentInfo = instruments.find((i: InstrumentInfo) => i.symbol === selectedSymbol);
  const mobileMarketStatus = getMarketStatus(selectedSymbol, (instrumentInfo as any)?.segment);
  /** Default `chart` so Trade opens chart + buy/sell (not symbol list only). Watchlist tab still passes view=watchlist. */
  // Whitelist the view param — an unknown value (stale link/bookmark) must
  // fall back to the chart instead of rendering a blank screen.
  const rawMobileView = searchParams.get('view');
  const mobileView =
    rawMobileView && ['watchlist', 'chart', 'order', 'news'].includes(rawMobileView)
      ? rawMobileView
      : 'chart';

  useEffect(() => {
    if (accountId) {
      setPersistedTradingAccountId(accountId);
      // Pin the price stream to this account so account-specific
      // per-user spread overrides show in the quotes.
      wsManager.setActiveAccount(accountId);
    }
  }, [accountId]);

  useEffect(() => {
    if (!accountId) router.replace('/trading');
  }, [accountId, router]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (!chartExpanded || !isMobile) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [chartExpanded, isMobile]);

  useEffect(() => {
    if (!chartExpanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setChartExpanded(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [chartExpanded]);

  // Sync selected symbol with tabs — use functional update to avoid stale closure duplicates
  useEffect(() => {
    if (selectedSymbol) {
      setChartTabs(prev => prev.includes(selectedSymbol) ? prev : [...prev, selectedSymbol]);
    }
  }, [selectedSymbol]);

  const removeTab = (e: React.MouseEvent, symbol: string) => {
    e.stopPropagation();
    const nextTabs = chartTabs.filter(s => s !== symbol);
    setChartTabs(nextTabs);
    if (selectedSymbol === symbol && nextTabs.length > 0) {
      // nextTabs[last] safe inside length>0 guard.
      setSelectedSymbol(nextTabs[nextTabs.length - 1]!);
    }
  };

  if (!accountId) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-0 bg-bg-base">
        <p className="text-sm text-text-tertiary">Choose an account to trade…</p>
      </div>
    );
  }

  if (isMobile) {
    const digits = instruments.find((i: InstrumentInfo) => i.symbol === selectedSymbol)?.digits ?? 5;
    const price = prices[selectedSymbol];

    const handleLotChange = (val: number) => {
      const current = parseFloat(lotSize) || 0;
      const next = Math.max(0.01, +(current + val).toFixed(2));
      setLotSize(next.toFixed(2));
    };

    const placeMarketOrder = (side: 'buy' | 'sell') => {
      unlockAudio();
      if (!activeAccount) {
        toast.error('No account selected');
        return;
      }
      if (!mobileMarketStatus.isOpen) {
        toast.error(mobileMarketStatus.reason || 'Market is closed');
        return;
      }
      if (!selectedSymbol?.trim()) {
        toast.error('Select a symbol');
        return;
      }
      const lots = parseFloat(lotSize);
      if (!Number.isFinite(lots) || lots <= 0) {
        toast.error('Invalid lot size');
        return;
      }
      // MT5-style: instant sound + optimistic position, no button disable
      sounds.orderPlaced();
      toast.success(`${side.toUpperCase()} ${lotSize} ${selectedSymbol}`, { duration: 1500 });
      placeOrder({
        account_id: activeAccount.id,
        symbol: selectedSymbol,
        side,
        order_type: 'market',
        lots,
      })
        .then(() => {
          // After a trade is placed on mobile, jump straight to the
          // "Trades" view so the trader immediately sees the new (and all
          // other) open positions — the panel there is scrollable.
          if (accountId) {
            router.push(tradingTerminalUrl(accountId, { view: 'order' }));
          }
        })
        .catch((e: unknown) => {
          toast.error(e instanceof Error ? e.message : 'Order failed');
        });
    };

    /** Mobile sub-view header: back-to-chart link, centred title, spacer. */
    const mobileViewHeader = (title: string) => (
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-border-primary bg-bg-secondary">
        <Button variant="link" size="xs" onClick={() => router.push(tradingTerminalUrl(accountId, { view: 'chart' }))}>
          ← Chart
        </Button>
        <span className="text-xs font-bold text-text-primary uppercase tracking-wider">{title}</span>
        <span className="w-14" aria-hidden />
      </div>
    );

    return (
      <div
        className={clsx(
          'flex-1 flex flex-col overflow-hidden min-h-0 scrollbar-none bg-bg-base',
          // Only the chart view has the fixed Sell/Lots/Buy bar at the bottom;
          // reserving the space in the other views just leaves a dead band.
          mobileView === 'chart'
            ? 'pb-[calc(64px+env(safe-area-inset-bottom,0px))]'
            : 'pb-[env(safe-area-inset-bottom,0px)]',
        )}
      >
        {/* Slim mobile home bar — the legacy top navbar was deleted in the
            shell unification; the terminal only needs a way back home. */}
        <div className="lg:hidden flex items-center gap-2 px-3 h-11 border-b border-border-primary bg-bg-secondary shrink-0">
          <Link href="/dashboard" aria-label="Back to dashboard" className="flex items-center gap-2">
            <Image src="/marketing/powertradefx_fevicon.png" alt="" width={22} height={22} className="rounded-md" />
            <span className="text-sm font-semibold text-text-primary">Dashboard</span>
          </Link>
        </div>
        <div className="flex-1 min-h-0 overflow-hidden relative flex flex-col scrollbar-none">
          {mobileView === 'watchlist' && <Watchlist />}
          {mobileView === 'news' && (
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-bg-base">
              {mobileViewHeader('Live news')}
              <div className="flex-1 min-h-0">
                <TradingViewNewsTimeline />
              </div>
            </div>
          )}
          {mobileView === 'chart' && (
            <div className="h-full flex flex-col min-h-0">
              {/* Dynamic Chart Tabs Header */}
              {!chartExpanded ? (
              <div className="flex items-center gap-1.5 px-3 py-2 bg-bg-secondary border-b border-border-primary overflow-x-auto no-scrollbar scrollbar-none">
                {chartTabs.map((symbol) => (
                  <button
                    key={symbol}
                    type="button"
                    onClick={() => setSelectedSymbol(symbol)}
                    aria-current={symbol === selectedSymbol ? 'true' : undefined}
                    className={clsx(
                      'h-8 px-3 rounded-md text-xs font-bold font-mono transition-colors border whitespace-nowrap flex items-center gap-2 group',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45',
                      symbol === selectedSymbol
                        ? 'bg-card text-text-primary border-border-primary shadow-sm'
                        : 'bg-transparent text-text-tertiary border-transparent hover:text-text-primary'
                    )}
                  >
                    {symbol}
                    <span
                      role="button"
                      aria-label={`Close ${symbol} tab`}
                      onClick={(e) => removeTab(e, symbol)}
                      className="p-0.5 rounded-sm hover:bg-danger/10 hover:text-danger transition-colors opacity-60 group-hover:opacity-100"
                    >
                      <X className="w-3.5 h-3.5" strokeWidth={3} aria-hidden />
                    </span>
                  </button>
                ))}

                <Button
                  variant="secondary"
                  size="sm"
                  iconOnly
                  onClick={() => { setMobileSymbolSearch(true); setMobileSearchQuery(''); setTimeout(() => mobileSearchRef.current?.focus(), 100); }}
                  aria-label="Add symbol"
                  className="shrink-0"
                >
                  <Plus className="w-5 h-5" strokeWidth={2.5} aria-hidden />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push(tradingTerminalUrl(accountId, { view: 'news' }))}
                  className="shrink-0 uppercase tracking-wide !text-xxs"
                >
                  News
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => router.push(tradingTerminalUrl(accountId, { view: 'order' }))}
                  className="shrink-0 uppercase tracking-wide !text-xxs"
                  title="Open positions, pending orders, history"
                >
                  Trades
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setMobileOrderTicket(true)}
                  className="shrink-0 uppercase tracking-wide !text-xxs"
                  title="Full order ticket — market, limit, stop, SL/TP"
                >
                  New order
                </Button>
              </div>
              ) : null}

              {/* ── Full order ticket sheet (pending orders + SL/TP) ── */}
              {mobileOrderTicket && (
                <div className="fixed inset-0 z-[95] flex flex-col bg-bg-base" role="dialog" aria-modal="true" aria-label="New order">
                  <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-border-primary bg-bg-secondary">
                    <span className="text-xs font-bold text-text-primary uppercase tracking-wider">New order</span>
                    <Button
                      variant="ghost"
                      size="md"
                      iconOnly
                      onClick={() => setMobileOrderTicket(false)}
                      aria-label="Close order ticket"
                      className="-mr-1"
                    >
                      <X className="w-5 h-5" aria-hidden />
                    </Button>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto pb-[env(safe-area-inset-bottom,0px)]">
                    <OrderPanel onOrderPlaced={() => setMobileOrderTicket(false)} />
                  </div>
                </div>
              )}

              {/* ── Mobile Symbol Search Overlay ── */}
              {mobileSymbolSearch && (
                <div className="fixed inset-0 z-[90] flex flex-col bg-bg-base" role="dialog" aria-modal="true" aria-label="Search symbol">
                  {/* Search header */}
                  <div className="shrink-0 flex items-center gap-2 px-3 py-3 border-b border-border-primary bg-bg-secondary">
                    <div className="flex-1 min-w-0">
                      <Input
                        ref={mobileSearchRef}
                        type="text"
                        icon={<Search aria-hidden />}
                        value={mobileSearchQuery}
                        onChange={(e) => setMobileSearchQuery(e.target.value)}
                        placeholder="Search symbol..."
                        aria-label="Search symbol"
                      />
                    </div>
                    <Button variant="ghost" size="md" onClick={() => setMobileSymbolSearch(false)} className="shrink-0">
                      Cancel
                    </Button>
                  </div>

                  {/* Filtered instrument list */}
                  <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none">
                    {(() => {
                      const q = mobileSearchQuery.toLowerCase().trim();
                      const matched = instruments.filter((inst: InstrumentInfo) =>
                        q === '' ? true : inst.symbol.toLowerCase().includes(q) || (inst.segment || '').toLowerCase().includes(q)
                      );
                      if (matched.length === 0 && q !== '') {
                        return (
                          <EmptyState
                            icon={<Search />}
                            title="No symbols match"
                            description={<>No symbols match &ldquo;{mobileSearchQuery}&rdquo;</>}
                          />
                        );
                      }
                      return matched.map((inst: InstrumentInfo) => {
                        const tick = prices[inst.symbol];
                        const isInTabs = chartTabs.includes(inst.symbol);
                        return (
                          <button
                            key={inst.symbol}
                            type="button"
                            onClick={() => {
                              setSelectedSymbol(inst.symbol);
                              setChartTabs(prev => prev.includes(inst.symbol) ? prev : [...prev, inst.symbol]);
                              setMobileSymbolSearch(false);
                            }}
                            className={clsx(
                              'w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors border-b border-border-secondary',
                              isInTabs ? 'bg-accent/10' : 'hover:bg-bg-hover active:bg-bg-active',
                            )}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-base font-bold text-text-primary font-mono">{inst.symbol}</span>
                                {isInTabs && <Badge variant="accent" size="sm">Open</Badge>}
                              </div>
                              <p className="text-xs text-text-tertiary mt-0.5 truncate uppercase tracking-wide">
                                {inst.segment || ''}
                              </p>
                            </div>
                            <div className="shrink-0 flex items-center gap-3">
                              {tick ? (
                                <span className="text-sm font-mono font-bold tabular-nums text-text-primary">
                                  {tick.bid.toFixed(inst.digits ?? 5)}
                                </span>
                              ) : null}
                              {!isInTabs && (
                                <span className="text-accent text-xs font-semibold">+ Open</span>
                              )}
                            </div>
                          </button>
                        );
                      });
                    })()}
                  </div>
                </div>
              )}

              {!chartExpanded && activeAccount ? (
                <div className="sm:hidden shrink-0 px-3 py-1.5 border-b border-border-primary bg-bg-secondary">
                  <ActiveAccountBadge account={activeAccount} variant="compact" />
                </div>
              ) : null}

              <div
                className={clsx(
                  'flex flex-col flex-1 min-h-0 overflow-hidden bg-bg-base',
                  chartExpanded &&
                    'fixed inset-0 z-[100] h-[100dvh] pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]',
                )}
              >
                {chartExpanded ? (
                  <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-border-primary bg-bg-secondary">
                    <span className="text-sm font-bold text-text-primary truncate font-mono">{selectedSymbol || 'Chart'}</span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setChartExpanded(false)}
                      leftIcon={<Minimize2 className="w-4 h-4 shrink-0" aria-hidden />}
                    >
                      Close
                    </Button>
                  </div>
                ) : null}
                <div className="flex-1 min-h-0 min-w-0 overflow-hidden relative">
                  <ChartErrorBoundary>
                    {/* The mobile terminal has its own fixed Sell/Lots/Buy bar
                        below the chart — the on-chart quick-trade widget would
                        duplicate it and overlap the OHLC legend at 390px. */}
                    <TradingViewChart showTradeWidget={false} />
                  </ChartErrorBoundary>
                </div>
              </div>

              {/* Refined Quick Trade Bottom Bar */}
              <div className="fixed bottom-0 left-0 right-0 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] bg-bg-glass backdrop-blur-glass border-t border-border-primary z-50">
                {!mobileMarketStatus.isOpen && (
                  <div className="mb-2 flex items-center gap-2 px-3 py-1.5 rounded-md bg-danger/10 border border-danger/20">
                    <span className="text-xxs font-bold text-danger uppercase tracking-wider">● CLOSED</span>
                    <span className="text-xxs text-danger truncate">{mobileMarketStatus.reason}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 mt-1 h-[52px]">
                   {/* SELL button — two-line content (side + live bid), so
                       the height is forced to fill the bar. */}
                   <Button
                     variant="sell"
                     size="lg"
                     disabled={!mobileMarketStatus.isOpen}
                     onClick={() => placeMarketOrder('sell')}
                     className="flex-1 !h-full flex-col !gap-0 min-w-0 uppercase tracking-[0.05em] font-black"
                   >
                     <span className="text-md leading-tight">Sell</span>
                     <span className="text-xxs font-mono font-bold leading-tight opacity-70 normal-case tracking-normal">{price?.bid.toFixed(digits) || '--'}</span>
                   </Button>

                   {/* Lot size controls — center */}
                   <div className="shrink-0 flex flex-col items-center">
                      <span className="text-xxs font-bold text-text-tertiary uppercase tracking-wider leading-none mb-1">Lots</span>
                      <div className="flex items-center gap-1">
                         <Button variant="secondary" size="sm" iconOnly onClick={() => handleLotChange(-0.01)} aria-label="Decrease lots">
                            <Minus className="w-3.5 h-3.5" strokeWidth={3} aria-hidden />
                         </Button>
                         <div className="w-16">
                           <Input
                             type="text"
                             inputMode="decimal"
                             size="md"
                             numeric
                             value={lotSize}
                             onChange={(e) => {
                               const v = e.target.value;
                               if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) setLotSize(v);
                             }}
                             onBlur={() => {
                               const n = parseFloat(lotSize);
                               if (!Number.isFinite(n) || n <= 0) setLotSize('0.01');
                               else setLotSize(n.toFixed(2));
                             }}
                             className="text-center font-bold !px-1"
                             aria-label="Lot size"
                           />
                         </div>
                         <Button variant="secondary" size="sm" iconOnly onClick={() => handleLotChange(0.01)} aria-label="Increase lots">
                            <Plus className="w-3.5 h-3.5" strokeWidth={3} aria-hidden />
                         </Button>
                      </div>
                   </div>

                   {/* BUY button */}
                   <Button
                     variant="buy"
                     size="lg"
                     disabled={!mobileMarketStatus.isOpen}
                     onClick={() => placeMarketOrder('buy')}
                     className="flex-1 !h-full flex-col !gap-0 min-w-0 uppercase tracking-[0.05em] font-black"
                   >
                     <span className="text-md leading-tight">Buy</span>
                     <span className="text-xxs font-mono font-bold leading-tight opacity-70 normal-case tracking-normal">{price?.ask.toFixed(digits) || '--'}</span>
                   </Button>
                </div>
              </div>
            </div>
          )}
          {mobileView === 'order' && (
            <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-bg-base">
              {mobileViewHeader('Trades')}
              <div className="flex-1 min-h-0 overflow-auto">
                <PositionsPanel />
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // The right column now hosts ONLY the Markets / News / Risk-Calculator
  // panels. When none is open it collapses so the chart is full-width; the
  // order panel is no longer here (it's the floating DraggableOrderModal).
  const rightPanelOpen = terminalMarketsOpen || terminalNewsOpen || terminalCalcOpen;

  return (
    <div className="flex-1 flex overflow-hidden min-h-0 relative pt-[env(safe-area-inset-top,0px)] bg-bg-base">
      <TerminalLeftRail
        activeSpace={activeSpace}
        onSpaceChange={applySpace}
        terminalMarketsOpen={terminalMarketsOpen}
        onToggleMarkets={() => toggleTerminalMarkets()}
        bottomPanelCollapsed={bottomCollapsed}
        onToggleBottomPanel={onToggleBottomPanel}
        onFocusSymbolSearch={onFocusSymbolSearch}
        chartExpanded={chartExpanded}
        terminalNewsOpen={terminalNewsOpen}
        onPanelsSelectMarkets={onPanelsSelectMarkets}
        onPanelsSelectOrder={onPanelsSelectOrder}
        onExpandFullChart={onExpandFullChartFromRail}
        onPanelsSelectNews={onPanelsSelectNews}
        terminalCalcOpen={terminalCalcOpen}
        onPanelsSelectCalc={onPanelsSelectCalc}
      />
      <div
        ref={centerColumnRef}
        className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0 relative z-0"
      >
        {/* Slim toolbar — the price-ticker cards are gone; only the panel
            controls remain, right-aligned. */}
        <div className="w-full shrink-0 border-b border-border-primary bg-bg-base flex items-center justify-end gap-2 px-2 py-1.5">
          {/* Markets — opens the instruments list (full-height panel on
              the right); chart + positions shrink to the left. Toggle. */}
          <Button
            variant="outline"
            size="sm"
            onClick={onPanelsSelectMarkets}
            aria-pressed={terminalMarketsOpen}
            className={clsx(terminalMarketsOpen && '!border-accent/60 !bg-accent/10 text-accent')}
            title="Browse instruments"
            leftIcon={<List className="w-4 h-4" aria-hidden />}
          >
            <span className="hidden sm:inline">Markets</span>
          </Button>
          {/* Trade — pops the movable order window. */}
          <Button
            variant="primary"
            size="sm"
            onClick={openOrderModal}
            title="Open the order ticket"
            leftIcon={<CandlestickChart className="w-4 h-4" aria-hidden />}
          >
            <span className="hidden sm:inline">Trade</span>
          </Button>
        </div>
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* LEFT: chart + positions stacked. When a right panel (Markets /
              News / Calc) opens, this whole stack shrinks to the left and the
              panel spans the full height on the right. */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
          <div
            className={clsx(
              'flex flex-col overflow-hidden bg-bg-base min-w-0 min-h-0 isolate',
              chartExpanded
                ? 'fixed inset-0 z-[100] ring-1 ring-inset ring-accent/25'
                : 'flex-1 relative z-0',
            )}
          >
            {chartExpanded ? (
              <div className="shrink-0 flex items-center justify-between gap-3 px-3 py-2 border-b border-border-primary bg-bg-secondary">
                <span className="text-xs font-semibold text-text-primary truncate">
                  {selectedSymbol ? `Chart — ${selectedSymbol}` : 'Chart'}
                </span>
                <span className="text-xxs text-text-tertiary hidden sm:inline">Esc — normal view</span>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => setChartExpanded(false)}
                  leftIcon={<Minimize2 className="w-3.5 h-3.5 shrink-0" aria-hidden />}
                >
                  Normal view
                </Button>
              </div>
            ) : null}
            <div className="flex-1 min-w-0 min-h-0 overflow-hidden relative">
              {/* Full-screen toggle lives INSIDE the chart's top toolbar (added
                  via the library's createButton API) so it never overlaps the
                  chart's own buttons. Collapse is via the header's "Normal view"
                  button / Esc when expanded. */}
              <ChartErrorBoundary>
                <TradingViewChart onRequestFullscreen={enterFullscreen} />
              </ChartErrorBoundary>
            </div>
          </div>

          <PanelResizeHandle
            axis="horizontal"
            hitSize={TERMINAL_RESIZE.bottomHandleHitPx}
            onDragStart={snapshotLayout}
            onDrag={onBottomDrag}
            className="z-[80]"
          />

          <div
            className="shrink-0 overflow-hidden min-h-0 flex relative z-[1] border-t border-border-primary"
            style={{ height: bpH }}
          >
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
              <PositionsPanel variant="terminal" />
            </div>
          </div>
          </div>{/* LEFT column (chart + positions) close */}

          {rightPanelOpen && (
            <>
          <PanelResizeHandle
            axis="vertical"
            hitSize={TERMINAL_RESIZE.handleHitPx}
            onDragStart={snapshotLayout}
            onDrag={onChartRailDrag}
          />

          <div
            className="shrink-0 flex flex-col h-full min-h-0 overflow-hidden bg-bg-base border-l border-border-primary"
            style={{ width: opW }}
          >
            {terminalCalcOpen && !terminalNewsOpen ? (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <RiskCalculator />
              </div>
            ) : terminalNewsOpen ? (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <div className="shrink-0 flex items-center gap-2 px-3 py-2 border-b border-border-primary bg-bg-secondary">
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => {
                      setTerminalNewsOpen(false);
                      setTerminalMarketsOpen(true);
                    }}
                    className="uppercase tracking-wide"
                  >
                    ← Markets
                  </Button>
                  <span className="text-xxs font-bold uppercase tracking-[0.12em] text-text-tertiary">Live News</span>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      setTerminalNewsOpen(false);
                      setTerminalMarketsOpen(false);
                    }}
                    className="ml-auto"
                  >
                    Close
                  </Button>
                </div>
                <div className="flex-1 min-h-0">
                  <TradingViewNewsTimeline />
                </div>
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <InstrumentsTable
                  onExitMarkets={() => {
                    // Picking an instrument closes the markets panel and
                    // pops the movable order window for that symbol.
                    setTerminalMarketsOpen(false);
                    setTerminalNewsOpen(false);
                    openOrderModal();
                  }}
                  onViewNews={() => {
                    setTerminalMarketsOpen(false);
                    setTerminalNewsOpen(true);
                  }}
                />
              </div>
            )}
          </div>
            </>
          )}
        </div>
      </div>

      {/* Movable order window — replaces the old pinned right column. */}
      {orderModalOpen && <DraggableOrderModal onClose={() => setOrderModalOpen(false)} />}
    </div>
  );
}
