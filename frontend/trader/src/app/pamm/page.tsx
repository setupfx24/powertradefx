'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import DashboardShell from '@/components/layout/DashboardShell';
import DemoLockGate from '@/components/demo/DemoLockGate';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { formatNumber as fmt } from '@/lib/formatters';
import {
  Badge, Button, Card, CardHeader, EmptyState, Input, Modal, PageHeader, SideBadge,
  Skeleton, StatCard, Table, THead, TBody, TR, TH, TD, Tabs, Textarea,
} from '@/components/ui';
import {
  TrendingUp, Users, DollarSign, AlertCircle, BarChart2,
  Wallet, Clock, CheckCircle, Info,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────


interface MammPammAccount {
  id: string;
  manager_name: string;
  master_type: string;
  total_return_pct: number;
  max_drawdown_pct: number;
  performance_fee_pct: number;
  min_investment: number;
  active_investors: number;
  slots_available: number;
  aum: number;
  win_rate: number;
  total_trades: number;
  description: string;
}

interface MyAllocation {
  id: string;
  master_id: string;
  manager_name: string;
  master_type: string;
  allocation_amount: number;
  current_value: number;
  realized_pnl: number;
  unrealized_pnl: number;
  total_pnl: number;
  pnl_pct: number;
  performance_fee_pct: number;
  joined_at: string;
  status: string;
}

interface AllocationSummary {
  total_invested: number;
  total_current_value: number;
  total_pnl: number;
  overall_pnl_pct: number;
}

interface MasterInvestor {
  id: string;
  user_name: string;
  user_email: string;
  account_number: string;
  allocated: number;
  pnl: number;
  pnl_pct: number;
  share_pct: number;
  copy_type: string;
  joined_at: string;
}

interface MonthlyRow {
  month: string;
  profit: number;
  cumulative: number;
}

interface MasterPerformance {
  id: string;
  status: string;
  master_type: string;
  total_aum: number;
  total_investors: number;
  fee_earnings: number;
  total_return_pct: number;
  max_drawdown_pct: number;
  sharpe_ratio: number;
  performance_fee_pct: number;
  management_fee_pct: number;
  admin_commission_pct: number;
  min_investment: number;
  max_investors: number;
  description: string | null;
  monthly_breakdown: MonthlyRow[];
}

interface MyProvider {
  id: string;
  status: string;
  master_type: string;
  performance_fee_pct: number;
  management_fee_pct: number;
  min_investment: number;
  max_investors: number;
}

interface TradingAccount {
  id: string;
  account_number: string;
  balance: number;
  is_demo: boolean;
  currency: string;
}

type Tab = 'browse' | 'investments' | 'apply' | 'dashboard';

// ─── Shared helpers ─────────────────────────────────────────────────────────────
// `fmt` re-exported from the shared formatter module so PAMM stays
// consistent with the rest of the trader app.

/** P/L colour by sign: green up, red down. */
const pnlClass = (n: number) => (n >= 0 ? 'text-success' : 'text-danger');

/** "$1,234.56" with the browser locale (matches the previous summary cards). */
const usd = (n: number, dp = 2) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp })}`;

function TypeBadge({ type }: { type: string }) {
  return <Badge variant="accent" size="sm">{type}</Badge>;
}

function PnlText({ value, suffix = '', currency, className }: { value: number; suffix?: string; currency?: boolean; className?: string }) {
  return (
    <span className={cn('font-mono tabular-nums', pnlClass(value), className)}>
      {value >= 0 ? '+' : ''}{currency ? '$' : ''}{fmt(value)}{suffix}
    </span>
  );
}

/** Label / value line inside a card. */
function KV({ label, children, className }: { label: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-2 text-xs', className)}>
      <span className="text-text-tertiary">{label}</span>
      <span className="font-mono tabular-nums text-text-primary">{children}</span>
    </div>
  );
}

function LoadingGrid({ cards = 3, className }: { cards?: number; className?: string }) {
  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4', className)} aria-busy>
      {Array.from({ length: cards }).map((_, i) => (
        <Skeleton key={i} className="h-48 w-full rounded-lg" />
      ))}
    </div>
  );
}

/** Wallet balance strip used by the invest / refill modals. */
function WalletStrip({ label, balance, onMax }: { label: string; balance: number; onMax: () => void }) {
  return (
    <Card nested padding="sm" className="flex items-center justify-between gap-3">
      <div>
        <p className="text-xxs font-bold uppercase tracking-[0.12em] text-text-tertiary">{label}</p>
        <p className="text-lg font-semibold text-accent font-mono tabular-nums">{usd(balance)}</p>
      </div>
      <Button type="button" variant="link" size="xs" onClick={onMax}>Max</Button>
    </Card>
  );
}

function TradeRow({ t }: { t: { symbol: string; side: string; lots: number; open_price: number; close_price?: number; master_pnl: number; your_share: number; status: string; opened_at?: string; closed_at?: string } }) {
  return (
    <Card nested padding="sm">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <SideBadge side={t.side} />
          <span className="text-xs font-semibold text-text-primary">{t.symbol}</span>
          <span className="text-xxs text-text-tertiary">{t.lots} lots</span>
          {t.status === 'open' && <Badge variant="warning" size="sm">Live</Badge>}
        </div>
        <PnlText value={t.master_pnl} currency className="text-xs font-bold" />
      </div>
      <div className="flex items-center justify-between mt-1.5 text-xxs text-text-tertiary">
        <span className="font-mono tabular-nums">
          {t.open_price.toFixed(5)}
          {t.close_price != null && ` → ${t.close_price.toFixed(5)}`}
        </span>
        <span>
          Your share: <PnlText value={t.your_share} currency className="font-semibold" />
        </span>
      </div>
    </Card>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────────

export default function PammPage() {
  const isDemo = useAuthStore((s) => s.user?.is_demo);
  const [activeTab, setActiveTab] = useState<Tab>('browse');

  // Browse
  const [accounts, setAccounts] = useState<MammPammAccount[]>([]);
  const [browseLoading, setBrowseLoading] = useState(true);
  const [browseError, setBrowseError] = useState<string | null>(null);

  // My Investments
  const [allocations, setAllocations] = useState<MyAllocation[]>([]);
  const [summary, setSummary] = useState<AllocationSummary | null>(null);
  const [allocLoading, setAllocLoading] = useState(false);
  const [withdrawTarget, setWithdrawTarget] = useState<MyAllocation | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [expandedAlloc, setExpandedAlloc] = useState<string | null>(null);
  const [allocTrades, setAllocTrades] = useState<Record<string, { open_trades: any[]; closed_trades: any[]; your_ratio_pct: number }>>({});
  const [tradesLoading, setTradesLoading] = useState<string | null>(null);

  const toggleAllocTrades = async (alloc: MyAllocation) => {
    if (expandedAlloc === alloc.id) {
      setExpandedAlloc(null);
      return;
    }
    setExpandedAlloc(alloc.id);
    if (alloc.master_type !== 'pamm') return; // only PAMM has master trades view
    if (allocTrades[alloc.id]) return; // cached
    setTradesLoading(alloc.id);
    try {
      const res = await api.get<{ open_trades: any[]; closed_trades: any[]; your_ratio_pct: number }>(
        `/social/pamm/${alloc.id}/trades`,
      );
      setAllocTrades((prev) => ({ ...prev, [alloc.id]: res }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load trades');
    } finally {
      setTradesLoading(null);
    }
  };

  // My Dashboard
  const [performance, setPerformance] = useState<MasterPerformance | null>(null);
  const [investors, setInvestors] = useState<MasterInvestor[]>([]);
  const [dashLoading, setDashLoading] = useState(false);

  // Provider / apply
  const [myProvider, setMyProvider] = useState<MyProvider | null>(null);
  const [providerChecked, setProviderChecked] = useState(false);
  const [applying, setApplying] = useState(false);

  // Refill modal
  const [refillTarget, setRefillTarget] = useState<MyAllocation | null>(null);
  const [refillAmount, setRefillAmount] = useState('');
  const [refilling, setRefilling] = useState(false);

  // Invest modal
  const [investTarget, setInvestTarget] = useState<MammPammAccount | null>(null);
  const [liveAccounts, setLiveAccounts] = useState<TradingAccount[]>([]);
  const [investAccount, setInvestAccount] = useState('');
  const [investAmount, setInvestAmount] = useState('');
  const [investScaling, setInvestScaling] = useState('100');
  const [investing, setInvesting] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);

  // Apply form state
  const [applyAccount, setApplyAccount] = useState('');
  // PAMM page applies only for PAMM manager type; MAM applications live in /social.
  const applyType = 'pamm' as const;
  const [applyFee, setApplyFee] = useState('20');
  const [applyMgmtFee, setApplyMgmtFee] = useState('0');
  const [applyMinInv, setApplyMinInv] = useState('100');
  const [applyMaxInv, setApplyMaxInv] = useState('100');
  const [applyDesc, setApplyDesc] = useState('');

  // ─── Data fetchers ─────────────────────────────────────────────────────────

  const fetchBrowse = useCallback(async () => {
    setBrowseLoading(true);
    setBrowseError(null);
    try {
      const res = await api.get<{ items: MammPammAccount[] }>('/social/mamm-pamm');
      setAccounts(res.items ?? []);
    } catch (err: unknown) {
      setBrowseError(err instanceof Error ? err.message : 'Failed to load managed accounts');
    } finally {
      setBrowseLoading(false);
    }
  }, []);

  const fetchAllocations = useCallback(async () => {
    setAllocLoading(true);
    try {
      const res = await api.get<{ items: MyAllocation[]; summary: AllocationSummary }>('/social/my-allocations');
      setAllocations(res.items ?? []);
      setSummary(res.summary ?? null);
    } catch {
      // empty state
    } finally {
      setAllocLoading(false);
    }
  }, []);

  const fetchDashboard = useCallback(async () => {
    setDashLoading(true);
    try {
      const [perfRes, invRes] = await Promise.all([
        api.get<MasterPerformance>('/social/master-performance'),
        api.get<{ investors: MasterInvestor[] }>('/social/master-investors'),
      ]);
      setPerformance(perfRes);
      setInvestors(invRes.investors ?? []);
    } catch {
      setPerformance(null);
    } finally {
      setDashLoading(false);
    }
  }, []);

  const fetchProvider = useCallback(async () => {
    try {
      // PAMM page shows only the user's PAMM manager application — MAM lives on /social.
      const res = await api.get<MyProvider>('/social/my-provider?master_type=pamm');
      setMyProvider(res);
    } catch {
      setMyProvider(null);
    } finally {
      setProviderChecked(true);
    }
  }, []);

  const fetchLiveAccounts = useCallback(async () => {
    try {
      const res = await api.get<{ items: TradingAccount[] }>('/accounts');
      const live = (res.items || []).filter((a) => !a.is_demo);
      setLiveAccounts(live);
      if (live.length > 0) {
        setInvestAccount(live[0]!.id);
        setApplyAccount(live[0]!.id);
      }
    } catch {}
  }, []);

  const fetchWallet = useCallback(async () => {
    try {
      const s = await api.get<{ main_wallet_balance?: number }>('/wallet/summary');
      setWalletBalance(Number(s.main_wallet_balance) || 0);
    } catch { setWalletBalance(0); }
  }, []);

  useEffect(() => {
    fetchBrowse();
    fetchProvider();
    fetchLiveAccounts();
    fetchWallet();
    // The top summary cards ("My PAMM Investments" / "Total Profit") are
    // always visible — above the tabs — so their data must load on mount,
    // not only when the "My Investments" tab is opened. Without this they
    // read a null summary and show $0.00 / In 0 Accounts even when the user
    // has active allocations.
    fetchAllocations();
  }, [fetchBrowse, fetchProvider, fetchLiveAccounts, fetchWallet, fetchAllocations]);

  useEffect(() => {
    if (activeTab === 'investments') fetchAllocations();
    if (activeTab === 'dashboard') fetchDashboard();
  }, [activeTab, fetchAllocations, fetchDashboard]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const openInvest = (a: MammPammAccount) => {
    setInvestTarget(a);
    setInvestAmount(String(a.min_investment));
    setInvestScaling('100');
    if (liveAccounts.length > 0) setInvestAccount(liveAccounts[0]!.id);
  };

  const submitInvest = async () => {
    if (!investTarget) return;
    const amount = parseFloat(investAmount);
    if (!investAccount || isNaN(amount) || amount <= 0) { toast.error('Enter a valid amount'); return; }
    if (amount < investTarget.min_investment) { toast.error(`Minimum investment is $${investTarget.min_investment}`); return; }
    if (amount > walletBalance) { toast.error('Insufficient wallet balance'); return; }
    setInvesting(true);
    try {
      const params = new URLSearchParams({ account_id: investAccount, amount: investAmount });
      if (investTarget.master_type === 'mamm') {
        const s = parseFloat(investScaling);
        if (isNaN(s) || s < 1 || s > 500) { toast.error('Volume scaling must be 1–500'); setInvesting(false); return; }
        params.set('volume_scaling_pct', investScaling);
      }
      const res = await api.post<{ top_up?: number }>(`/social/mamm-pamm/${investTarget.id}/invest?${params.toString()}`, {});
      toast.success(res?.top_up ? `Top-up of $${res.top_up.toFixed(2)} added!` : 'Investment started! Amount deducted from wallet.');
      setInvestTarget(null);
      fetchBrowse();
      fetchWallet();
      if (activeTab === 'investments') fetchAllocations();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to invest');
    } finally {
      setInvesting(false);
    }
  };

  const submitWithdraw = async () => {
    if (!withdrawTarget) return;
    setWithdrawing(true);
    try {
      const res = await api.delete<{ returned_to_wallet?: number }>(`/social/mamm-pamm/${withdrawTarget.id}/withdraw`);
      const returned = res?.returned_to_wallet;
      toast.success(returned != null ? `$${returned.toFixed(2)} returned to wallet` : 'Withdrawal complete');
      setWithdrawTarget(null);
      fetchAllocations();
      fetchWallet();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to withdraw');
    } finally {
      setWithdrawing(false);
    }
  };

  const openRefill = (a: MyAllocation) => {
    setRefillTarget(a);
    setRefillAmount('');
    fetchWallet();
  };

  const submitRefill = async () => {
    if (!refillTarget) return;
    const amt = parseFloat(refillAmount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (amt > walletBalance) { toast.error('Insufficient wallet balance'); return; }
    setRefilling(true);
    try {
      const acctId = liveAccounts[0]?.id;
      if (!acctId) { toast.error('No trading account found'); setRefilling(false); return; }
      await api.post(`/social/mamm-pamm/${refillTarget.master_id}/invest?account_id=${acctId}&amount=${amt}`, {});
      toast.success(`Added $${amt.toFixed(2)} to ${refillTarget.manager_name}`);
      setRefillTarget(null);
      fetchAllocations();
      fetchWallet();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Refill failed');
    } finally {
      setRefilling(false);
    }
  };

  const submitApply = async () => {
    setApplying(true);
    try {
      // Server auto-creates a dedicated master trading account (PM/MM prefix)
      // inside become_provider — no need to pre-create or pick one here.
      const params = new URLSearchParams({
        master_type: applyType,
        performance_fee_pct: applyFee,
        management_fee_pct: applyMgmtFee,
        min_investment: applyMinInv,
        max_investors: applyMaxInv,
        ...(applyDesc ? { description: applyDesc } : {}),
      });
      const res = await api.post<{ account_number?: string }>(
        `/social/become-provider?${params.toString()}`,
        {},
      );
      toast.success(
        res?.account_number
          ? `Application submitted — master account ${res.account_number} created`
          : 'Application submitted for review',
      );
      fetchProvider();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to submit');
    } finally {
      setApplying(false);
    }
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: 'browse', label: 'Browse' },
    { id: 'investments', label: 'My Investments' },
    { id: 'apply', label: 'Become Manager' },
    { id: 'dashboard', label: 'My Dashboard' },
  ];


  // ─── Render ─────────────────────────────────────────────────────────────────

  if (isDemo) {
    return (
      <DashboardShell>
        <DemoLockGate
          feature="PAMM"
          description="Managed-account investing is only available on real trading accounts. Register a live account to allocate funds to a manager."
        >
          <></>
        </DemoLockGate>
      </DashboardShell>
    );
  }

  const featured = [...accounts].sort((a, b) => b.total_return_pct - a.total_return_pct).slice(0, 4);
  const overallRoi = summary?.overall_pnl_pct ?? 0;

  return (
    <DashboardShell>
      <div className="space-y-4 md:space-y-5">

        <PageHeader
          eyebrow="Managed accounts"
          title="PAMM Accounts"
          description="Choose a PAMM account to copy trade and grow your profits."
          actions={
            <Button type="button" variant="secondary" leftIcon={<Wallet size={14} />} onClick={() => { setActiveTab('browse'); }}>
              Invest Now
            </Button>
          }
        />

        {/* ── Top KPIs ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="My PAMM Investments"
            value={usd(summary?.total_invested ?? 0)}
            hint={`In ${allocations.length} ${allocations.length === 1 ? 'Account' : 'Accounts'}`}
            icon={<Users />}
          />
          <StatCard
            label="Total Profit (All PAMM)"
            value={usd(summary?.total_pnl ?? 0)}
            delta={
              <span className={cn('font-mono tabular-nums text-xs font-semibold', pnlClass(overallRoi))}>
                {overallRoi >= 0 ? '+' : ''}{overallRoi.toFixed(2)}% Overall ROI
              </span>
            }
            icon={<TrendingUp />}
          />
          <StatCard
            label="Available Balance"
            value={usd(walletBalance)}
            hint="Main wallet"
            icon={<Wallet />}
          />
          <StatCard
            label="Total PAMM Accounts"
            value={accounts.length}
            hint="Active PAMM Accounts"
            icon={<BarChart2 />}
          />
        </div>

        {/* ── Top 4 featured accounts (sorted by ROI desc) ── */}
        {featured.length > 0 && (
          <section>
            <div className="flex items-baseline justify-between gap-2 mb-3">
              <h2 className="text-md font-semibold text-text-primary">Top PAMM Accounts</h2>
              <p className="text-xs text-text-tertiary">Sorted by ROI (High to Low)</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {featured.map((a, idx) => {
                const rank = idx + 1;
                // Style label derived from master_type.
                const styleLabel =
                  a.master_type === 'pamm' ? 'PAMM Manager'
                  : a.master_type === 'mam' ? 'Trade Master'
                  : 'Copy Trading Master';
                const aum = a.aum || 0;
                // Total Return = AUM × ROI%
                const totalReturnUsd = aum * (a.total_return_pct / 100);
                return (
                  <Card key={a.id} interactive className="relative flex flex-col" onClick={() => openInvest(a)}>
                    <div className="flex items-center justify-between">
                      <Badge tone="solid" variant={rank === 1 ? 'accent' : 'neutral'} aria-label={`Rank ${rank}`}>{rank}</Badge>
                      <Badge variant="success" size="sm" dot>Active</Badge>
                    </div>

                    {/* Name + style — avatar skipped per client direction */}
                    <div className="mt-4 text-center">
                      <p className="text-md font-semibold text-text-primary truncate">{a.manager_name}</p>
                      <p className="text-xs text-text-secondary mt-0.5">{styleLabel}</p>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                      <div>
                        <p className="text-xxs uppercase tracking-[0.12em] text-text-tertiary">ROI (All Time)</p>
                        <p className={cn('text-sm font-bold font-mono tabular-nums mt-0.5', pnlClass(a.total_return_pct))}>
                          {a.total_return_pct >= 0 ? '+' : ''}{a.total_return_pct.toFixed(2)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xxs uppercase tracking-[0.12em] text-text-tertiary">Total Return</p>
                        <p className="text-sm font-bold text-text-primary font-mono tabular-nums mt-0.5">
                          ${totalReturnUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-1.5">
                      <KV label="Max Drawdown">{a.max_drawdown_pct.toFixed(2)}%</KV>
                      <KV label="Win Rate">{a.total_trades > 0 ? `${a.win_rate.toFixed(0)}%` : 'No trades yet'}</KV>
                      <KV label="AUM">${aum.toLocaleString(undefined, { maximumFractionDigits: 0 })}</KV>
                      <KV label="Investors">{a.active_investors}</KV>
                    </div>

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      fullWidth
                      className="mt-4"
                      onClick={(e) => { e.stopPropagation(); openInvest(a); }}
                    >
                      View Details &amp; Invest
                    </Button>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        {/* Section tabs */}
        <Tabs
          variant="underline"
          aria-label="PAMM sections"
          tabs={TABS}
          active={activeTab}
          onChange={(id) => setActiveTab(id as Tab)}
          className="overflow-x-auto"
        />

        {/* ── Browse ── */}
        {activeTab === 'browse' && (
          <>
            {browseLoading && <LoadingGrid />}
            {!browseLoading && browseError && (
              <div role="alert" className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-danger/25 bg-danger/10 text-danger text-sm">
                <div className="flex items-center gap-2"><AlertCircle size={14} /> {browseError}</div>
                <Button type="button" variant="danger" size="xs" onClick={fetchBrowse}>Retry</Button>
              </div>
            )}
            {!browseLoading && !browseError && accounts.length === 0 && (
              <EmptyState
                icon={<TrendingUp />}
                title="No managed accounts available"
                description="PAMM managers will appear here once approved"
              />
            )}
            {!browseLoading && !browseError && accounts.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts.map((a) => (
                  <Card key={a.id} interactive className="flex flex-col" onClick={() => openInvest(a)}>
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <div className="min-w-0">
                        <p className="text-md font-semibold text-text-primary truncate">{a.manager_name}</p>
                        <div className="mt-1"><TypeBadge type={a.master_type} /></div>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="shrink-0"
                        onClick={(e) => { e.stopPropagation(); openInvest(a); }}
                      >
                        Invest
                      </Button>
                    </div>
                    <div className="mb-4">
                      <p className="text-xxs uppercase tracking-[0.12em] text-text-tertiary mb-0.5">Total ROI</p>
                      <p className={cn('text-2xl font-semibold font-mono tabular-nums', pnlClass(a.total_return_pct))}>
                        {a.total_return_pct >= 0 ? '+' : ''}{a.total_return_pct.toFixed(2)}%
                      </p>
                    </div>
                    {a.description && <p className="text-xs text-text-tertiary mb-4 line-clamp-2">{a.description}</p>}
                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border-secondary mt-auto">
                      <div>
                        <p className="text-xxs text-text-tertiary">Drawdown</p>
                        <p className="text-xs font-semibold font-mono tabular-nums text-danger">{a.max_drawdown_pct.toFixed(2)}%</p>
                      </div>
                      <div>
                        <p className="text-xxs text-text-tertiary">Investors</p>
                        <p className="text-xs font-semibold font-mono tabular-nums text-text-primary">{a.active_investors}</p>
                      </div>
                      <div>
                        <p className="text-xxs text-text-tertiary">Slots</p>
                        <p className="text-xs font-semibold font-mono tabular-nums text-text-primary">{a.slots_available}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3 text-xxs text-text-tertiary">
                      <span className="flex items-center gap-1"><TrendingUp size={10} /> Fee: {a.performance_fee_pct}%</span>
                      <span className="flex items-center gap-1"><DollarSign size={10} /> Min: ${a.min_investment.toLocaleString()}</span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── My Investments ── */}
        {activeTab === 'investments' && (
          <>
            {allocLoading && <LoadingGrid />}
            {!allocLoading && (
              <>
                {summary && allocations.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <StatCard label="Total Invested" value={`$${fmt(summary.total_invested)}`} />
                    <StatCard label="Current Value" value={`$${fmt(summary.total_current_value)}`} />
                    <StatCard
                      label="Total P&L"
                      value={<span className={pnlClass(summary.total_pnl)}>{summary.total_pnl >= 0 ? '+' : ''}${fmt(summary.total_pnl)}</span>}
                    />
                    <StatCard
                      label="P&L %"
                      value={<span className={pnlClass(summary.overall_pnl_pct)}>{summary.overall_pnl_pct >= 0 ? '+' : ''}{summary.overall_pnl_pct.toFixed(2)}%</span>}
                    />
                  </div>
                )}

                {allocations.length === 0 ? (
                  <EmptyState
                    icon={<Wallet />}
                    title="No active investments"
                    description="Browse managers and invest to get started"
                    action={
                      <Button type="button" variant="primary" onClick={() => setActiveTab('browse')}>
                        Browse Managers
                      </Button>
                    }
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {allocations.map((a) => (
                      <Card key={a.id} className="flex flex-col">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="min-w-0">
                            <p className="text-md font-semibold text-text-primary truncate">{a.manager_name}</p>
                            <div className="mt-1"><TypeBadge type={a.master_type} /></div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {a.status === 'active' && (
                              <Button type="button" variant="outline" size="xs" onClick={() => openRefill(a)}>
                                + Refill
                              </Button>
                            )}
                            <Button type="button" variant="danger" size="xs" onClick={() => setWithdrawTarget(a)}>
                              Withdraw
                            </Button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <KV label="Invested"><span className="font-semibold">${fmt(a.allocation_amount)}</span></KV>
                          <KV label="Current Value"><span className="font-semibold">${fmt(a.current_value)}</span></KV>
                          <div className="flex items-center justify-between gap-2 text-xs pt-2 border-t border-border-secondary">
                            <span className="text-text-tertiary">Total P&L</span>
                            <div className="text-right">
                              <p className="font-bold"><PnlText value={a.total_pnl} /></p>
                              <p className="text-xxs"><PnlText value={a.pnl_pct} suffix="%" /></p>
                            </div>
                          </div>
                          <KV label="Realized">
                            <span className={cn('opacity-70', pnlClass(a.realized_pnl))}>${fmt(Math.abs(a.realized_pnl))}</span>
                          </KV>
                          <KV label="Unrealized">
                            <span className={cn('opacity-70', pnlClass(a.unrealized_pnl))}>${fmt(Math.abs(a.unrealized_pnl))}</span>
                          </KV>
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-secondary text-xxs text-text-tertiary">
                          <span>Fee: {a.performance_fee_pct}%</span>
                          <span>Joined {new Date(a.joined_at).toLocaleDateString()}</span>
                        </div>

                        {a.master_type === 'pamm' && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            fullWidth
                            className="mt-3 text-accent hover:text-accent"
                            onClick={() => void toggleAllocTrades(a)}
                          >
                            {expandedAlloc === a.id ? 'Hide Master Trades' : 'View Master Trades'}
                          </Button>
                        )}

                        {expandedAlloc === a.id && a.master_type === 'pamm' && (
                          <div className="mt-3 pt-3 border-t border-border-secondary max-h-64 overflow-y-auto">
                            {tradesLoading === a.id ? (
                              <div className="space-y-2" aria-busy>
                                <Skeleton className="h-12 w-full" />
                                <Skeleton className="h-12 w-full" />
                              </div>
                            ) : allocTrades[a.id] ? (
                              (() => {
                                /* Extract once so TS narrows the Record access. */
                                const alloc = allocTrades[a.id]!;
                                return (
                                  <div className="space-y-2">
                                    <p className="text-xxs text-text-tertiary mb-1">
                                      Your pool share: <span className="font-mono tabular-nums text-text-primary">{alloc.your_ratio_pct.toFixed(2)}%</span>
                                    </p>
                                    {[...alloc.open_trades, ...alloc.closed_trades].length === 0 ? (
                                      <p className="text-xs text-text-tertiary text-center py-3">Master has no trades yet</p>
                                    ) : (
                                      <>
                                        {alloc.open_trades.map((t: any) => (
                                          <TradeRow key={t.id} t={t} />
                                        ))}
                                        {alloc.closed_trades.map((t: any) => (
                                          <TradeRow key={t.id} t={t} />
                                        ))}
                                      </>
                                    )}
                                  </div>
                                );
                              })()
                            ) : (
                              <p className="text-xs text-text-tertiary text-center py-3">No data</p>
                            )}
                          </div>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ── Become Manager ── */}
        {activeTab === 'apply' && (
          <>
            {!providerChecked ? (
              <div className="max-w-lg mx-auto" aria-busy><Skeleton className="h-96 w-full rounded-lg" /></div>
            ) : myProvider ? (
              myProvider.status === 'pending' ? (
                <EmptyState
                  icon={<Clock />}
                  title="Application Under Review"
                  description="Your PAMM manager application has been submitted. Our team will review it shortly."
                />
              ) : myProvider.status === 'approved' && ['pamm', 'mamm'].includes(myProvider.master_type) ? (
                <EmptyState
                  icon={<CheckCircle />}
                  title="You're an Approved Manager"
                  description="View your investor stats and performance data"
                  action={
                    <Button type="button" variant="primary" onClick={() => setActiveTab('dashboard')}>
                      View Dashboard
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={<Info />}
                  title={`Application ${myProvider.status}`}
                  description="Contact support if you have questions"
                />
              )
            ) : (
              <Card className="max-w-lg mx-auto">
                <CardHeader title="Apply as PAMM Manager" description="Submit your application for admin review" />

                <div className="space-y-4">
                  <Card nested padding="sm" className="text-xs text-text-secondary">
                    A new dedicated <span className="font-semibold text-text-primary">{applyType.toUpperCase()}</span> trading account will be created automatically with $0 balance when you submit.
                  </Card>

                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">Manager Type</span>
                    <div className="h-9 flex items-center justify-center rounded-md border border-accent/40 bg-accent/10 text-accent text-sm font-semibold">
                      PAMM
                    </div>
                    <span className="text-xs text-text-tertiary">Pooled fund — proportional profit distribution per cycle</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Performance Fee"
                      type="number" min="0" max="50" step="0.5"
                      numeric
                      suffix="%"
                      value={applyFee}
                      onChange={(e) => setApplyFee(e.target.value)}
                    />
                    <Input
                      label="Management Fee"
                      type="number" min="0" max="10" step="0.1"
                      numeric
                      suffix="%"
                      value={applyMgmtFee}
                      onChange={(e) => setApplyMgmtFee(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Min Investment"
                      type="number" min="1"
                      numeric
                      suffix="$"
                      value={applyMinInv}
                      onChange={(e) => setApplyMinInv(e.target.value)}
                    />
                    <Input
                      label="Max Investors"
                      type="number" min="1" max="1000"
                      numeric
                      value={applyMaxInv}
                      onChange={(e) => setApplyMaxInv(e.target.value)}
                    />
                  </div>

                  <Textarea
                    label="Description (optional)"
                    rows={3}
                    value={applyDesc}
                    onChange={(e) => setApplyDesc(e.target.value)}
                    placeholder="Describe your trading strategy..."
                    className="resize-none"
                  />

                  <Button
                    type="button"
                    variant="primary"
                    fullWidth
                    loading={applying}
                    disabled={liveAccounts.length === 0}
                    onClick={submitApply}
                  >
                    {applying ? 'Submitting…' : 'Submit Application'}
                  </Button>
                </div>
              </Card>
            )}
          </>
        )}

        {/* ── My Dashboard ── */}
        {activeTab === 'dashboard' && (
          <>
            {dashLoading && <LoadingGrid cards={4} className="lg:grid-cols-4 [&>div]:h-24" />}
            {!dashLoading && !performance && (
              <EmptyState
                icon={<BarChart2 />}
                title="No manager dashboard available"
                description="Apply as a PAMM manager to access this tab"
                action={
                  <Button type="button" variant="primary" onClick={() => setActiveTab('apply')}>
                    Apply Now
                  </Button>
                }
              />
            )}
            {!dashLoading && performance && (
              <div className="space-y-4 md:space-y-5">
                {/* Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <StatCard label="Total AUM" value={`$${fmt(performance.total_aum)}`} />
                  <StatCard label="Investors" value={`${performance.total_investors} / ${performance.max_investors}`} />
                  <StatCard label="Fee Earnings" value={<span className="text-accent">${fmt(performance.fee_earnings)}</span>} />
                  <StatCard
                    label="Total ROI"
                    value={
                      <span className={pnlClass(performance.total_return_pct)}>
                        {performance.total_return_pct >= 0 ? '+' : ''}{performance.total_return_pct.toFixed(2)}%
                      </span>
                    }
                  />
                </div>

                {/* Investor list */}
                <Card padding="none">
                  <CardHeader title={`Investors (${investors.length})`} className="px-4 pt-4 md:px-5 md:pt-5 mb-3" />
                  {investors.length === 0 ? (
                    <EmptyState compact icon={<Users />} title="No investors yet" />
                  ) : (
                    <>
                      {/* Desktop table */}
                      <div className="hidden sm:block">
                        <Table dense>
                          <THead>
                            <TR>
                              <TH>Investor</TH>
                              <TH align="right">Invested</TH>
                              <TH align="right">P&L</TH>
                              <TH align="right">Share %</TH>
                              <TH>Type</TH>
                              <TH>Joined</TH>
                            </TR>
                          </THead>
                          <TBody>
                            {investors.map((inv) => (
                              <TR key={inv.id} interactive>
                                <TD>
                                  <p className="font-medium">{inv.user_name}</p>
                                  <p className="text-text-tertiary text-xxs">{inv.account_number}</p>
                                </TD>
                                <TD numeric>${fmt(inv.allocated)}</TD>
                                <TD numeric>
                                  <PnlText value={inv.pnl} />
                                  <p className="text-xxs"><PnlText value={inv.pnl_pct} suffix="%" /></p>
                                </TD>
                                <TD numeric>{inv.share_pct.toFixed(1)}%</TD>
                                <TD><TypeBadge type={inv.copy_type} /></TD>
                                <TD muted>{new Date(inv.joined_at).toLocaleDateString()}</TD>
                              </TR>
                            ))}
                          </TBody>
                        </Table>
                      </div>
                      {/* Mobile cards */}
                      <div className="sm:hidden divide-y divide-border-secondary">
                        {investors.map((inv) => (
                          <div key={inv.id} className="px-4 py-3 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm text-text-primary font-medium truncate">{inv.user_name}</p>
                              <p className="text-xxs text-text-tertiary">{inv.account_number} · {new Date(inv.joined_at).toLocaleDateString()}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-semibold font-mono tabular-nums text-text-primary">${fmt(inv.allocated)}</p>
                              <p className="text-xs"><PnlText value={inv.pnl} /></p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </Card>

                {/* Monthly breakdown */}
                {performance.monthly_breakdown.length > 0 && (
                  <Card padding="none">
                    <CardHeader title="Monthly Performance" className="px-4 pt-4 md:px-5 md:pt-5 mb-3" />
                    <Table dense>
                      <THead>
                        <TR>
                          <TH>Month</TH>
                          <TH align="right">Profit</TH>
                          <TH align="right">Cumulative</TH>
                        </TR>
                      </THead>
                      <TBody>
                        {performance.monthly_breakdown.map((row) => (
                          <TR key={row.month} interactive>
                            <TD>{row.month}</TD>
                            <TD numeric><PnlText value={row.profit} /></TD>
                            <TD numeric muted>${fmt(row.cumulative)}</TD>
                          </TR>
                        ))}
                      </TBody>
                    </Table>
                  </Card>
                )}
              </div>
            )}
          </>
        )}

      </div>

      {/* Invest Modal */}
      <Modal
        open={!!investTarget}
        onClose={() => { if (!investing) setInvestTarget(null); }}
        title={investTarget ? `Invest with ${investTarget.manager_name}` : ''}
        width="sm"
      >
        {investTarget && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <TypeBadge type={investTarget.master_type} />
              <span className="text-xs text-text-tertiary">Min: ${investTarget.min_investment.toLocaleString()}</span>
            </div>

            <WalletStrip label="From Main Wallet" balance={walletBalance} onMax={() => setInvestAmount(String(Math.max(0, walletBalance)))} />

            <Card nested padding="sm" className="text-xs text-text-tertiary">
              A dedicated investment account will be auto-created for you. Your copied trades will appear there.
            </Card>

            <Input
              label="Investment Amount"
              type="number"
              numeric
              suffix="$"
              min={investTarget.min_investment}
              max={walletBalance}
              step="0.01"
              value={investAmount}
              onChange={(e) => setInvestAmount(e.target.value)}
            />

            {investTarget.master_type === 'mamm' && (
              <Input
                label="Volume Scaling"
                type="number" min="1" max="500" step="1"
                numeric
                suffix="%"
                value={investScaling}
                onChange={(e) => setInvestScaling(e.target.value)}
                hint="100 = proportional share · 200 = 2× leverage"
              />
            )}

            <Card nested padding="sm" className="text-xs text-text-tertiary">
              Performance fee: <span className="text-text-primary">{investTarget.performance_fee_pct}%</span> · Slots left: <span className="text-text-primary">{investTarget.slots_available}</span>
            </Card>

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setInvestTarget(null)} disabled={investing}>
                Cancel
              </Button>
              <Button type="button" variant="primary" className="flex-1" onClick={submitInvest} loading={investing}>
                {investing ? 'Investing…' : 'Confirm Invest'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Withdraw Modal */}
      <Modal
        open={!!withdrawTarget}
        onClose={() => { if (!withdrawing) setWithdrawTarget(null); }}
        title="Withdraw Investment"
        width="sm"
      >
        {withdrawTarget && (
          <div className="space-y-4">
            <Card nested padding="sm" className="space-y-2">
              <KV label="Manager"><span className="font-sans font-medium">{withdrawTarget.manager_name}</span></KV>
              <KV label="Invested">${fmt(withdrawTarget.allocation_amount)}</KV>
              <KV label="Total P&L"><PnlText value={withdrawTarget.total_pnl} /></KV>
            </Card>

            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-warning/25 bg-warning/10 text-xs text-warning">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              <span>All open positions tied to this investment will be closed automatically.</span>
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setWithdrawTarget(null)} disabled={withdrawing}>
                Cancel
              </Button>
              <Button type="button" variant="danger" className="flex-1" onClick={submitWithdraw} loading={withdrawing}>
                {withdrawing ? 'Withdrawing…' : 'Confirm Withdraw'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Refill Modal */}
      <Modal
        open={!!refillTarget}
        onClose={() => { if (!refilling) setRefillTarget(null); }}
        title="Refill Investment"
        width="sm"
      >
        {refillTarget && (
          <div className="space-y-4">
            <Card nested padding="sm" className="space-y-2">
              <KV label="Manager"><span className="font-sans font-medium">{refillTarget.manager_name}</span></KV>
              <KV label="Current Investment"><span className="font-semibold">${fmt(refillTarget.allocation_amount)}</span></KV>
            </Card>

            <WalletStrip label="Wallet Balance" balance={walletBalance} onMax={() => setRefillAmount(String(walletBalance))} />

            <Input
              label="Add Amount"
              type="number" min="1" step="0.01"
              numeric
              suffix="$"
              value={refillAmount}
              onChange={(e) => setRefillAmount(e.target.value)}
              placeholder="Enter amount"
            />

            <div className="flex gap-2 pt-1">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => setRefillTarget(null)} disabled={refilling}>
                Cancel
              </Button>
              <Button type="button" variant="primary" className="flex-1" onClick={submitRefill} loading={refilling} disabled={!refillAmount}>
                {refilling ? 'Adding…' : 'Add Funds'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

    </DashboardShell>
  );
}
