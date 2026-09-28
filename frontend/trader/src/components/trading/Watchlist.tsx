'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTradingStore, InstrumentInfo } from '@/stores/tradingStore';
import { tradingTerminalUrl } from '@/lib/tradingNav';
import { clsx } from 'clsx';
import MobileOrderSheet from '@/components/trading/MobileOrderSheet';
import { ActiveAccountBadge } from '@/components/trading/ActiveAccountBadge';
import { useUIStore } from '@/stores/uiStore';
import { BellOff, ChevronUp, Search, Star, TrendingUp } from 'lucide-react';
import { Badge, Button, EmptyState, Input, Tabs } from '@/components/ui';
import SymbolIcon from '@/components/trading/SymbolIcon';
import { getMarketStatus } from '@/lib/marketHours';
import { quoteFreshness } from '@/lib/quoteStatus';

/** Market open but no live tick for this symbol — the feed is down, not the market. */
function isFeedStale(symbol: string, tick: Parameters<typeof quoteFreshness>[0]): boolean {
  const inst = useTradingStore.getState().instruments.find((i) => i.symbol === symbol) as
    | { segment?: string }
    | undefined;
  return quoteFreshness(tick, getMarketStatus(symbol, inst?.segment).isOpen) === 'stale';
}

type Trend = 'up' | 'down' | 'neutral';

const TERMINAL_GROUPS = ['FOREX', 'CRYPTO', 'INDICES', 'METALS', 'COMMODITIES', 'STOCKS'] as const;
type TerminalGroup = (typeof TERMINAL_GROUPS)[number];

const SYMBOL_EMOJI: Record<string, string> = {
  BTCUSD: '₿',
  ETHUSD: 'Ξ',
  LTCUSD: 'Ł',
  XRPUSD: '✕',
  SOLUSD: '◎',
  DOGUSD: '🐕',
  DOGEUSD: '🐕',
  EURUSD: '🇪🇺',
  GBPUSD: '🇬🇧',
  USDJPY: '¥',
  AUDUSD: 'A$',
  USDCAD: 'C$',
  NZDUSD: '🇳🇿',
  XAUUSD: '🥇',
  XAGUSD: '🥈',
  USOIL: '🛢',
  US30: '📊',
  US500: '📊',
  NAS100: '📊',
  UK100: '📊',
  GER40: '📊',
};

function terminalGroup(symbol: string, instruments: InstrumentInfo[]): TerminalGroup {
  const u = symbol.toUpperCase();
  if (u === 'XAUUSD' || u === 'XAGUSD') return 'METALS';
  if (u === 'USOIL') return 'COMMODITIES';
  const m = SYMBOL_META[symbol];
  const inst = instruments.find((i) => i.symbol === symbol);
  const seg = String(inst?.segment || m?.segment || '').toLowerCase();
  if (seg.includes('crypto')) return 'CRYPTO';
  if (seg.includes('indices') || seg.includes('index')) return 'INDICES';
  if (seg.includes('commodit')) return 'COMMODITIES';
  if (seg.includes('metal')) return 'METALS';
  if (seg.includes('stock') || seg.includes('equit')) return 'STOCKS';
  if (seg.includes('forex') || seg.includes('fx')) return 'FOREX';
  // Fallback: check SYMBOL_META
  if (m?.segment === 'Crypto') return 'CRYPTO';
  if (m?.segment === 'Indices') return 'INDICES';
  if (m?.segment === 'Commodities') return 'COMMODITIES';
  return 'FOREX';
}

const SEGMENTS = ['All', 'Forex', 'Crypto', 'Indices', 'Commodities', 'Metals', 'Stocks'];

/** True if `query` appears in symbol, backend display_name, or SYMBOL_META.display.
    Lets users find XAUUSD/XAGUSD by typing 'gold'/'silver' etc. */
