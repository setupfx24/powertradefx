'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { clsx } from 'clsx';
import { Search, Star, Newspaper, BarChart3 } from 'lucide-react';
import { useTradingStore, type InstrumentInfo } from '@/stores/tradingStore';
import { tradingTerminalUrl } from '@/lib/tradingNav';
import { Button, EmptyState, Input, Segmented, Select } from '@/components/ui';
import SymbolIcon from './SymbolIcon';
import { getMarketStatus } from '@/lib/marketHours';
import { quoteFreshness } from '@/lib/quoteStatus';

type Trend = 'up' | 'down' | 'neutral';
type Segment = 'All' | 'Forex' | 'Crypto' | 'Indices' | 'Commodities' | 'Metals' | 'Stocks';
type View = 'instruments' | 'news';

const SEGMENTS: Segment[] = ['All', 'Forex', 'Crypto', 'Indices', 'Commodities', 'Metals', 'Stocks'];

const SYMBOL_DESC: Record<string, string> = {
  EURUSD: 'Euro vs US Dollar',
  GBPUSD: 'British Pound vs US Dollar',
  USDJPY: 'US Dollar vs Japanese Yen',
  AUDUSD: 'Australian Dollar vs US Dollar',
  USDCAD: 'US Dollar vs Canadian Dollar',
  USDCHF: 'US Dollar vs Swiss Franc',
  NZDUSD: 'New Zealand Dollar vs US Dollar',
  EURGBP: 'Euro vs British Pound',
  EURJPY: 'Euro vs Japanese Yen',
  GBPJPY: 'British Pound vs Japanese Yen',
  XAUUSD: 'Gold vs US Dollar',
  XAGUSD: 'Silver vs US Dollar',
  USOIL: 'Crude Oil',
  US30: 'Dow Jones Industrial',
  US500: 'S&P 500 Index',
  NAS100: 'NASDAQ 100 Index',
  UK100: 'FTSE 100 Index',
  GER40: 'DAX 40 Index',
  BTCUSD: 'Bitcoin vs US Dollar',
  ETHUSD: 'Ethereum vs US Dollar',
  LTCUSD: 'Litecoin vs US Dollar',
  XRPUSD: 'Ripple vs US Dollar',
  SOLUSD: 'Solana vs US Dollar',
  DOGUSD: 'Dogecoin vs US Dollar',
  DOGEUSD: 'Dogecoin vs US Dollar',
  ADAUSD: 'Cardano vs US Dollar',
  BCHUSD: 'Bitcoin Cash vs US Dollar',
  BNBUSD: 'Binance Coin vs US Dollar',
  DOTUSD: 'Polkadot vs US Dollar',
  LNKUSD: 'Chainlink vs US Dollar',
};

function getDigits(symbol: string): number {
  if (['USDJPY', 'EURJPY', 'GBPJPY', 'AUDJPY', 'CADJPY', 'NZDJPY'].includes(symbol)) return 3;
  if (symbol === 'XRPUSD') return 4;
  if (['XAUUSD', 'USOIL', 'BTCUSD', 'ETHUSD', 'LTCUSD', 'SOLUSD', 'DOGUSD', 'DOGEUSD'].includes(symbol))
    return 2;
  if (['US30', 'US500', 'NAS100', 'UK100', 'GER40'].includes(symbol)) return 1;
  return 5;
}

function segmentOf(symbol: string, instruments: InstrumentInfo[]): Segment {
  const u = symbol.toUpperCase();
  if (u === 'XAUUSD' || u === 'XAGUSD') return 'Metals';
  if (u === 'USOIL') return 'Commodities';
  const inst = instruments.find((i) => i.symbol === symbol);
  const seg = String(inst?.segment || '').toLowerCase();
  if (seg.includes('crypto')) return 'Crypto';
  if (seg.includes('indices') || seg.includes('index')) return 'Indices';
  if (seg.includes('commodit')) return 'Commodities';
  if (seg.includes('metal')) return 'Metals';
  if (seg.includes('stock') || seg.includes('equit')) return 'Stocks';
  return 'Forex';
}

function spreadInPips(
  symbol: string,
  bid: number,
  ask: number,
  instruments: InstrumentInfo[],
): number {
  const pip = instruments.find((i) => i.symbol === symbol)?.pip_size || 0.0001;
  return Math.max(0, Math.round(((ask - bid) / pip) * 10) / 10);
}

/** Tick flash class: the price cell blinks green on an up-tick, red on a down-tick. */
function flashClass(trend: Trend | undefined): string | false {
  return trend === 'up' ? 'flash-up' : trend === 'down' ? 'flash-down' : false;
}

export type InstrumentsTableProps = {
  onExitMarkets?: () => void;
  onViewNews?: () => void;
};

