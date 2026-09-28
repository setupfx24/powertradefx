'use client';

import { Suspense, useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { FileDown, Inbox } from 'lucide-react';
import { cn, getDigits } from '@/lib/utils';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Select,
  SideBadge,
  Skeleton,
  StatCard,
  Table,
  Tabs,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';
import type { BadgeVariant } from '@/components/ui';
import DashboardShell from '@/components/layout/DashboardShell';
import TradingOverview from '@/components/profile/TradingOverview';
import { buildDashboardFromPortfolio } from '@/lib/trading-dashboard';
import api from '@/lib/api/client';
import { downloadTradeStatementPdf } from '@/lib/pdf/tradeStatementPdf';

interface PortfolioSummary {
  total_balance: number;
  total_equity: number;
  total_unrealized_pnl: number;
  pnl_breakdown: {
    today: number;
    this_week: number;
    this_month: number;
    all_time: number;
  };
  holdings: Array<{
    symbol: string;
    side: string;
    lots: number;
    entry_price: number;
    current_price: number;
    pnl: number;
    pnl_pct: number;
  }>;
  open_positions_count: number;
}

interface PerformanceData {
  equity_curve: Array<{ date: string; equity: number }>;
  stats: {
    total_return: number;
    max_drawdown: number;
    sharpe_ratio: number;
    win_rate: number;
    total_trades: number;
  };
  monthly_breakdown: Array<{ month: string; pnl: number }>;
  symbol_breakdown: Array<{ symbol: string; pnl: number; trades: number }>;
}

interface Trade {
  id: string;
  symbol: string;
  side: string;
  lots: number;
  pnl: number;
  open_time: string;
  close_time: string;
  duration: string;
  entry_price: number;
  exit_price: number;
  close_reason?: string | null;
  /** API may send these (align with /portfolio/trades). */
  open_price?: number;
  close_price?: number;
  opened_at?: string;
  commission?: number;
  swap?: number;
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n);
}

function tradeExitLabel(
  reason: string | null | undefined,
  triggerPrice?: number,
  digits: number = 5,
): { text: string; variant: BadgeVariant } {
  const r = (reason || 'manual').toLowerCase();
  const priceStr = triggerPrice != null && Number.isFinite(triggerPrice)
    ? ` @ ${Number(triggerPrice).toFixed(digits)}`
    : '';
  if (r === 'sl') return { text: `Stop loss (SL)${priceStr}`, variant: 'sell' };
  if (r === 'tp') return { text: `Take profit (TP)${priceStr}`, variant: 'buy' };
  if (r === 'admin') return { text: 'Admin', variant: 'warning' };
  // copy_close / copy / manual / anything else → show as Manual close.
  return { text: 'Manual close', variant: 'neutral' };
}