function matchesSearch(
  symbol: string,
  query: string,
  instruments: InstrumentInfo[],
  meta: Record<string, { display: string; segment: string }>,
): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (symbol.toLowerCase().includes(q)) return true;
  const inst = instruments.find((i) => i.symbol === symbol);
  if (inst?.display_name && inst.display_name.toLowerCase().includes(q)) return true;
  const m = meta[symbol];
  if (m?.display && m.display.toLowerCase().includes(q)) return true;
  return false;
}

const SYMBOL_META: Record<string, { display: string; segment: string }> = {
  EURUSD: { display: 'EUR/USD', segment: 'Forex' },
  GBPUSD: { display: 'GBP/USD', segment: 'Forex' },
  USDJPY: { display: 'USD/JPY', segment: 'Forex' },
  AUDUSD: { display: 'AUD/USD', segment: 'Forex' },
  USDCAD: { display: 'USD/CAD', segment: 'Forex' },
  USDCHF: { display: 'USD/CHF', segment: 'Forex' },
  NZDUSD: { display: 'NZD/USD', segment: 'Forex' },
  EURGBP: { display: 'EUR/GBP', segment: 'Forex' },
  EURJPY: { display: 'EUR/JPY', segment: 'Forex' },
  GBPJPY: { display: 'GBP/JPY', segment: 'Forex' },
  EURCHF: { display: 'EUR/CHF', segment: 'Forex' },
  GBPCHF: { display: 'GBP/CHF', segment: 'Forex' },
  AUDJPY: { display: 'AUD/JPY', segment: 'Forex' },
  AUDNZD: { display: 'AUD/NZD', segment: 'Forex' },
  AUDCAD: { display: 'AUD/CAD', segment: 'Forex' },
  AUDCHF: { display: 'AUD/CHF', segment: 'Forex' },
  CADJPY: { display: 'CAD/JPY', segment: 'Forex' },
  NZDJPY: { display: 'NZD/JPY', segment: 'Forex' },
  USDHKD: { display: 'USD/HKD', segment: 'Forex' },
  XAUUSD: { display: 'Gold', segment: 'Commodities' },
  XAGUSD: { display: 'Silver', segment: 'Commodities' },
  USOIL: { display: 'Crude Oil', segment: 'Commodities' },
  US30: { display: 'Dow Jones', segment: 'Indices' },
  NAS100: { display: 'NASDAQ', segment: 'Indices' },
  US500: { display: 'S&P 500', segment: 'Indices' },
  UK100: { display: 'FTSE 100', segment: 'Indices' },
  GER40: { display: 'DAX 40', segment: 'Indices' },
  BTCUSD: { display: 'Bitcoin', segment: 'Crypto' },
  ETHUSD: { display: 'Ethereum', segment: 'Crypto' },
  LTCUSD: { display: 'Litecoin', segment: 'Crypto' },
  XRPUSD: { display: 'Ripple', segment: 'Crypto' },
  SOLUSD: { display: 'Solana', segment: 'Crypto' },
  DOGUSD: { display: 'Dogecoin', segment: 'Crypto' },
  DOGEUSD: { display: 'Dogecoin', segment: 'Crypto' },
};

function getDigits(symbol: string): number {
  if (['USDJPY', 'EURJPY', 'GBPJPY', 'AUDJPY', 'CADJPY', 'NZDJPY'].includes(symbol)) return 3;
  if (symbol === 'XRPUSD') return 4;
  if (['XAUUSD', 'USOIL', 'BTCUSD', 'ETHUSD', 'LTCUSD', 'SOLUSD', 'DOGUSD', 'DOGEUSD'].includes(symbol))
    return 2;
  if (['US30', 'US500', 'NAS100', 'UK100', 'GER40'].includes(symbol)) return 1;
  return 5;
}

/** Pip size from trading catalog when loaded; else legacy estimate from display digits (imperfect for some symbols). */
function pipSizeForSymbol(symbol: string, instruments: InstrumentInfo[]): number | undefined {
  const p = instruments.find((i) => i.symbol === symbol)?.pip_size;
  if (p != null && p > 0 && Number.isFinite(p)) return p;
  return undefined;
}