export default function InstrumentsTable({ onExitMarkets, onViewNews }: InstrumentsTableProps) {
  const router = useRouter();
  const urlParams = useSearchParams();
  // Narrow selectors: still tracks `prices` (live table) but no longer
  // re-renders on positions/accounts/etc. Actions are stable refs.
  const watchlist = useTradingStore((s) => s.watchlist);
  const prices = useTradingStore((s) => s.prices);
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const setSelectedSymbol = useTradingStore((s) => s.setSelectedSymbol);
  const instruments = useTradingStore((s) => s.instruments);
  const activeAccount = useTradingStore((s) => s.activeAccount);

  const [view, setView] = useState<View>('instruments');
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState<Segment>('All');
  const [starred, setStarred] = useState<Set<string>>(new Set());
  const [starredOnly, setStarredOnly] = useState(false);
  const [bidFlash, setBidFlash] = useState<Record<string, Trend>>({});
  const [askFlash, setAskFlash] = useState<Record<string, Trend>>({});

  const dayLowRef = useRef<Record<string, number>>({});
  const dayHighRef = useRef<Record<string, number>>({});
  const prevTickRef = useRef<Record<string, { bid: number; ask: number }>>({});

  // Track Day High/Low
  useEffect(() => {
    for (const symbol of watchlist) {
      const tick = prices[symbol];
      if (!tick) continue;
      if (!(symbol in dayLowRef.current)) {
        dayLowRef.current[symbol] = tick.bid;
        dayHighRef.current[symbol] = tick.bid;
      } else {
        /* `symbol in dayLowRef.current` check above guarantees the entry exists. */
        if (tick.bid < dayLowRef.current[symbol]!) dayLowRef.current[symbol] = tick.bid;
        if (tick.bid > dayHighRef.current[symbol]!) dayHighRef.current[symbol] = tick.bid;
      }
    }
  }, [prices, watchlist]);

  // Flash bid/ask on changes
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
    const timer = setTimeout(() => {
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
    }, 400);
    return () => clearTimeout(timer);
  }, [prices, watchlist]);

  const rows = useMemo(() => {
    /* When the user is searching, broaden the source to every priced
       instrument so terms like 'silver'/'gold'/'bitcoin' can find symbols
       that aren't already on the watchlist. */
    const hasQuery = search.trim().length > 0;
    const source: string[] = hasQuery
      ? Array.from(new Set([...watchlist, ...instruments.map((i) => i.symbol)]))
      : watchlist;
    const q = search.toLowerCase();
    return source
      .filter((s) => prices[s] != null)
      .filter((s) => {
        if (hasQuery) {
          const inst = instruments.find((i) => i.symbol === s);
          const hay = `${s} ${inst?.display_name || ''} ${SYMBOL_DESC[s] || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        if (starredOnly && !starred.has(s)) return false;
        if (segment !== 'All' && segmentOf(s, instruments) !== segment) return false;
        return true;
      });
  }, [watchlist, prices, search, segment, starred, starredOnly, instruments]);

  const leverage = activeAccount?.leverage ?? 500;

  const handleRowClick = (symbol: string) => {
    setSelectedSymbol(symbol);
    if (onExitMarkets) {
      onExitMarkets();
      return;
    }
    const acc = urlParams.get('account');
    if (acc) router.push(tradingTerminalUrl(acc, { view: 'chart' }));
  };

  const toggleStar = (symbol: string, e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    setStarred((p) => {
      const next = new Set(p);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      return next;
    });
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-bg-base text-text-primary">
      {/* Top toolbar — view toggle + search + segment select + star */}
      <div className="shrink-0 flex items-center gap-2 px-3 py-2.5 border-b border-border-primary bg-bg-secondary">
        {/* View toggle: Instruments / News */}
        <Segmented
          size="xs"
          aria-label="Markets view"
          value={view}
          onChange={(v) => {
            setView(v);
            if (v === 'news' && onViewNews) onViewNews();
          }}
          options={[
            { value: 'instruments', icon: <BarChart3 aria-hidden />, label: <span className="sr-only">Instruments</span> },
            { value: 'news', icon: <Newspaper aria-hidden />, label: <span className="sr-only">News</span> },
          ]}
        />

        {/* Search */}
        <div className="flex-1 min-w-0">
          <Input
            type="text"
            size="sm"
            icon={<Search aria-hidden />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            aria-label="Search instruments"
          />
        </div>

        {/* Segment select */}
        <div className="shrink-0 w-[120px]">
          <Select size="sm" value={segment} onChange={(e) => setSegment(e.target.value as Segment)} aria-label="Segment">
            {SEGMENTS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </div>

        {/* Starred filter toggle */}
        <Button
          size="sm"
          iconOnly
          variant={starredOnly ? 'primary' : 'outline'}
          onClick={() => setStarredOnly((p) => !p)}
          aria-label="Show starred only"
          aria-pressed={starredOnly}
        >
          <Star className="w-3.5 h-3.5" fill={starredOnly ? 'currentColor' : 'none'} aria-hidden />
        </Button>
      </div>

      {/* Quote cards — one card per instrument: identity on the left, a
          day-range meter in the middle (where the price sits between the
          session low and high), and SELL/BUY price pills on the right.
          No spreadsheet columns — this list is deliberately not another
          MT-style table. */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="p-2 flex flex-col gap-1.5">
        {rows.length === 0 ? (
          <EmptyState compact icon={<Search />} title="No instruments match" />
        ) : (
          rows.map((symbol) => {
            const tick = prices[symbol];
            const digits = getDigits(symbol);
            const sel = symbol === selectedSymbol;
            const bFlash = bidFlash[symbol];
            const aFlash = askFlash[symbol];
            const dayHigh = dayHighRef.current[symbol];
            const dayLow = dayLowRef.current[symbol];
            const spread = tick ? spreadInPips(symbol, tick.bid, tick.ask, instruments) : null;
            const desc = SYMBOL_DESC[symbol] || segmentOf(symbol, instruments);
            const isStarred = starred.has(symbol);
            const range = dayHigh != null && dayLow != null ? dayHigh - dayLow : 0;
            const pos = tick && range > 0
              ? Math.min(96, Math.max(4, ((tick.bid - (dayLow as number)) / range) * 100))
              : 50;
            // Market open but no live tick → feed down; grey the pills and say so.
            const instSeg = (instruments.find((i) => i.symbol === symbol) as { segment?: string } | undefined)?.segment;
            const stale = quoteFreshness(tick, getMarketStatus(symbol, instSeg).isOpen) === 'stale';

            return (
              <div
                key={symbol}
                role="button"
                tabIndex={0}
                onClick={() => handleRowClick(symbol)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(symbol); } }}
                className={clsx(
                  'grid grid-cols-[minmax(140px,1.1fr)_minmax(110px,1fr)_auto] items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-colors',
                  sel
                    ? 'border-accent/50 bg-accent/10'
                    : 'border-border-primary bg-card hover:border-border-strong hover:bg-bg-hover',
                )}
              >
                {/* identity */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => toggleStar(symbol, e)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleStar(symbol, e); }}
                    className={clsx(
                      'shrink-0 transition-colors cursor-pointer',
                      isStarred ? 'text-warning' : 'text-text-tertiary/50 hover:text-text-tertiary',
                    )}
                    aria-label="Star"
                    aria-pressed={isStarred}
                  >
                    <Star className="w-3 h-3" fill={isStarred ? 'currentColor' : 'none'} aria-hidden />
                  </span>
                  <SymbolIcon symbol={symbol} size={22} />
                  <div className="min-w-0">
                    <div className="text-base font-bold text-text-primary font-mono leading-tight truncate">{symbol}</div>
                    <div className="text-xxs text-text-tertiary leading-tight truncate">{desc}</div>
                  </div>
                </div>

                {/* day-range meter */}
                <div className="hidden md:block min-w-0 px-1">
                  <div className="flex justify-between text-xxs font-mono text-text-tertiary mb-1 tabular-nums">
                    <span>L {dayLow != null ? dayLow.toFixed(digits) : '—'}</span>
                    <span>H {dayHigh != null ? dayHigh.toFixed(digits) : '—'}</span>
                  </div>
                  <div className="relative h-1 rounded-full bg-bg-active">
                    <span
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-accent"
                      style={{ left: `${pos}%` }}
                    />
                  </div>
                  <div className="mt-1 text-center text-xxs font-mono text-text-tertiary tabular-nums">
                    spread {spread != null ? spread.toFixed(1) : '—'} · 1:{leverage}
                  </div>
                </div>

                {/* sell / buy pills — the pill flashes green/red on a tick
                    (flash-up / flash-down) and the price text takes the
                    tick direction colour for the same 400ms. */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={clsx('rounded-md border px-2.5 py-1 text-right min-w-[84px]', stale ? 'border-border-primary bg-bg-tertiary' : 'border-sell/25 bg-sell/10', flashClass(bFlash))}>
                    <span className={clsx('block text-xxs font-bold tracking-[0.14em]', stale ? 'text-warning' : 'text-sell/80')}>{stale ? 'STALE' : 'SELL'}</span>
                    <span className={clsx('block text-sm font-mono font-bold tabular-nums', stale ? 'text-text-tertiary' : bFlash === 'up' ? 'text-buy' : 'text-sell')}>
                      {tick ? tick.bid.toFixed(digits) : '—'}
                    </span>
                  </span>
                  <span className={clsx('rounded-md border px-2.5 py-1 text-right min-w-[84px]', stale ? 'border-border-primary bg-bg-tertiary' : 'border-buy/25 bg-buy/10', flashClass(aFlash))}>
                    <span className={clsx('block text-xxs font-bold tracking-[0.14em]', stale ? 'text-warning' : 'text-buy/80')}>{stale ? 'STALE' : 'BUY'}</span>
                    <span className={clsx('block text-sm font-mono font-bold tabular-nums', stale ? 'text-text-tertiary' : aFlash === 'down' ? 'text-sell' : 'text-buy')}>
                      {tick ? tick.ask.toFixed(digits) : '—'}
                    </span>
                  </span>
                </div>
              </div>
            );
          })
        )}
        </div>
      </div>
    </div>
  );
}