// Portfolio always shows all-time stats. The mapping below is kept as a
// reference for whenever the per-period selector comes back; right now
// only the 'All' → 'all' entry is actually consulted.
const TF_TO_PERIOD: Record<string, string> = {
  '1M': '1m', '3M': '3m', '6M': '6m', '1Y': '1y', 'All': 'all',
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseAccountId(raw: string | null): string | null {
  if (!raw) return null;
  return UUID_RE.test(raw) ? raw : null;
}

interface AccountOption {
  id: string;
  account_number: string;
  is_demo: boolean;
}

const pnlClass = (n: number) => (n >= 0 ? 'text-success' : 'text-danger');
const signed = (n: number) => `${n >= 0 ? '+' : ''}${fmt(n)}`;

function LoadingShell() {
  return (
    <DashboardShell>
      <div className="page-main space-y-4 md:space-y-5" aria-busy>
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Balance" value="" loading />
          <StatCard label="Equity" value="" loading />
          <StatCard label="Open P/L" value="" loading />
          <StatCard label="Open positions" value="" loading />
        </div>
        <Skeleton className="h-64" />
      </div>
    </DashboardShell>
  );
}

function PortfolioPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryKey = searchParams.toString();

  // Trading accounts for the scope dropdown — lets the user pick which
  // account's journal/history to view (or all combined) right on the page,
  // instead of relying on an ?account_id= deep link.
  const [accountOptions, setAccountOptions] = useState<AccountOption[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<unknown>('/accounts');
        if (cancelled) return;
        const raw = Array.isArray(res) ? res : ((res as { items?: unknown[] })?.items ?? []);
        setAccountOptions(
          (raw as Record<string, unknown>[]).map((a) => ({
            id: String(a.id),
            account_number: String(a.account_number ?? '').trim(),
            is_demo: Boolean(a.is_demo),
          })),
        );
      } catch {
        /* dropdown simply stays hidden */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const onPickAccount = (id: string) => {
    const params = new URLSearchParams(queryKey);
    if (id) {
      const acc = accountOptions.find((a) => a.id === id);
      params.set('account_id', id);
      if (acc?.account_number) params.set('account_no', acc.account_number);
      else params.delete('account_no');
    } else {
      params.delete('account_id');
      params.delete('account_no');
    }
    const qs = params.toString();
    router.replace(qs ? `/portfolio?${qs}` : '/portfolio', { scroll: false });
  };

  const validAccountId = useMemo(() => {
    return parseAccountId(new URLSearchParams(queryKey).get('account_id'));
  }, [queryKey]);

  const accountNoLabel = useMemo(() => {
    const v = new URLSearchParams(queryKey).get('account_no');
    return v?.trim() ? v.trim() : '';
  }, [queryKey]);

  // Portfolio is now always all-time. The timeframe selector was removed
  // from the UI per client direction — `tf` stays as a const reference so
  // the existing TF_TO_PERIOD lookup keeps compiling. If we ever bring the
  // selector back, swap this back to useState('1M').
  const tf = 'All';

  const [tab, setTab] = useState('overview');
  const [page, setPage] = useState(1);

  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfExporting, setPdfExporting] = useState(false);

  const [allTrades, setAllTrades] = useState<Trade[]>([]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const period = TF_TO_PERIOD[tf] || 'all';
      const summaryParams: Record<string, string> | undefined = validAccountId
        ? { account_id: validAccountId }
        : undefined;
      const perfParams: Record<string, string> = { period };
      if (validAccountId) perfParams.account_id = validAccountId;
      const tradeParams: Record<string, string> = { page: '1', per_page: '200' };
      if (validAccountId) tradeParams.account_id = validAccountId;
      const [sumRes, perfRes, tradesRes] = await Promise.all([
        api.get<PortfolioSummary>('/portfolio/summary', summaryParams),
        api.get<PerformanceData>('/portfolio/performance', perfParams),
        api.get<{ items: Trade[] }>('/portfolio/trades', tradeParams),
      ]);
      setSummary(sumRes);
      setPerformance(perfRes);
      setAllTrades(tradesRes.items ?? []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : 'Failed to load portfolio';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [tf, validAccountId]);

  const fetchTrades = useCallback(async (p: number) => {
    try {
      const params: Record<string, string> = { page: String(p), per_page: '10' };
      if (validAccountId) params.account_id = validAccountId;
      const res = await api.get<{ items: Trade[]; total: number; pages: number }>(
        '/portfolio/trades',
        params,
      );
      setTrades(res.items ?? []);
      setTotalPages(res.pages ?? 1);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load trades');
    }
  }, [validAccountId]);

  const handleDownloadTradeStatementPdf = useCallback(async () => {
    setPdfExporting(true);
    try {
      const all: Trade[] = [];
      let p = 1;
      let pages = 1;
      const perPage = 200;
      do {
        const params: Record<string, string> = {
          page: String(p),
          per_page: String(perPage),
        };
        if (validAccountId) params.account_id = validAccountId;
        const res = await api.get<{ items: Trade[]; pages: number }>(
          '/portfolio/trades',
          params,
        );
        all.push(...(res.items ?? []));
        pages = Math.max(1, res.pages ?? 1);
        p += 1;
      } while (p <= pages && p <= 50);
      if (all.length === 0) {
        toast.error('No trades to export');
        return;
      }
      await downloadTradeStatementPdf(
        all.map((t) => ({
          close_time: t.close_time,
          open_time: t.open_time ?? t.opened_at,
          opened_at: t.opened_at,
          symbol: t.symbol,
          side: t.side,
          lots: t.lots,
          open_price: t.open_price ?? t.entry_price,
          close_price: t.close_price ?? t.exit_price,
          entry_price: t.entry_price,
          exit_price: t.exit_price,
          pnl: t.pnl,
          close_reason: t.close_reason,
          commission: t.commission,
          swap: t.swap,
        })),
      );
      toast.success('Statement PDF downloaded');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Could not create PDF');
    } finally {
      setPdfExporting(false);
    }
  }, [validAccountId]);

  const rawAccountParam = useMemo(() => new URLSearchParams(queryKey).get('account_id'), [queryKey]);
  const invalidAccountParam = Boolean(rawAccountParam && !validAccountId);

  useEffect(() => {
    const t = new URLSearchParams(queryKey).get('tab');
    if (t === 'overview' || t === 'history') {
      setTab(t);
    } else {
      setTab('overview');
    }
  }, [queryKey]);

  useEffect(() => {
    setPage(1);
  }, [validAccountId]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { if (tab === 'history') fetchTrades(page); }, [tab, page, fetchTrades]);

  const holdings = summary?.holdings ?? [];

  const dashboardData = useMemo(() => {
    if (!summary) return null;
    const lotsOpen = (summary.holdings ?? []).reduce((a, h) => a + (Number(h.lots) || 0), 0);
    const equity = Number(summary.total_equity) || 0;
    const balance = Number(summary.total_balance) || 0;
    // Approx: each open lot blocks ~$1000 margin (100:1 leverage on ~$100k notional).
    // Replace with real per-position margin once backend exposes it.
    const approxUsedMargin = Math.min(equity, lotsOpen * 1000);
    const freeMargin = Math.max(0, equity - approxUsedMargin);
    const marginLevel =
      approxUsedMargin > 0 ? `${((equity / approxUsedMargin) * 100).toFixed(1)}%` : null;
    const periodKey = TF_TO_PERIOD[tf] || 'all';
    const periodPnl =
      periodKey === '1m' ? summary.pnl_breakdown?.this_month ?? 0 :
      periodKey === 'all' ? summary.pnl_breakdown?.all_time ?? 0 :
      summary.pnl_breakdown?.this_month ?? 0;
    return buildDashboardFromPortfolio({
      balance,
      equity,
      allTimePnl: summary.pnl_breakdown?.all_time ?? 0,
      lotsFromOpenPositions: lotsOpen,
      periodPnl,
      winRateFallback: performance?.stats?.win_rate ?? 0,
      sharpeRatio: performance?.stats?.sharpe_ratio ?? 0,
      trades: allTrades,
      equityCurve: performance?.equity_curve ?? [],
      freeMargin,
      usedMargin: approxUsedMargin,
      marginLevel,
      currency: 'USD',
    });
  }, [summary, performance, allTrades, tf]);

  const tabs = [
    { id: 'overview', label: 'Open positions', count: holdings.length },
    { id: 'history', label: 'Trade history' },
  ];

  if (loading) {
    return <LoadingShell />;
  }

  if (error) {
    return (
      <DashboardShell>
        <div className="page-main">
          <Card>
            <EmptyState
              title="Could not load portfolio"
              description={<span className="text-danger">{error}</span>}
              action={
                <Button variant="outline" size="sm" onClick={fetchData}>
                  Retry
                </Button>
              }
            />
          </Card>
        </div>
      </DashboardShell>
    );
  }

  const openPl = Number(summary?.total_unrealized_pnl) || 0;

  return (
    <DashboardShell>
      <div className="page-main space-y-4 md:space-y-5 text-text-primary animate-fade-in">
        <PageHeader
          title={validAccountId ? 'Trading journal' : 'Portfolio'}
          description="All-time performance, open positions and closed trade history."
          actions={
            accountOptions.length > 0 ? (
              <div className="w-56">
                <Select
                  size="sm"
                  value={validAccountId ?? ''}
                  onChange={(e) => onPickAccount(e.target.value)}
                  aria-label="Filter by trading account"
                >
                  <option value="">All accounts</option>
                  {accountOptions.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.is_demo ? 'Demo' : 'Live'} {a.account_number || a.id.slice(0, 8)}
                    </option>
                  ))}
                </Select>
              </div>
            ) : undefined
          }
        >
          <Tabs variant="underline" aria-label="Portfolio sections" tabs={tabs} active={tab} onChange={setTab} />
        </PageHeader>

        {invalidAccountParam ? (
          <div className="rounded-lg border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-text-primary">
            Invalid account id in the URL — showing your full portfolio.{' '}
            <Link href="/portfolio" className="font-semibold text-accent underline underline-offset-2 hover:text-accent-hover">
              Reset
            </Link>
          </div>
        ) : null}

        {validAccountId ? (
          <div className="rounded-lg border border-accent/30 bg-accent/10 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xxs font-bold uppercase tracking-[0.12em] text-accent">Account scope</p>
              <p className="text-sm text-text-primary mt-0.5">
                Journal and trade list for{' '}
                <span className="font-mono font-semibold tabular-nums">
                  {accountNoLabel ? `#${accountNoLabel}` : validAccountId.slice(0, 8) + '…'}
                </span>
              </p>
            </div>
            <Link
              href="/portfolio"
              className="text-xs font-semibold text-accent hover:text-accent-hover underline underline-offset-2 shrink-0"
            >
              View all accounts
            </Link>
          </div>
        ) : null}

        {/* KPI strip */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Balance" value={fmt(Number(summary?.total_balance) || 0)} />
          <StatCard label="Equity" value={fmt(Number(summary?.total_equity) || 0)} />
          <StatCard
            label="Open P/L"
            value={<span className={pnlClass(openPl)}>{signed(openPl)}</span>}
            delta={
              summary?.pnl_breakdown ? (
                <span className={cn('font-mono tabular-nums text-xs font-semibold', pnlClass(summary.pnl_breakdown.today))}>
                  {signed(summary.pnl_breakdown.today)} today
                </span>
              ) : undefined
            }
          />
          <StatCard
            label="Open positions"
            value={summary?.open_positions_count ?? holdings.length}
            hint={summary?.pnl_breakdown ? `All-time P/L ${signed(summary.pnl_breakdown.all_time)}` : undefined}
          />
        </div>

        {/* Timeframe selector retired — portfolio always shows all-time data
            (per client decision). The TIMEFRAMES + setTf scaffolding stays
            in place behind the scenes (forced to 'All') so re-introducing
            per-period stats later is a one-component change. */}

        {dashboardData ? <TradingOverview data={dashboardData} /> : null}

        {tab === 'overview' && (
          <Card padding="none" className="overflow-hidden">
            <CardHeader title="Open positions" className="px-4 md:px-5 pt-4 md:pt-5 mb-0 pb-3 border-b border-border-primary" />

            {/* Mobile card layout */}
            <div className="md:hidden p-2 space-y-2">
              {holdings.length === 0 ? (
                <EmptyState compact icon={<Inbox />} title="No open positions" />
              ) : (
                holdings.map((h, i) => (
                  <Card key={i} nested padding="sm" className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-text-primary">{h.symbol}</span>
                        <SideBadge side={h.side} />
                      </div>
                      <div className="text-right">
                        <span className={cn('text-sm font-mono font-semibold tabular-nums', pnlClass(h.pnl))}>
                          {signed(h.pnl)}
                        </span>
                        {h.pnl_pct !== undefined && (
                          <span className={cn('text-xxs ml-1 font-mono tabular-nums', pnlClass(h.pnl_pct))}>
                            ({h.pnl_pct >= 0 ? '+' : ''}{h.pnl_pct.toFixed(2)}%)
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-x-3 text-xs">
                      <div><span className="text-text-tertiary">Lots</span> <span className="text-text-primary font-mono tabular-nums">{h.lots}</span></div>
                      <div><span className="text-text-tertiary">Entry</span> <span className="text-text-secondary font-mono tabular-nums">{h.entry_price}</span></div>
                      <div><span className="text-text-tertiary">Now</span> <span className="text-text-primary font-mono tabular-nums">{h.current_price}</span></div>
                    </div>
                  </Card>
                ))
              )}
            </div>

            {/* Desktop table layout */}
            <div className="hidden md:block">
              <Table>
                <THead>
                  <TR>
                    <TH>Symbol</TH>
                    <TH>Side</TH>
                    <TH align="right">Lots</TH>
                    <TH align="right">Entry</TH>
                    <TH align="right">Current</TH>
                    <TH align="right">P&L</TH>
                  </TR>
                </THead>
                <TBody>
                  {holdings.length === 0 ? (
                    <TR>
                      <TD colSpan={6} className="p-0">
                        <EmptyState compact icon={<Inbox />} title="No open positions" />
                      </TD>
                    </TR>
                  ) : (
                    holdings.map((h, i) => (
                      <TR key={i} interactive>
                        <TD className="font-semibold">{h.symbol}</TD>
                        <TD><SideBadge side={h.side} /></TD>
                        <TD numeric muted>{h.lots}</TD>
                        <TD numeric muted>{h.entry_price}</TD>
                        <TD numeric>{h.current_price}</TD>
                        <TD numeric className={cn('font-semibold', pnlClass(h.pnl))}>
                          {signed(h.pnl)}
                          {h.pnl_pct !== undefined && (
                            <span className={cn('text-xxs ml-1', pnlClass(h.pnl_pct))}>
                              ({h.pnl_pct >= 0 ? '+' : ''}{h.pnl_pct.toFixed(2)}%)
                            </span>
                          )}
                        </TD>
                      </TR>
                    ))
                  )}
                </TBody>
              </Table>
            </div>
          </Card>
        )}

        {tab === 'history' && (
          <>
            <Card padding="none" className="overflow-hidden">
              <CardHeader
                title="Trade history"
                description="PDF includes all closed trades on file (paginated fetch, up to 10,000 rows)."
                className="px-4 md:px-5 pt-4 md:pt-5 mb-0 pb-3 border-b border-border-primary"
                actions={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    loading={pdfExporting}
                    disabled={pdfExporting}
                    onClick={() => void handleDownloadTradeStatementPdf()}
                    leftIcon={<FileDown className="w-4 h-4" aria-hidden />}
                  >
                    Download PDF statement
                  </Button>
                }
              />

              {/* Mobile card layout */}
              <div className="md:hidden p-2 space-y-2">
                {trades.length === 0 ? (
                  <EmptyState compact icon={<Inbox />} title="No trade history" />
                ) : (
                  trades.map((t) => {
                    const ex = tradeExitLabel(t.close_reason, t.exit_price ?? t.close_price, getDigits(t.symbol));
                    return (
                      <Card key={t.id} nested padding="sm" className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-text-primary">{t.symbol}</span>
                            <SideBadge side={t.side} />
                            <Badge variant={ex.variant} size="sm" tone="outline">{ex.text}</Badge>
                          </div>
                          <span className={cn('text-sm font-mono font-semibold tabular-nums', pnlClass(t.pnl))}>
                            {signed(t.pnl)}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-x-3 text-xs">
                          <div><span className="text-text-tertiary">Lots</span> <span className="text-text-primary font-mono tabular-nums">{t.lots}</span></div>
                          <div><span className="text-text-tertiary">Dur.</span> <span className="text-text-secondary">{t.duration ?? '—'}</span></div>
                          <div className="text-text-tertiary text-xxs">{new Date(t.close_time || t.open_time).toLocaleDateString()}</div>
                        </div>
                      </Card>
                    );
                  })
                )}
              </div>

              {/* Desktop table layout */}
              <div className="hidden md:block">
                <Table>
                  <THead>
                    <TR>
                      <TH>Date</TH>
                      <TH>Symbol</TH>
                      <TH>Side</TH>
                      <TH align="right">Lots</TH>
                      <TH align="right">Duration</TH>
                      <TH>Exit</TH>
                      <TH align="right">P&L</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {trades.length === 0 ? (
                      <TR>
                        <TD colSpan={7} className="p-0">
                          <EmptyState compact icon={<Inbox />} title="No trade history" />
                        </TD>
                      </TR>
                    ) : (
                      trades.map((t) => {
                        const ex = tradeExitLabel(t.close_reason, t.exit_price ?? t.close_price, getDigits(t.symbol));
                        return (
                          <TR key={t.id} interactive>
                            <TD muted className="text-xs">{new Date(t.close_time || t.open_time).toLocaleString()}</TD>
                            <TD className="font-semibold">{t.symbol}</TD>
                            <TD><SideBadge side={t.side} /></TD>
                            <TD numeric muted>{t.lots}</TD>
                            <TD align="right" muted className="text-xs">{t.duration ?? '—'}</TD>
                            <TD><Badge variant={ex.variant} size="sm" tone="outline">{ex.text}</Badge></TD>
                            <TD numeric className={cn('font-semibold', pnlClass(t.pnl))}>{signed(t.pnl)}</TD>
                          </TR>
                        );
                      })
                    )}
                  </TBody>
                </Table>
              </div>
            </Card>

            {totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-center gap-1.5">
                <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(1)}>
                  « First
                </Button>
                <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  ← Prev
                </Button>
                {(() => {
                  const maxButtons = 7;
                  const half = Math.floor(maxButtons / 2);
                  let start = Math.max(1, page - half);
                  const end = Math.min(totalPages, start + maxButtons - 1);
                  start = Math.max(1, end - maxButtons + 1);
                  const nums: number[] = [];
                  for (let i = start; i <= end; i += 1) nums.push(i);
                  return nums.map((n) => (
                    <Button
                      key={n}
                      variant={n === page ? 'primary' : 'outline'}
                      size="sm"
                      onClick={() => setPage(n)}
                      aria-current={n === page ? 'page' : undefined}
                      className="min-w-[32px] px-2 font-mono tabular-nums"
                    >
                      {n}
                    </Button>
                  ));
                })()}
                <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                  Next →
                </Button>
                <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>
                  Last »
                </Button>
                <span className="ml-2 text-xs text-text-tertiary font-mono tabular-nums">
                  Page {page} of {totalPages}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}

export default function PortfolioPage() {
  return (
    <Suspense fallback={<LoadingShell />}>
      <PortfolioPageContent />
    </Suspense>
  );
}