/** Spread in pips — matches admin/backend: (ask − bid) / pip_size. */
function spreadInPips(symbol: string, bid: number, ask: number, instruments: InstrumentInfo[]): number {
  const width = ask - bid;
  const pip = pipSizeForSymbol(symbol, instruments);
  if (pip != null) {
    return Math.round(width / pip);
  }
  const digits = getDigits(symbol);
  return Math.round(width * Math.pow(10, digits - 1));
}

/** Session move in pips (same units as spread when catalog pip_size exists). */
function sessionPipChange(
  symbol: string,
  bid: number,
  sessionOpen: number,
  instruments: InstrumentInfo[],
): number {
  const pip = pipSizeForSymbol(symbol, instruments);
  if (pip != null) {
    return Math.round((bid - sessionOpen) / pip);
  }
  const digits = getDigits(symbol);
  return Math.round((bid - sessionOpen) * Math.pow(10, digits - 1));
}

/** Single-line tabular price: same font size throughout; last digit slightly bolder for tick resolution. */
function PriceCell({
  value,
  digits,
  flash,
  tone,
}: {
  value: number;
  digits: number;
  flash?: Trend;
  tone: 'bid' | 'ask';
}) {
  const s = value.toFixed(digits);
  const dot = s.indexOf('.');
  const color =
    flash === 'up'
      ? 'text-buy'
      : flash === 'down'
        ? 'text-sell'
        : tone === 'bid'
          ? 'text-sell/95'
          : 'text-buy/95';

  if (dot === -1 || digits === 0) {
    return (
      <span className={clsx('tabular-nums text-[13px] sm:text-sm font-semibold tracking-tight', color)}>
        {s}
      </span>
    );
  }
  const dec = s.slice(dot + 1);
  if (dec.length <= 1) {
    return (
      <span className={clsx('tabular-nums text-[13px] sm:text-sm font-semibold tracking-tight', color)}>
        {s}
      </span>
    );
  }
  const head = s.slice(0, -1);
  const last = s.slice(-1);
  return (
    <span className={clsx('tabular-nums text-[13px] sm:text-sm tracking-tight', color)}>
      <span className="font-medium opacity-95">{head}</span>
      <span className="font-bold">{last}</span>
    </span>
  );
}

type WatchlistProps = {
  /** Desktop terminal: dark rail between chart and order (matches crucial-ui screenshots). */
  variant?: 'default' | 'terminalRail';
  /** Full-screen markets mode: chevron + row pick return to order panel (mutually exclusive UI). */
  onExitMarkets?: () => void;
};

export default function Watchlist({ variant = 'default', onExitMarkets }: WatchlistProps) {
  const router = useRouter();
  const pathname = usePathname();
  const urlParams = useSearchParams();
  const terminalMarketsOpen = useUIStore((s) => s.terminalMarketsOpen);
  // Narrow selectors: still tracks `prices` (this list renders live ticks) but
  // no longer re-renders on positions/accounts/etc. Actions are stable refs.
  const watchlist = useTradingStore((s) => s.watchlist);
  const prices = useTradingStore((s) => s.prices);
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const setSelectedSymbol = useTradingStore((s) => s.setSelectedSymbol);
  const instruments = useTradingStore((s) => s.instruments);
  const activeAccount = useTradingStore((s) => s.activeAccount);
  const addToWatchlist = useTradingStore((s) => s.addToWatchlist);
  const removeFromWatchlist = useTradingStore((s) => s.removeFromWatchlist);
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState('Starred');
  const [bidFlash, setBidFlash] = useState<Record<string, Trend>>({});
  const [askFlash, setAskFlash] = useState<Record<string, Trend>>({});
  const [activeOrderSymbol, setActiveOrderSymbol] = useState<string | null>(null);
  /** Terminal rail: collapse search + categorized list (header strip stays). */
  const [railListExpanded, setRailListExpanded] = useState(true);

  const prevTickRef = useRef<Record<string, { bid: number; ask: number }>>({});
  const sessionOpenRef = useRef<Record<string, number>>({});
  const dayLowRef = useRef<Record<string, number>>({});
  const dayHighRef = useRef<Record<string, number>>({});
  const lastTimeRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (variant === 'terminalRail' && terminalMarketsOpen) {
      setRailListExpanded(true);
    }
  }, [variant, terminalMarketsOpen]);

  useEffect(() => {
    for (const symbol of watchlist) {
      const tick = prices[symbol];
      if (!tick) continue;
      if (!(symbol in sessionOpenRef.current)) {
        sessionOpenRef.current[symbol] = tick.bid;
        dayLowRef.current[symbol] = tick.bid;
        dayHighRef.current[symbol] = tick.bid;
      } else {
        /* `symbol in dayLowRef.current` check above guarantees the entry exists. */
        if (tick.bid < dayLowRef.current[symbol]!) dayLowRef.current[symbol] = tick.bid;
        if (tick.bid > dayHighRef.current[symbol]!) dayHighRef.current[symbol] = tick.bid;
      }
      lastTimeRef.current[symbol] = new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    }
  }, [prices, watchlist]);

  useEffect(() => {
    const nextBid: Record<string, Trend> = {};
    const nextAsk: Record<string, Trend> = {};
    for (const symbol of watchlist) {
      const tick = prices[symbol];
      if (!tick) continue;
      const prev = prevTickRef.current[symbol];
      if (prev) {
        if (tick.bid > prev.bid) nextBid[symbol] = 'up';
        else if (tick.bid < prev.bid) nextBid[symbol] = 'down';
        if (tick.ask > prev.ask) nextAsk[symbol] = 'up';
        else if (tick.ask < prev.ask) nextAsk[symbol] = 'down';
      }
      prevTickRef.current[symbol] = { bid: tick.bid, ask: tick.ask };
    }
    if (Object.keys(nextBid).length === 0 && Object.keys(nextAsk).length === 0) return;
    setBidFlash((p) => ({ ...p, ...nextBid }));
    setAskFlash((p) => ({ ...p, ...nextAsk }));
    const t = setTimeout(() => {
      setBidFlash((p) => {
        const n = { ...p };
        for (const k of Object.keys(nextBid)) delete n[k];
        return n;
      });
      setAskFlash((p) => {
        const n = { ...p };
        for (const k of Object.keys(nextAsk)) delete n[k];
        return n;
      });
    }, 220);
    return () => clearTimeout(t);
  }, [prices, watchlist]);

  /** All instruments that have live prices — watchlist + instruments store, filtered. */
  const priceKeys = Object.keys(prices);
  const priceCount = priceKeys.length;
  const allSymbols = useMemo(() => {
    const syms = new Set(watchlist);
    for (const inst of instruments) {
      syms.add(inst.symbol);
    }
    // Only show symbols that have a live price tick
    return Array.from(syms).filter((s) => prices[s] != null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlist, instruments, priceCount]);

  const filtered = allSymbols.filter((s: string) => {
    if (!matchesSearch(s, search, instruments, SYMBOL_META)) return false;
    if (segment === 'Starred') return watchlist.includes(s);
    if (segment !== 'All') {
      const meta = SYMBOL_META[s];
      const inst = instruments.find((i) => i.symbol === s);
      const seg = (inst?.segment || meta?.segment || '').toLowerCase();
      const segLow = segment.toLowerCase();
      if (segLow === 'metals') return s === 'XAUUSD' || s === 'XAGUSD' || seg.includes('metal');
      if (!seg.includes(segLow) && !seg.startsWith(segLow.slice(0, 5))) return false;
    }
    return true;
  });

  const filteredTerminal = allSymbols.filter((s: string) => {
    if (!matchesSearch(s, search, instruments, SYMBOL_META)) return false;
    return true;
  });

  const groupedTerminal = (() => {
    const buckets: Record<TerminalGroup, string[]> = {
      FOREX: [],
      CRYPTO: [],
      INDICES: [],
      METALS: [],
      COMMODITIES: [],
      STOCKS: [],
    };
    for (const s of filteredTerminal) {
      buckets[terminalGroup(s, instruments)].push(s);
    }
    return buckets;
  })();

  const handleRowClick = (symbol: string) => {
    setSelectedSymbol(symbol);
    if (onExitMarkets) {
      onExitMarkets();
      return;
    }
    const acc = urlParams.get('account');
    if (pathname?.startsWith('/trading/terminal') && acc) {
      setActiveOrderSymbol(symbol);
    } else {
      router.push('/trading');
    }
  };

  const rail =
    variant === 'terminalRail'
      ? 'border-0 bg-bg-base'
      : 'border-r border-border-primary bg-bg-base';

  /** Tick flash: the price blinks green on an up-tick, red on a down-tick. */
  const flashClass = (t: Trend | undefined) => (t === 'up' ? 'flash-up' : t === 'down' ? 'flash-down' : false);

  return (
    <div className={clsx('h-full min-h-0 flex flex-col', rail)}>
      {pathname?.startsWith('/trading/terminal') && activeAccount ? (
        <div className="sm:hidden shrink-0 px-3 pt-2 pb-1 border-b border-border-primary bg-bg-secondary">
          <ActiveAccountBadge account={activeAccount} variant="compact" />
        </div>
      ) : null}
      {variant === 'terminalRail' ? (
        <>
          <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2.5 bg-bg-secondary border-b border-border-primary">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <SymbolIcon symbol={selectedSymbol} size={32} />
              <span className="text-sm font-bold text-text-primary font-mono truncate">{selectedSymbol}</span>
              <span className="text-base leading-none shrink-0" aria-hidden>
                {SYMBOL_EMOJI[selectedSymbol] || '●'}
              </span>
              <BellOff className="w-3.5 h-3.5 text-text-tertiary shrink-0" aria-hidden />
              <Badge size="sm">DB</Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              onClick={() => {
                if (onExitMarkets) {
                  onExitMarkets();
                } else {
                  setRailListExpanded((e) => !e);
                }
              }}
              className="text-accent"
              aria-expanded={onExitMarkets ? true : railListExpanded}
              aria-label={onExitMarkets ? 'Back to trade panel' : railListExpanded ? 'Collapse symbol list' : 'Expand symbol list'}
            >
              <ChevronUp
                className={clsx(
                  'w-5 h-5 transition-transform duration-200',
                  !onExitMarkets && !railListExpanded && 'rotate-180',
                )}
                aria-hidden
              />
            </Button>
          </div>
          {onExitMarkets || railListExpanded ? (
            <>
              <div className="p-3 shrink-0 border-b border-border-primary">
                <Input
                  type="text"
                  data-terminal-symbol-search
                  icon={<Search aria-hidden />}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search symbols…"
                  aria-label="Search symbols"
                />
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y">
                {TERMINAL_GROUPS.map((group) => {
                  const syms = groupedTerminal[group];
                  if (syms.length === 0) return null;
                  return (
                    <div key={group}>
                      <div className="px-3 py-1.5 text-xxs font-bold uppercase tracking-[0.12em] text-text-tertiary border-t border-border-primary first:border-t-0 bg-bg-secondary">
                        {group}
                      </div>
                      {syms.map((symbol) => {
                        const tick = prices[symbol];
                        const digits = getDigits(symbol);
                        const sel = symbol === selectedSymbol;
                        const stale = isFeedStale(symbol, tick);
                        return (
                          <button
                            key={symbol}
                            type="button"
                            onClick={() => handleRowClick(symbol)}
                            aria-label={`${symbol}${tick ? ` bid ${tick.bid.toFixed(digits)} ask ${tick.ask.toFixed(digits)}` : ''}`}
                            aria-current={sel ? 'true' : undefined}
                            className={clsx(
                              'w-full flex items-center justify-between gap-2 pl-0 pr-3 py-2.5 text-left border-l-[3px] transition-colors',
                              sel
                                ? 'border-l-accent bg-accent/10'
                                : 'border-l-transparent hover:bg-bg-hover',
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0 pl-3">
                              <SymbolIcon symbol={symbol} size={24} />
                              <span className="text-sm font-bold text-text-primary font-mono">{symbol}</span>
                              <span className="text-sm leading-none opacity-90 shrink-0" aria-hidden>
                                {SYMBOL_EMOJI[symbol] || '·'}
                              </span>
                              {stale && (
                                <Badge variant="warning" size="sm" title="Live price unavailable — feed reconnecting">
                                  Stale
                                </Badge>
                              )}
                            </div>
                            <div className="flex gap-4 shrink-0">
                              <div className="flex flex-col items-end gap-0.5">
                                {tick ? (
                                  <span className={clsx('text-xs font-mono font-semibold tabular-nums rounded-sm px-0.5', stale ? 'text-text-tertiary' : 'text-sell', flashClass(bidFlash[symbol]))}>
                                    {tick.bid.toFixed(digits)}
                                  </span>
                                ) : (
                                  <span className="text-xs text-text-tertiary">—</span>
                                )}
                                <span className="text-xxs font-semibold uppercase tracking-wide text-text-tertiary">
                                  Bid
                                </span>
                              </div>
                              <div className="flex flex-col items-end gap-0.5">
                                {tick ? (
                                  <span className={clsx('text-xs font-mono font-semibold tabular-nums rounded-sm px-0.5', stale ? 'text-text-tertiary' : 'text-buy', flashClass(askFlash[symbol]))}>
                                    {tick.ask.toFixed(digits)}
                                  </span>
                                ) : (
                                  <span className="text-xs text-text-tertiary">—</span>
                                )}
                                <span className="text-xxs font-semibold uppercase tracking-wide text-text-tertiary">
                                  Ask
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </>
          ) : null}
        </>
      ) : (
        <>
          {/* ── Search bar with Go button ── */}
          <div className="px-3 pt-3 pb-2 shrink-0 border-b border-border-primary bg-bg-secondary">
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <Input
                  type="text"
                  icon={<Search aria-hidden />}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    if (e.target.value.trim()) setSegment('All');
                  }}
                  placeholder="Search symbols..."
                  aria-label="Search symbols"
                />
              </div>
              <Button
                variant="primary"
                size="md"
                onClick={() => { /* search triggers on change already */ }}
              >
                Go
              </Button>
            </div>
          </div>

          {/* ── Category tabs — horizontal scroll ── */}
          <div className="shrink-0 bg-bg-secondary overflow-x-auto no-scrollbar scrollbar-none">
            <Tabs
              variant="underline"
              size="sm"
              aria-label="Instrument category"
              className="min-w-max px-2"
              tabs={(['Starred', 'All', ...TERMINAL_GROUPS] as const).map((tab) => ({
                id: tab,
                label: tab === 'Starred' ? '★ Favourites' : tab === 'All' ? 'All' : tab,
              }))}
              active={segment}
              onChange={(id) => setSegment(id)}
            />
          </div>

          {/* ── Results label ── */}
          {search.trim() !== '' && (
            <div className="px-4 py-2 shrink-0 bg-bg-secondary">
              <span className="text-xxs font-bold uppercase tracking-[0.12em] text-text-tertiary">Search Results</span>
            </div>
          )}

          {/* ── Instrument list ── */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain touch-pan-y bg-bg-base no-scrollbar scrollbar-none">
            {(() => {
              // Filter symbols by search + segment
              const displaySymbols = allSymbols.filter((s: string) => {
                if (!matchesSearch(s, search, instruments, SYMBOL_META)) return false;
                if (segment === 'Starred') return watchlist.includes(s);
                if (segment !== 'All') {
                  const g = terminalGroup(s, instruments);
                  if (g !== segment) return false;
                }
                return true;
              });

              if (displaySymbols.length === 0) {
                return (
                  <EmptyState
                    icon={<Search />}
                    title={segment === 'Starred' ? 'No favourites yet' : 'No instruments found'}
                  />
                );
              }

              return displaySymbols.map((symbol: string) => {
                const tick = prices[symbol];
                const digits = getDigits(symbol);
                const meta = SYMBOL_META[symbol];
                const sel = symbol === selectedSymbol;
                const isWatchlisted = watchlist.includes(symbol);
                const displayName = meta?.display || symbol;
                const segLabel = meta?.segment || terminalGroup(symbol, instruments);
                const sessionOpen = sessionOpenRef.current[symbol] ?? tick?.bid ?? 0;
                const isUp = tick ? tick.bid >= sessionOpen : true;

                const toggleFav = (e: React.MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isWatchlisted) removeFromWatchlist(symbol);
                  else addToWatchlist(symbol);
                };

                const openChart = (e: React.MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedSymbol(symbol);
                  const acc = urlParams.get('account');
                  if (acc) {
                    router.push(tradingTerminalUrl(acc, { view: 'chart' }));
                  } else {
                    router.push('/trading');
                  }
                };

                return (
                  <div
                    key={symbol}
                    className={clsx(
                      'w-full flex items-center gap-3 px-4 py-3.5 border-b border-border-secondary transition-colors',
                      sel ? 'bg-accent/10' : 'hover:bg-bg-hover',
                    )}
                  >
                    {/* Star toggle — persisted favourite */}
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      onClick={toggleFav}
                      className="-ml-1"
                      aria-label={isWatchlisted ? 'Remove from favourites' : 'Add to favourites'}
                      aria-pressed={isWatchlisted}
                    >
                      <Star
                        size={18}
                        strokeWidth={2}
                        className={clsx(isWatchlisted ? 'text-warning fill-warning' : 'text-text-tertiary')}
                        aria-hidden
                      />
                    </Button>

                    {/* Tapping the label/body opens the mobile order sheet */}
                    <button
                      type="button"
                      onClick={() => handleRowClick(symbol)}
                      className="flex-1 min-w-0 text-left"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-base font-bold text-text-primary font-mono tracking-wide">{symbol}</span>
                      </div>
                      <p className="text-xs text-text-tertiary mt-0.5 truncate uppercase tracking-wide">
                        {segLabel}{displayName !== symbol ? ` – ${displayName}` : ''}
                      </p>
                    </button>

                    {/* Price + pip change */}
                    {tick ? (
                      <button
                        type="button"
                        onClick={() => handleRowClick(symbol)}
                        className="shrink-0 text-right"
                      >
                        <span className={clsx('block text-sm font-mono font-bold tabular-nums text-text-primary rounded-sm px-0.5', flashClass(bidFlash[symbol]))}>
                          {tick.bid.toFixed(digits)}
                        </span>
                        <span className={clsx('block text-xxs font-bold tabular-nums', isUp ? 'text-buy' : 'text-sell')}>
                          {isUp ? '▲' : '▼'} {Math.abs(spreadInPips(symbol, tick.bid, tick.ask, instruments))} pip
                        </span>
                      </button>
                    ) : (
                      <span className="shrink-0 text-xs text-text-tertiary">—</span>
                    )}

                    {/* Chart icon — opens full chart for this symbol */}
                    <Button
                      variant="ghost"
                      size="sm"
                      iconOnly
                      onClick={openChart}
                      aria-label="Open chart"
                      title="Open chart"
                    >
                      <TrendingUp size={18} strokeWidth={2} aria-hidden />
                    </Button>
                  </div>
                );
              });
            })()}
          </div>
        </>
      )}

      {activeOrderSymbol && (
        <MobileOrderSheet
          symbol={activeOrderSymbol}
          onClose={() => setActiveOrderSymbol(null)}
          onGoToChart={() => {
            setSelectedSymbol(activeOrderSymbol);
            const acc = urlParams.get('account');
            if (acc) {
              router.push(tradingTerminalUrl(acc, { view: 'chart' }));
            }
          }}
        />
      )}
    </div>
  );
}
