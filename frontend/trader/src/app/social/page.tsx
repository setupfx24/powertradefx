'use client';

import { useState, useEffect, useCallback, useMemo, Suspense, Fragment, ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import DashboardShell from '@/components/layout/DashboardShell';
import DemoLockGate from '@/components/demo/DemoLockGate';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api/client';
import { getErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import MasterEligibilityBanner from '@/components/social/MasterEligibilityBanner';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Segmented,
  Select,
  SideBadge,
  Skeleton,
  StatCard,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  Tabs,
  Textarea,
} from '@/components/ui';
import type { BadgeVariant } from '@/components/ui';
import {
  DollarSign,
  TrendingUp,
  ArrowDownToLine,
  Users,
  Clock,
  GraduationCap,
  ShieldCheck,
  BarChart2,
  Search,
  ArrowRight,
  Inbox,
  ChevronDown,
} from 'lucide-react';

type TabId = 'leaderboard' | 'my-copies' | 'become-provider' | 'my-dashboard' | 'trade-history';
type SortBy = 'total_return_pct' | 'sharpe_ratio' | 'followers_count';

interface Provider {
  id: string;
  user_id: string;
  provider_name: string;
  total_return_pct: number;
  max_drawdown_pct: number;
  sharpe_ratio: number;
  followers_count: number;
  performance_fee_pct: number;
  min_investment: number;
  description: string;
  strategy_info: Record<string, string> | null;
  created_at: string;
  is_copying: boolean;
}

interface ProviderDetail extends Provider {
  active_investors: number;
  total_trades: number;
  total_profit: number;
  win_rate: number;
  monthly_breakdown: { month: string; profit: number }[];
  is_copying: boolean;
}

interface CopySubscription {
  id: string;
  master_id: string;
  provider_name: string;
  allocation_amount: number;
  total_profit: number;
  total_return_pct: number;
  copy_type: string;
  status: string;
  open_trades?: number;
  closed_trades?: number;
  total_trades?: number;
  created_at: string;
}

interface CopyTradeRow {
  id: string;
  symbol: string;
  side: string;
  lots: number;
  open_price: number;
  close_price?: number;
  opened_at?: string | null;
  closed_at?: string | null;
  pnl?: number;
  your_share?: number;
  master_pnl?: number;
  close_reason?: string;
  status: string;
}

interface CopyTradesResponse {
  allocation_id: string;
  copy_type: string;
  open_trades: CopyTradeRow[];
  closed_trades: CopyTradeRow[];
  open_count: number;
  closed_count: number;
  your_ratio_pct?: number;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'my-copies', label: 'My Subscriptions' },
  { id: 'become-provider', label: 'Become Trade Master' },
  { id: 'my-dashboard', label: 'My Dashboard' },
  { id: 'trade-history', label: 'Trade History' },
];

const VALID_TAB_IDS = new Set<TabId>(TABS.map((t) => t.id));

function tabFromQuery(param: string | null): TabId {
  if (param && VALID_TAB_IDS.has(param as TabId)) return param as TabId;
  return 'leaderboard';
}

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: 'total_return_pct', label: 'Return' },
];

/* ─── Formatting helpers ─── */
const fmt2 = (n: number) =>
  (n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sign = (n: number) => (n >= 0 ? '+' : '');
/** P/L colour by sign: green success, red danger. */
const pnlTone = (n: number) => (n >= 0 ? 'text-success' : 'text-danger');

/* ─── Small shared building blocks ─── */

/** Loading placeholder for a block of rows. */
function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3 py-4" aria-busy>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className={cn('h-10', i === rows - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

/** Loading placeholder for the master card grid. */
function CardGridLoading() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy>
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-3 w-full" />
        </Card>
      ))}
    </div>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-danger/25 bg-danger/10 px-4 py-3 text-sm text-danger"
    >
      <span>{message}</span>
      <Button size="xs" variant="danger" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

/** Label + numeral, for stat rows inside cards. */
function Stat({
  label,
  value,
  tone = 'text-text-primary',
  hint,
  size = 'md',
}: {
  label: ReactNode;
  value: ReactNode;
  tone?: string;
  hint?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <div className="min-w-0">
      <p className="text-xxs font-semibold uppercase tracking-[0.1em] text-text-tertiary">{label}</p>
      <p
        className={cn(
          'mt-0.5 truncate font-mono font-semibold tabular-nums',
          size === 'lg' ? 'text-lg' : size === 'sm' ? 'text-xs' : 'text-sm',
          tone,
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xxs text-text-tertiary">{hint}</p>}
    </div>
  );
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <div
      className={cn(
        'grid shrink-0 place-items-center rounded-full border border-border-primary bg-bg-tertiary font-bold text-text-primary',
        size === 'lg' ? 'h-12 w-12 text-md' : 'h-10 w-10 text-sm sm:h-12 sm:w-12',
      )}
      aria-hidden
    >
      {initials}
    </div>
  );
}

function Pager({
  page,
  pages,
  onPrev,
  onNext,
  disabled,
  meta,
}: {
  page: number;
  pages: number;
  onPrev: () => void;
  onNext: () => void;
  disabled?: boolean;
  meta?: ReactNode;
}) {
  return (
    <div className={cn('mt-4 flex items-center gap-2', meta ? 'justify-between' : 'justify-center')}>
      {meta && <p className="text-xxs text-text-tertiary">{meta}</p>}
      <div className="flex items-center gap-2">
        <Button size="xs" variant="outline" disabled={disabled || page <= 1} onClick={onPrev}>
          Prev
        </Button>
        <span className="font-mono text-xs tabular-nums text-text-tertiary">
          {page} / {pages}
        </span>
        <Button size="xs" variant="outline" disabled={disabled || page >= pages} onClick={onNext}>
          Next
        </Button>
      </div>
    </div>
  );
}

/** Radio card: a visually-hidden native radio wrapped in a selectable card. */
function ChoiceCard({
  name,
  value,
  checked,
  disabled,
  onChange,
  title,
  description,
}: {
  name: string;
  value: string;
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
  title: string;
  description: string;
}) {
  return (
    <label
      className={cn(
        'block cursor-pointer rounded-md border p-3 text-xxs transition-colors',
        checked ? 'border-accent bg-accent/10' : 'border-border-primary bg-bg-tertiary hover:border-border-strong',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="sr-only"
      />
      <p className="font-semibold text-text-primary">{title}</p>
      <p className="mt-0.5 leading-snug text-text-tertiary">{description}</p>
    </label>
  );
}

function WalletBalanceRow({ label, balance, onMax }: { label: string; balance: number; onMax: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between rounded-md border border-border-primary bg-bg-tertiary p-3">
      <Stat label={label} value={`$${fmt2(balance)}`} tone="text-accent" size="lg" />
      <Button variant="link" size="xs" onClick={onMax}>
        Max
      </Button>
    </div>
  );
}

const riskVariant = (r: string): BadgeVariant => {
  const v = (r || '').toLowerCase();
  if (v === 'low' || v === 'conservative') return 'success';
  if (v === 'moderate') return 'warning';
  return 'danger';
};

const statusVariant = (status: string): BadgeVariant =>
  status === 'approved' || status === 'active' || status === 'open'
    ? 'success'
    : status === 'pending'
      ? 'warning'
      : status === 'rejected'
        ? 'danger'
        : 'neutral';

/* ─── Mini bar chart for monthly breakdown ─── */
function MonthlyChart({ data }: { data: { month: string; profit: number }[] }) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => Math.abs(d.profit)), 1);
  return (
    <div className="mt-4">
      <p className="mb-2 text-xxs font-semibold uppercase tracking-[0.1em] text-text-tertiary">Monthly Breakdown</p>
      <div className="flex h-24 items-end gap-1">
        {data.map((d) => {
          const pct = (Math.abs(d.profit) / max) * 100;
          return (
            <div key={d.month} className="flex flex-1 flex-col items-center gap-1">
              <div
                className={cn('w-full rounded-t-sm', d.profit >= 0 ? 'bg-success' : 'bg-danger')}
                style={{ height: `${Math.max(pct, 4)}%` }}
                title={`${d.month}: ${sign(d.profit)}${d.profit.toFixed(2)}`}
              />
              <span className="w-full truncate text-center text-xxs text-text-tertiary">{d.month.slice(-3)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Strategy info ─── */
function StrategyInfoCard({ info }: { info: Record<string, string> }) {
  if (!info || Object.keys(info).length === 0) return null;
  const fields = [
    { key: 'strategy_name', label: 'Strategy Name' },
    { key: 'market', label: 'Market' },
    { key: 'risk_profile', label: 'Risk Profile' },
    { key: 'max_drawdown', label: 'Max Drawdown' },
    { key: 'recommended_capital', label: 'Recommended Capital' },
    { key: 'avg_trades', label: 'Avg Trades / Month' },
    { key: 'expected_returns', label: 'Expected Returns' },
  ];
  return (
    <Card nested padding="sm" className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-accent/15 text-accent">
          <BarChart2 size={14} aria-hidden />
        </span>
        <span className="text-xs font-semibold text-text-primary">{info.strategy_name || 'Strategy Details'}</span>
      </div>
      {info.description && <p className="text-xxs leading-relaxed text-text-secondary">{info.description}</p>}
      <div className="grid grid-cols-2 gap-2">
        {fields
          .filter((f) => f.key !== 'strategy_name' && info[f.key])
          .map((f) => (
            <div key={f.key} className="rounded-md border border-border-primary bg-card p-2">
              <p className="mb-0.5 text-xxs text-text-tertiary">{f.label}</p>
              {f.key === 'risk_profile' ? (
                <Badge variant={riskVariant(String(info[f.key] ?? ''))} size="sm">
                  {info[f.key]}
                </Badge>
              ) : (
                <p className="text-xs font-medium text-text-primary">{info[f.key]}</p>
              )}
            </div>
          ))}
      </div>
    </Card>
  );
}

/* ─── Master card ─── */
function MasterCard({
  provider,
  onClick,
  onCopy,
  isSelf,
  onViewFollowers,
}: {
  provider: Provider;
  onClick: () => void;
  onCopy: (e: React.MouseEvent) => void;
  isSelf?: boolean;
  onViewFollowers?: (e: React.MouseEvent) => void;
}) {
  const ret = provider.total_return_pct;
  const info = provider.strategy_info;

  return (
    <Card interactive onClick={onClick} className="flex min-h-[200px] flex-col">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={provider.provider_name} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-semibold text-text-primary">{provider.provider_name}</span>
              <Badge variant="accent" size="sm">Master</Badge>
              {isSelf && <Badge variant="success" size="sm">You</Badge>}
            </div>
            <p className="mt-0.5 text-xxs text-text-tertiary">
              Fee: {provider.performance_fee_pct}% · {provider.followers_count} followers
            </p>
          </div>
        </div>
        {isSelf ? (
          <div className="flex shrink-0 items-center gap-1.5">
            <Button size="xs" variant="outline" onClick={onViewFollowers}>
              {provider.followers_count} Followers
            </Button>
            {provider.is_copying && (
              <a
                href="/social?tab=my-copies"
                className="inline-flex h-7 items-center rounded-md border border-danger/25 bg-danger/10 px-2.5 text-xs font-semibold text-danger transition-colors hover:bg-danger/20"
                title="You're mirroring your own master — click to stop"
              >
                Stop Self-Follow
              </a>
            )}
          </div>
        ) : provider.is_copying ? (
          <Badge variant="success" tone="outline" className="shrink-0">
            Following
          </Badge>
        ) : (
          <Button size="xs" variant="primary" onClick={onCopy} className="shrink-0">
            Follow
          </Button>
        )}
      </div>

      <div className="mb-4">
        <p className="text-xxs font-semibold uppercase tracking-[0.1em] text-text-tertiary">Total ROI</p>
        <p className={cn('font-mono text-xl font-semibold tabular-nums sm:text-2xl', pnlTone(ret))}>
          {sign(ret)}{ret.toFixed(2)}%
        </p>
      </div>

      {info?.strategy_name && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {info.market && <Badge variant="accent" tone="outline" size="sm">{info.market}</Badge>}
          {info.risk_profile && (
            <Badge variant={riskVariant(info.risk_profile)} size="sm">{info.risk_profile}</Badge>
          )}
          {info.expected_returns && <Badge variant="success" tone="outline" size="sm">{info.expected_returns}</Badge>}
        </div>
      )}

      <div className="mt-auto grid grid-cols-3 gap-2 border-t border-border-secondary pt-3">
        <Stat label="Drawdown" value={`${provider.max_drawdown_pct.toFixed(2)}%`} tone="text-danger" size="sm" />
        <Stat label="Sharpe" value={provider.sharpe_ratio.toFixed(2)} size="sm" />
        <Stat label="Followers" value={provider.followers_count.toLocaleString()} size="sm" />
      </div>
    </Card>
  );
}

/* ─── Followers table + modal (shared by Leaderboard and My Dashboard) ─── */
function FollowersTable({ followers, detailed }: { followers: any[]; detailed?: boolean }) {
  if (followers.length === 0) {
    return <EmptyState compact icon={<Users />} title="No followers yet" />;
  }
  return (
    <Table dense>
      <THead>
        <TR>
          <TH>Follower</TH>
          {detailed && <TH>User ID</TH>}
          {detailed && <TH>Account</TH>}
          <TH align="right">Investment</TH>
          <TH align="right">Profit/Loss</TH>
          {detailed && <TH align="right">ROI %</TH>}
          <TH align="right">{detailed ? 'Copied Trades' : 'Trades'}</TH>
          <TH>Joined</TH>
        </TR>
      </THead>
      <TBody>
        {followers.map((f: any) => {
          const profit = Number(f.total_profit || 0);
          const roi = Number(f.profit_pct || 0);
          return (
            <TR key={f.id}>
              <TD>
                <p className="font-medium">{f.user_name}</p>
                {detailed
                  ? f.user_email && <p className="text-xxs text-text-tertiary">{f.user_email}</p>
                  : f.account_number && <p className="text-xxs text-text-tertiary">{f.account_number}</p>}
              </TD>
              {detailed && <TD muted className="font-mono text-xxs">{f.user_id}</TD>}
              {detailed && <TD muted className="font-mono">{f.account_number}</TD>}
              <TD numeric>${Number(f.allocation_amount || 0).toLocaleString()}</TD>
              <TD numeric className={cn('font-semibold', pnlTone(profit))}>
                {sign(profit)}${profit.toLocaleString()}
              </TD>
              {detailed && (
                <TD numeric className={cn('font-semibold', pnlTone(roi))}>
                  {sign(roi)}{f.profit_pct}%
                </TD>
              )}
              <TD numeric>{f.total_copied_trades || 0}</TD>
              <TD muted className="text-xxs">{f.joined_at ? new Date(f.joined_at).toLocaleDateString() : '—'}</TD>
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}

function FollowersModal({
  open,
  onClose,
  title,
  followers,
  loading,
  detailed,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  followers: any[];
  loading: boolean;
  detailed?: boolean;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title} width={detailed ? '4xl' : '3xl'}>
      {loading ? <Loading /> : <FollowersTable followers={followers} detailed={detailed} />}
    </Modal>
  );
}

/* ─── Detail Modal ─── */
function DetailModal({
  detail,
  loading,
  onClose,
  onCopy,
}: {
  detail: ProviderDetail | null;
  loading: boolean;
  onClose: () => void;
  onCopy: () => void;
}) {
  const stats = detail
    ? [
        { label: 'Total ROI', value: `${sign(detail.total_return_pct)}${detail.total_return_pct.toFixed(2)}%`, tone: pnlTone(detail.total_return_pct) },
        { label: 'Max DD', value: `${detail.max_drawdown_pct.toFixed(2)}%`, tone: 'text-danger' },
        { label: 'Sharpe', value: detail.sharpe_ratio.toFixed(2) },
        { label: 'Win Rate', value: `${detail.win_rate.toFixed(1)}%` },
        { label: 'Total Trades', value: detail.total_trades.toLocaleString() },
        { label: 'Total Profit', value: `$${detail.total_profit.toLocaleString()}`, tone: pnlTone(detail.total_profit) },
        { label: 'Followers', value: detail.followers_count.toLocaleString() },
        { label: 'Investors', value: detail.active_investors.toLocaleString() },
        { label: 'Fee', value: `${detail.performance_fee_pct}%` },
      ]
    : [];

  return (
    <Modal open onClose={onClose} title="Master profile" width="lg">
      {loading ? (
        <Loading />
      ) : detail ? (
        <>
          <div className="mb-4 flex items-center gap-3">
            <Avatar name={detail.provider_name} size="lg" />
            <div>
              <p className="text-sm font-semibold text-text-primary">{detail.provider_name}</p>
              <p className="text-xxs text-text-tertiary">Since {new Date(detail.created_at).toLocaleDateString()}</p>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-3 gap-3">
            {stats.map((s) => (
              <div key={s.label} className="rounded-md bg-bg-tertiary p-2">
                <Stat label={s.label} value={s.value} tone={s.tone} />
              </div>
            ))}
          </div>

          {detail.description && <p className="mb-4 text-xs text-text-secondary">{detail.description}</p>}

          {detail.strategy_info && Object.keys(detail.strategy_info).length > 0 && (
            <div className="mb-4">
              <StrategyInfoCard info={detail.strategy_info} />
            </div>
          )}

          <MonthlyChart data={detail.monthly_breakdown} />

          <Button variant="primary" fullWidth className="mt-5" onClick={onCopy} disabled={detail.is_copying}>
            {detail.is_copying ? 'Already Following' : 'Follow Manager'}
          </Button>
        </>
      ) : null}
    </Modal>
  );
}

/* ─── Copy Modal ─── */
interface TradingAccount {
  id: string;
  account_number: string;
  balance: number;
  is_demo?: boolean;
}

function CopyModal({
  provider,
  onClose,
  onSuccess,
}: {
  provider: Provider | ProviderDetail;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);
  // Destination mode: a new dedicated CF account funded from main wallet,
  // or an existing live account the follower already trades from.
  const [destMode, setDestMode] = useState<'new' | 'existing'>('new');
  const [selectedAccountId, setSelectedAccountId] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [accRes, walRes] = await Promise.all([
          api.get<{ items: TradingAccount[] } | TradingAccount[]>('/accounts'),
          api.get<{ main_wallet_balance?: number }>('/wallet/summary'),
        ]);
        if (cancelled) return;
        const items: TradingAccount[] = Array.isArray(accRes)
          ? accRes
          : (accRes?.items ?? []);
        setAccounts(items.filter((a) => !a.is_demo));
        setWalletBalance(Number(walRes.main_wallet_balance) || 0);
      } catch {
        // non-critical
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (destMode === 'new' && amt > walletBalance) {
      toast.error('Insufficient wallet balance');
      return;
    }
    if (destMode === 'existing') {
      if (!selectedAccountId) { toast.error('Pick a destination account'); return; }
      if (selectedAccount && amt > selectedAccount.balance) {
        toast.error(`Account balance $${selectedAccount.balance.toFixed(2)} is below allocation`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const qs =
        destMode === 'existing' && selectedAccountId
          ? `?master_id=${provider.id}&account_id=${selectedAccountId}&amount=${amt}`
          : `?master_id=${provider.id}&amount=${amt}`;
      await api.post(`/social/copy${qs}`, {});
      toast.success(
        destMode === 'existing'
          ? `Now following ${provider.provider_name} — trades will mirror into ${selectedAccount?.account_number}`
          : `Now following ${provider.provider_name} — $${amt.toFixed(2)} deducted from wallet`,
      );
      onSuccess();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to start subscription');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Follow ${provider.provider_name}`} width="sm">
      <p className="mb-4 text-xxs text-text-tertiary">
        Performance fee: {provider.performance_fee_pct}% · Min: ${provider.min_investment}
      </p>

      {/* Destination picker — new dedicated CF account vs an existing live account */}
      <Card nested padding="sm" className="mb-3 space-y-3">
        <p className="text-xs font-semibold text-text-primary">Where should mirrored trades go?</p>
        <div className="grid grid-cols-1 gap-2">
          <ChoiceCard
            name="dest-mode"
            value="new"
            checked={destMode === 'new'}
            onChange={() => {
              setDestMode('new');
              setSelectedAccountId('');
            }}
            title="Create new dedicated account"
            description="A fresh CF account is opened and funded from your main wallet."
          />
          <ChoiceCard
            name="dest-mode"
            value="existing"
            checked={destMode === 'existing'}
            disabled={accounts.length === 0}
            onChange={() => setDestMode('existing')}
            title="Use an existing account"
            description={
              accounts.length === 0
                ? 'No live accounts available.'
                : 'Mirrored trades land in an account you already trade from.'
            }
          />
        </div>
        {destMode === 'existing' && accounts.length > 0 && (
          <Select
            label="Destination account"
            size="sm"
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
            className="font-mono"
            hint={
              <span className="text-warning">
                Heads up: mirrored trades will mix with your own trades on this account, and lot sizing scales with the account&apos;s full equity.
              </span>
            }
          >
            <option value="">— Select —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.account_number} · ${fmt2(a.balance)}
              </option>
            ))}
          </Select>
        )}
      </Card>

      {destMode === 'new' && (
        <WalletBalanceRow
          label="From Main Wallet"
          balance={walletBalance}
          onMax={() => setAmount(String(Math.max(0, walletBalance)))}
        />
      )}

      <div className="mb-4">
        <Input
          label={destMode === 'existing' ? 'Allocation Amount (USD)' : 'Investment Amount (USD)'}
          type="number"
          numeric
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min={provider.min_investment}
          max={destMode === 'existing' ? (selectedAccount?.balance ?? undefined) : walletBalance}
          placeholder={`Min $${provider.min_investment}`}
        />
      </div>

      <Button
        variant="primary"
        fullWidth
        onClick={handleSubmit}
        loading={submitting}
        disabled={
          submitting ||
          // In "new account" mode the backend creates a fresh CF account
          // from main wallet, so no existing account is needed. Only the
          // "existing" mode requires accounts.length > 0 + a selected id.
          (destMode === 'existing' && (accounts.length === 0 || !selectedAccountId))
        }
      >
        {submitting ? 'Processing…' : 'Start Following'}
      </Button>
    </Modal>
  );
}

/* ─── Leaderboard Tab ─── */
function LeaderboardTab() {
  const { user } = useAuthStore();
  const currentUserId = user?.id || '';
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('total_return_pct');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ProviderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [copyTarget, setCopyTarget] = useState<Provider | ProviderDetail | null>(null);

  /* Followers modal */
  const [showFollowers, setShowFollowers] = useState(false);
  const [followers, setFollowers] = useState<any[]>([]);
  const [followersLoading, setFollowersLoading] = useState(false);

  const loadFollowers = async (e: React.MouseEvent, providerId: string, isSelf: boolean) => {
    e.stopPropagation();
    setFollowersLoading(true);
    try {
      const endpoint = isSelf ? '/followers/my-followers' : `/followers/provider/${providerId}`;
      const res = await api.get<any>(endpoint);
      setFollowers(res.followers || []);
      setShowFollowers(true);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err, 'Failed to load followers'));
    } finally {
      setFollowersLoading(false);
    }
  };

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<PaginatedResponse<Provider>>('/social/leaderboard', {
        sort_by: sortBy,
        page: String(page),
        per_page: '20',
      });
      setProviders(res.items);
      setTotalPages(res.pages);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }, [sortBy, page]);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    setDetail(null);
    try {
      const d = await api.get<ProviderDetail>(`/social/providers/${id}`);
      setDetail(d);
    } catch {
      toast.error('Failed to load provider details');
      setSelectedId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <>
      {/* Sort bar */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-xs text-text-tertiary">Sort by</span>
        <Segmented
          aria-label="Sort by"
          value={sortBy}
          onChange={(v) => { setSortBy(v); setPage(1); }}
          options={SORT_OPTIONS}
        />
      </div>

      {error && <ErrorBanner message={error} onRetry={fetchLeaderboard} />}
      {loading ? (
        <CardGridLoading />
      ) : providers.length === 0 ? (
        <EmptyState icon={<Inbox />} title="No providers found" />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {providers.map((p) => (
              <MasterCard
                key={p.id}
                provider={p}
                isSelf={p.user_id === currentUserId}
                onClick={() => openDetail(p.id)}
                onCopy={(e) => { e.stopPropagation(); setCopyTarget(p); }}
                onViewFollowers={(e) => loadFollowers(e, p.id, p.user_id === currentUserId)}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <Pager
              page={page}
              pages={totalPages}
              onPrev={() => setPage((p) => p - 1)}
              onNext={() => setPage((p) => p + 1)}
            />
          )}
        </>
      )}

      {selectedId && (
        <DetailModal
          detail={detail}
          loading={detailLoading}
          onClose={() => setSelectedId(null)}
          onCopy={() => { setSelectedId(null); setCopyTarget(detail); }}
        />
      )}

      {copyTarget && (
        <CopyModal
          provider={copyTarget}
          onClose={() => setCopyTarget(null)}
          onSuccess={() => { setCopyTarget(null); fetchLeaderboard(); }}
        />
      )}

      <FollowersModal
        open={showFollowers}
        onClose={() => setShowFollowers(false)}
        title={`Followers (${followers.length})`}
        followers={followers}
        loading={followersLoading}
      />
    </>
  );
}

/* ─── My Copies Tab ─── */
function SubscriptionRow({
  sub,
  stopping,
  onTrades,
  onRefill,
  onStop,
  onWithdraw,
}: {
  sub: CopySubscription;
  stopping: boolean;
  onTrades: () => void;
  onRefill: () => void;
  onStop: () => void;
  onWithdraw: () => void;
}) {
  const managed = sub.copy_type === 'pamm' || sub.copy_type === 'mam';
  return (
    <Card className="flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold text-text-primary">{sub.provider_name}</span>
          <Badge variant={statusVariant(sub.status)} size="sm">{sub.status}</Badge>
          <Badge variant="accent" size="sm">
            {sub.copy_type === 'pamm' ? 'PAMM' : sub.copy_type === 'mam' ? 'MAM' : 'Copy'}
          </Badge>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary">
          <span>
            Allocated:{' '}
            <span className="font-mono font-medium tabular-nums text-text-primary">${sub.allocation_amount.toLocaleString()}</span>
          </span>
          <span>
            PnL:{' '}
            <span className={cn('font-mono font-medium tabular-nums', pnlTone(sub.total_profit))}>
              {sign(sub.total_profit)}${sub.total_profit.toLocaleString()}
            </span>
          </span>
          <span>
            ROI:{' '}
            <span className={cn('font-mono font-medium tabular-nums', pnlTone(sub.total_return_pct))}>
              {sign(sub.total_return_pct)}{sub.total_return_pct.toFixed(2)}%
            </span>
          </span>
          <span>
            Trades: <span className="font-medium text-text-primary">{sub.open_trades ?? 0} open</span> ·{' '}
            <span className="font-medium text-text-primary">{sub.closed_trades ?? 0} closed</span>
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" variant="outline" onClick={onTrades}>
          Trades
        </Button>
        {sub.status === 'active' && (
          <Button size="sm" variant="secondary" onClick={onRefill}>
            + Refill
          </Button>
        )}
        {managed ? (
          <Button size="sm" variant="danger" disabled={stopping} loading={stopping} onClick={onWithdraw}>
            {stopping ? 'Withdrawing…' : 'Withdraw'}
          </Button>
        ) : (
          <Button size="sm" variant="danger" disabled={stopping} loading={stopping} onClick={onStop}>
            {stopping ? 'Stopping…' : 'Stop'}
          </Button>
        )}
      </div>
    </Card>
  );
}

function TradesModal({
  target,
  data,
  loading,
  onClose,
}: {
  target: CopySubscription;
  data: CopyTradesResponse | null;
  loading: boolean;
  onClose: () => void;
}) {
  const pammShare = data?.copy_type === 'pamm';
  const pnlOf = (t: CopyTradeRow) => (pammShare ? (t.your_share ?? 0) : (t.pnl ?? 0));
  const rows = data ? [...data.open_trades, ...data.closed_trades] : [];

  return (
    <Modal open onClose={onClose} title={`Copy Trades — ${target.provider_name}`} width="2xl">
      {data && (
        <p className="mb-3 text-xxs text-text-tertiary">
          {data.open_count} open · {data.closed_count} closed
          {typeof data.your_ratio_pct === 'number' ? ` · your share ${data.your_ratio_pct}%` : ''}
        </p>
      )}
      {loading && <Loading />}
      {!loading && data && (
        rows.length === 0 ? (
          <EmptyState compact icon={<Inbox />} title="No copy trades yet for this subscription" />
        ) : (
          <Table dense>
            <THead>
              <TR>
                <TH>Symbol</TH>
                <TH>Side</TH>
                <TH align="right">Lots</TH>
                <TH align="right">Open</TH>
                <TH align="right">Close</TH>
                <TH align="right">P&amp;L</TH>
                <TH align="right">Status</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((t) => {
                const pnl = pnlOf(t);
                return (
                  <TR key={t.id}>
                    <TD className="font-medium">{t.symbol}</TD>
                    <TD><SideBadge side={t.side} /></TD>
                    <TD numeric muted>{t.lots}</TD>
                    <TD numeric muted>{t.open_price}</TD>
                    <TD numeric muted>{t.close_price ?? '—'}</TD>
                    <TD numeric className={cn('font-medium', pnlTone(pnl))}>{sign(pnl)}{pnl.toFixed(2)}</TD>
                    <TD align="right">
                      <Badge variant={statusVariant(t.status)} size="sm">
                        {t.status === 'closed' && t.close_reason ? t.close_reason : t.status}
                      </Badge>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )
      )}
    </Modal>
  );
}

function RefillModal({
  target,
  amount,
  onAmountChange,
  walletBalance,
  refilling,
  onSubmit,
  onClose,
}: {
  target: CopySubscription;
  amount: string;
  onAmountChange: (v: string) => void;
  walletBalance: number;
  refilling: boolean;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <Modal open onClose={() => { if (!refilling) onClose(); }} title={`Refill — ${target.provider_name}`} width="sm">
      <p className="mb-4 text-xxs text-text-tertiary">Add more funds from your wallet to this investment</p>

      <WalletBalanceRow label="Wallet Balance" balance={walletBalance} onMax={() => onAmountChange(String(walletBalance))} />

      <Card nested padding="sm" className="mb-4 text-xs text-text-secondary">
        Current investment:{' '}
        <span className="font-mono font-semibold tabular-nums text-text-primary">${target.allocation_amount.toLocaleString()}</span>
      </Card>

      <div className="mb-4">
        <Input
          label="Refill Amount ($)"
          type="number"
          numeric
          min="1"
          step="0.01"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value)}
          placeholder="Enter amount"
        />
      </div>

      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" onClick={onClose} disabled={refilling}>
          Cancel
        </Button>
        <Button variant="primary" className="flex-1" onClick={onSubmit} loading={refilling} disabled={refilling || !amount}>
          {refilling ? 'Adding…' : 'Add Funds'}
        </Button>
      </div>
    </Modal>
  );
}

function MyCopiesTab() {
  const [copies, setCopies] = useState<CopySubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const [tradesTarget, setTradesTarget] = useState<CopySubscription | null>(null);
  const [tradesData, setTradesData] = useState<CopyTradesResponse | null>(null);
  const [tradesLoading, setTradesLoading] = useState(false);
  const [refillTarget, setRefillTarget] = useState<CopySubscription | null>(null);
  const [refillAmount, setRefillAmount] = useState('');
  const [refilling, setRefilling] = useState(false);
  const [walletBal, setWalletBal] = useState(0);
  const [earnings, setEarnings] = useState<{ total_profit: number; commission_to_master: number; total_invested: number } | null>(null);

  const fetchCopies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<{ items: CopySubscription[]; total: number }>('/social/my-copies');
      setCopies(res.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load copies');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchWalletBal = useCallback(async () => {
    try {
      const s = await api.get<{ main_wallet_balance?: number }>('/wallet/summary');
      setWalletBal(Number(s.main_wallet_balance) || 0);
    } catch { setWalletBal(0); }
  }, []);

  const fetchEarnings = useCallback(async () => {
    try {
      const e = await api.get<{ total_profit: number; commission_to_master: number; total_invested: number }>('/social/follower-earnings');
      setEarnings(e);
    } catch { setEarnings(null); }
  }, []);

  useEffect(() => { fetchCopies(); fetchWalletBal(); fetchEarnings(); }, [fetchCopies, fetchWalletBal, fetchEarnings]);

  const stopCopy = async (id: string, name: string) => {
    setStoppingId(id);
    try {
      const res = await api.delete<{ returned_to_wallet?: number }>(`/social/copy/${id}`);
      const returned = res?.returned_to_wallet;
      toast.success(returned != null ? `Stopped following ${name} — $${returned.toFixed(2)} returned to wallet` : `Stopped following ${name}`);
      setCopies((prev) => prev.filter((c) => c.id !== id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to stop subscription');
    } finally {
      setStoppingId(null);
    }
  };

  const withdrawManaged = async (id: string, name: string) => {
    if (!confirm(`Withdraw from ${name}? All open positions will be closed at market price.`)) return;
    setStoppingId(id);
    try {
      await api.delete(`/social/mamm-pamm/${id}/withdraw`);
      toast.success(`Withdrawn from ${name}`);
      setCopies((prev) => prev.filter((c) => c.id !== id));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to withdraw');
    } finally {
      setStoppingId(null);
    }
  };

  const openRefill = (c: CopySubscription) => {
    setRefillTarget(c);
    setRefillAmount('');
    fetchWalletBal();
  };

  const openTrades = async (c: CopySubscription) => {
    setTradesTarget(c);
    setTradesData(null);
    setTradesLoading(true);
    try {
      const res = await api.get<CopyTradesResponse>(`/social/copies/${c.id}/trades`);
      setTradesData(res);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Failed to load copy trades'));
      setTradesTarget(null);
    } finally {
      setTradesLoading(false);
    }
  };

  // Live-refresh the open copy trades while the modal is open — the backend
  // recomputes each position's P&L from the current tick, so a 2 s poll keeps
  // the follower's P&L moving with the price (same cadence as positions).
  useEffect(() => {
    if (!tradesTarget) return;
    let cancelled = false;
    const tick = async () => {
      if (cancelled || (typeof document !== 'undefined' && document.hidden)) return;
      try {
        const res = await api.get<CopyTradesResponse>(`/social/copies/${tradesTarget.id}/trades`);
        if (!cancelled) setTradesData(res);
      } catch {
        /* ignore transient blips — next tick retries */
      }
    };
    const id = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [tradesTarget]);

  const submitRefill = async () => {
    if (!refillTarget) return;
    const amt = parseFloat(refillAmount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (amt > walletBal) { toast.error('Insufficient wallet balance'); return; }
    setRefilling(true);
    try {
      // Use the invest endpoint — it now supports top-up for existing allocations
      const isCopy = refillTarget.copy_type === 'signal';
      if (isCopy) {
        // For signal copies, use the copy endpoint with same master
        await api.post(`/social/copy?master_id=${refillTarget.master_id}&account_id=${refillTarget.id}&amount=${amt}`, {});
      } else {
        // For PAMM/MAM, use the invest endpoint (supports top-up)
        const accts = await api.get<{ items: Array<{ id: string }> }>('/accounts');
        const firstLive = (accts.items ?? [])[0];
        if (!firstLive) { toast.error('No trading account found'); setRefilling(false); return; }
        await api.post(`/social/mamm-pamm/${refillTarget.master_id}/invest?account_id=${firstLive.id}&amount=${amt}`, {});
      }
      toast.success(`Added $${amt.toFixed(2)} to ${refillTarget.provider_name}`);
      setRefillTarget(null);
      fetchCopies();
      fetchWalletBal();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Refill failed');
    } finally {
      setRefilling(false);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorBanner message={error} onRetry={fetchCopies} />;
  if (copies.length === 0) return <EmptyState icon={<Users />} title="No active Trade Master subscriptions yet" />;

  return (
    <div className="space-y-4">
      {/* Follower earnings summary — profit kept vs commission paid to masters */}
      {earnings && (
        <Card>
          <CardHeader
            title="Your Copy-Trading Earnings"
            description="What you kept from copying, and the performance-fee commission paid to your masters"
          />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <Stat
              label="Profit from Copy Trading"
              value={`${sign(earnings.total_profit)}$${fmt2(earnings.total_profit)}`}
              tone={pnlTone(earnings.total_profit)}
              size="lg"
              hint="Net, after fees"
            />
            <Stat
              label="Commission Paid to Master"
              value={`$${fmt2(earnings.commission_to_master)}`}
              tone="text-warning"
              size="lg"
              hint="Performance fees"
            />
            <Stat label="Total Invested" value={`$${fmt2(earnings.total_invested)}`} size="lg" hint="Active allocations" />
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {copies.map((c) => (
          <SubscriptionRow
            key={c.id}
            sub={c}
            stopping={stoppingId === c.id}
            onTrades={() => openTrades(c)}
            onRefill={() => openRefill(c)}
            onStop={() => stopCopy(c.id, c.provider_name)}
            onWithdraw={() => withdrawManaged(c.id, c.provider_name)}
          />
        ))}
      </div>

      {tradesTarget && (
        <TradesModal
          target={tradesTarget}
          data={tradesData}
          loading={tradesLoading}
          onClose={() => setTradesTarget(null)}
        />
      )}

      {refillTarget && (
        <RefillModal
          target={refillTarget}
          amount={refillAmount}
          onAmountChange={setRefillAmount}
          walletBalance={walletBal}
          refilling={refilling}
          onSubmit={submitRefill}
          onClose={() => setRefillTarget(null)}
        />
      )}
    </div>
  );
}

/* ─── Become Provider Tab ─── */
function BecomeProviderTab() {
  const [loading, setLoading] = useState(false);
  const [existing, setExisting] = useState<any>(null);
  // Trade Master section — applies as signal_provider (the master_type that
  // drives copy/mirror trading). PAMM applications live on /pamm.
  const masterType = 'signal_provider';
  const [perfFee, setPerfFee] = useState('20');
  const [minInvest, setMinInvest] = useState('100');
  const [maxInvestors, setMaxInvestors] = useState('100');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Master trading account selection — "new" (admin auto-creates a dedicated
  // CT pool account on approval) vs "existing" (reuse one of the user's
  // live accounts).
  const [accountMode, setAccountMode] = useState<'new' | 'existing'>('new');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [accounts, setAccounts] = useState<Array<{ id: string; account_number: string; balance: number; is_demo: boolean }>>([]);

  // Strategy Info fields
  const [strategyName, setStrategyName] = useState('');
  const [market, setMarket] = useState('');
  const [riskProfile, setRiskProfile] = useState('Moderate');
  const [maxDrawdown, setMaxDrawdown] = useState('');
  const [recommendedCapital, setRecommendedCapital] = useState('');
  const [avgTrades, setAvgTrades] = useState('');
  const [expectedReturns, setExpectedReturns] = useState('');
  const [strategyDescription, setStrategyDescription] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        let provRes = null;
        try { provRes = await api.get<any>('/social/my-provider?master_type=signal_provider'); } catch {}
        if (provRes) setExisting(provRes);
        try {
          const accRes = await api.get<any>('/accounts');
          const items: any[] = Array.isArray(accRes) ? accRes : (accRes?.items ?? []);
          // Only live accounts are eligible — demo accounts can't host
          // master strategies (no real fee chain).
          setAccounts(items.filter((a) => !a.is_demo).map((a) => ({
            id: a.id,
            account_number: a.account_number,
            balance: Number(a.balance) || 0,
            is_demo: !!a.is_demo,
          })));
        } catch {}
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const handleSubmit = async () => {
    if (accountMode === 'existing' && !selectedAccountId) {
      toast.error('Pick a trading account or switch to "Create new"');
      return;
    }
    setSubmitting(true);
    try {
      const strategyInfo: Record<string, string> = {};
      if (strategyName) strategyInfo.strategy_name = strategyName;
      if (market) strategyInfo.market = market;
      if (riskProfile) strategyInfo.risk_profile = riskProfile;
      if (maxDrawdown) strategyInfo.max_drawdown = maxDrawdown;
      if (recommendedCapital) strategyInfo.recommended_capital = recommendedCapital;
      if (avgTrades) strategyInfo.avg_trades = avgTrades;
      if (expectedReturns) strategyInfo.expected_returns = expectedReturns;
      if (strategyDescription) strategyInfo.description = strategyDescription;

      const params = new URLSearchParams({
        master_type: masterType,
        performance_fee_pct: perfFee,
        min_investment: minInvest,
        max_investors: maxInvestors,
        ...(description ? { description } : {}),
        ...(accountMode === 'existing' && selectedAccountId ? { account_id: selectedAccountId } : {}),
      });
      const res = await api.post<{ account_number?: string }>(
        `/social/become-provider?${params.toString()}`,
        Object.keys(strategyInfo).length > 0 ? strategyInfo : null,
      );
      toast.success(
        res?.account_number
          ? `Application submitted! Master trading account ${res.account_number} created.`
          : 'Application submitted! Admin will review.',
      );
      let refreshed = null;
      try { refreshed = await api.get<any>('/social/my-provider?master_type=signal_provider'); } catch {}
      if (refreshed) setExisting(refreshed);
    } catch (e: unknown) { toast.error(getErrorMessage(e, 'Failed')); } finally { setSubmitting(false); }
  };

  // Re-apply after a rejection. The backend allows a fresh submission once
  // the prior application is 'rejected' (it only blocks pending/approved/
  // active), so we pre-fill the form from the rejected row and drop back to
  // the application form by clearing `existing`.
  const handleReapply = () => {
    if (existing) {
      if (existing.performance_fee_pct != null) setPerfFee(String(existing.performance_fee_pct));
      if (existing.min_investment != null) setMinInvest(String(existing.min_investment));
      if (existing.max_investors != null) setMaxInvestors(String(existing.max_investors));
      if (existing.description) setDescription(existing.description);
      const si = existing.strategy_info || {};
      if (si.strategy_name) setStrategyName(si.strategy_name);
      if (si.market) setMarket(si.market);
      if (si.risk_profile) setRiskProfile(si.risk_profile);
      if (si.max_drawdown) setMaxDrawdown(si.max_drawdown);
      if (si.recommended_capital) setRecommendedCapital(si.recommended_capital);
      if (si.avg_trades) setAvgTrades(si.avg_trades);
      if (si.expected_returns) setExpectedReturns(si.expected_returns);
      if (si.description) setStrategyDescription(si.description);
    }
    setExisting(null);
  };

  if (loading) return <div className="mx-auto max-w-lg"><Loading /></div>;

  if (existing) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Card>
          <CardHeader
            title="Your Provider Application"
            actions={<Badge variant={statusVariant(existing.status)} className="capitalize">{existing.status}</Badge>}
          />
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Type" value={<span className="font-sans capitalize">{existing.master_type?.replace('_', ' ')}</span>} />
            <Stat label="Performance Fee" value={`${existing.performance_fee_pct}%`} />
            <Stat label="Min Investment" value={`$${existing.min_investment}`} />
            <Stat label="Max Investors" value={existing.max_investors} />
            <Stat label="Followers" value={existing.followers_count || 0} />
            <Stat label="Total Trades" value={existing.total_trades || 0} />
          </div>
          {existing.strategy_info && <div className="mt-4"><StrategyInfoCard info={existing.strategy_info} /></div>}
          {existing.status === 'pending' && (
            <p className="mt-3 text-xs text-warning">Your application is under review by the admin team.</p>
          )}
          {existing.status === 'rejected' && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-danger">Your application was rejected. You can update your details and re-apply.</p>
              <Button variant="primary" fullWidth onClick={handleReapply}>
                Re-apply
              </Button>
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <MasterEligibilityBanner />
      <Card className="space-y-4">
        <CardHeader
          className="mb-0"
          title="Apply to Become a Trade Master"
          description="Choose your provider type, set your fees, and start earning from followers."
        />

        {/* Provider Type */}
        <div className="rounded-md border border-success/25 bg-success/10 p-3">
          <p className="text-xs font-semibold text-success">Trade Master</p>
          <p className="mt-0.5 text-xxs text-text-tertiary">
            Individual accounts — your followers automatically mirror your trades in real time (proportional lot size per investor)
          </p>
        </div>

        <Card nested padding="sm" className="flex items-center justify-between gap-3 text-xxs text-text-tertiary">
          <span>Want to run a pooled PAMM fund instead?</span>
          <a href="/pamm" className="whitespace-nowrap text-accent underline underline-offset-2 hover:text-accent-hover">
            Apply on PAMM page →
          </a>
        </Card>

        {/* Zero-accounts warning. Followers literally can't mirror anything
            if the applicant has no live account, so block the submission
            with a clear call-to-action instead of silently allowing a
            broken application through. */}
        {accounts.length === 0 && (
          <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-xxs text-text-primary">
            <p className="mb-1 font-semibold text-warning">No live trading account yet</p>
            <p className="leading-snug text-text-secondary">
              You need at least one live (non-demo) trading account before applying — it&apos;s the account your followers will mirror.
            </p>
            <a href="/accounts" className="mt-2 inline-block font-semibold text-accent hover:underline">
              Open a live account →
            </a>
          </div>
        )}

        {/* Master trading account picker */}
        <Card nested padding="sm" className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-text-primary">Master Trading Account</p>
            <p className="mt-0.5 text-xxs text-text-secondary">
              Which account will your followers mirror? Pick a fresh dedicated one, or reuse a live account you already trade well.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <ChoiceCard
              name="acct-mode"
              value="new"
              checked={accountMode === 'new'}
              onChange={() => {
                setAccountMode('new');
                setSelectedAccountId('');
              }}
              title="Create new dedicated account"
              description="A fresh CT account is opened on approval. Keeps your personal trading separate."
            />
            <ChoiceCard
              name="acct-mode"
              value="existing"
              checked={accountMode === 'existing'}
              disabled={accounts.length === 0}
              onChange={() => setAccountMode('existing')}
              title="Use an existing account"
              description={
                accounts.length === 0
                  ? 'No live accounts available — open one first.'
                  : 'Make one of your live accounts the master. Followers mirror it from day one.'
              }
            />
          </div>
          {accountMode === 'existing' && accounts.length > 0 && (
            <Select
              label="Pick the account"
              size="sm"
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="font-mono"
              hint={
                <span className="text-warning">
                  Note: every trade you place on this account will be mirrored to followers once approved.
                </span>
              }
            >
              <option value="">— Select —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.account_number} · ${fmt2(a.balance)}
                </option>
              ))}
            </Select>
          )}
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Performance Fee %"
            type="number"
            numeric
            min="0"
            max="50"
            value={perfFee}
            onChange={(e) => setPerfFee(e.target.value)}
          />
          <Input
            label="Min Investment ($)"
            type="number"
            numeric
            min="1"
            value={minInvest}
            onChange={(e) => setMinInvest(e.target.value)}
          />
        </div>
        <Input
          label="Max Investors"
          type="number"
          numeric
          min="1"
          max="1000"
          value={maxInvestors}
          onChange={(e) => setMaxInvestors(e.target.value)}
        />
        <Textarea
          label="Description / Strategy"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Describe your trading strategy..."
          className="resize-none"
        />

        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={handleSubmit}
          loading={submitting}
          disabled={submitting || accounts.length === 0}
        >
          {accounts.length === 0
            ? 'Open a live account first'
            : submitting
              ? 'Submitting...'
              : 'Submit Application'}
        </Button>
      </Card>
    </div>
  );
}

/* ─── My Dashboard Tab ─── */
function MyDashboardTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showFollowers, setShowFollowers] = useState(false);
  const [followers, setFollowers] = useState<any[]>([]);
  const [followersLoading, setFollowersLoading] = useState(false);

  useEffect(() => {
    (async () => {
      let res = null;
      try { res = await api.get<any>('/social/my-provider'); } catch {}
      setData(res);
      setLoading(false);
      if (res && res.status === 'approved') {
        loadFollowers();
      }
    })();
  }, []);

  const loadFollowers = async () => {
    setFollowersLoading(true);
    try {
      const res = await api.get<any>('/followers/my-followers');
      setFollowers(res.followers || []);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Failed to load followers'));
    } finally {
      setFollowersLoading(false);
    }
  };

  if (loading) return <Loading rows={6} />;
  if (!data || data.status !== 'approved') {
    return (
      <EmptyState
        icon={<ShieldCheck />}
        title="Not an approved Trade Master yet"
        description={<>You are not an approved Trade Master. Apply in the &ldquo;Become Trade Master&rdquo; tab.</>}
      />
    );
  }

  const todayProfit = Number(data.today_profit || 0);
  const investorProfit = Number(data.total_investor_profit || 0);
  const winRate = Number(data.win_rate || 0);

  return (
    <div className="space-y-4 md:space-y-5">
      {/* Master badge + name */}
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-full border border-accent/30 bg-accent/15 text-lg font-bold text-accent" aria-hidden>
          M
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-text-primary">Master Dashboard</h2>
            <Badge variant="accent" size="sm">Master</Badge>
          </div>
          <p className="text-xs text-text-tertiary">
            Trade Master · Since {data.created_at ? new Date(data.created_at).toLocaleDateString() : '—'}
          </p>
        </div>
      </div>

      {/* Key Stats Row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div
          role="button"
          tabIndex={0}
          onClick={loadFollowers}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); loadFollowers(); } }}
          className="cursor-pointer rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
          aria-label="Refresh followers"
        >
          <StatCard
            label="Followers"
            value={<span className="text-success">{data.followers_count || 0}</span>}
            hint="Tap to refresh"
            icon={<Users />}
            className="h-full hover:border-border-strong"
          />
        </div>
        <StatCard
          label="Active Investors"
          value={
            <>
              {data.active_investors || 0}{' '}
              <span className="text-xs font-medium text-text-tertiary">/ {data.max_investors}</span>
            </>
          }
        />
        <StatCard label="Total AUM" value={<span className="text-success">${fmt2(data.total_aum || 0)}</span>} icon={<DollarSign />} />
        <StatCard label="Open Positions" value={data.open_positions || 0} icon={<BarChart2 />} />
      </div>

      {/* Earnings / Profit Sharing Section */}
      <Card>
        <CardHeader title="Earnings & Profit Sharing" description="Commission earned from your followers' performance fees" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <Stat label="Commission Earned" value={`$${fmt2(data.commission_earned || 0)}`} tone="text-warning" size="lg" hint="From followers" />
          <Stat
            label="Commission Paid to Admin"
            value={`$${fmt2(data.admin_commission_paid || 0)}`}
            tone="text-danger"
            size="lg"
            hint={`${data.admin_commission_pct || 0}% of your fee`}
          />
          <Stat label="Performance Fee Rate" value={`${data.performance_fee_pct}%`} size="lg" />
          <Stat label="Followers' Total Profit" value={`$${fmt2(investorProfit)}`} tone={pnlTone(investorProfit)} size="lg" />
          <Stat label="Management Fee" value={`${data.management_fee_pct || 0}%`} size="lg" />
        </div>
      </Card>

      {/* Trading Activity */}
      <Card>
        <CardHeader title="Trading Activity" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Today's Trades" value={data.today_trades || 0} size="lg" />
          <Stat label="Today's Profit" value={`${sign(todayProfit)}$${fmt2(todayProfit)}`} tone={pnlTone(todayProfit)} size="lg" />
          <Stat label="Total Trades" value={data.total_trades || 0} size="lg" />
          <Stat label="Win Rate" value={`${data.win_rate?.toFixed(1) || '0.0'}%`} tone={winRate >= 50 ? 'text-success' : 'text-danger'} size="lg" />
        </div>
      </Card>

      {/* Copy Trades Generated — mirrors spawned across all followers */}
      <Card>
        <CardHeader title="Copy Trades" description="Mirrored trades generated across all your followers' accounts" />
        <div className="grid grid-cols-3 gap-4">
          <Stat label="Open" value={data.copy_open_count || 0} tone="text-success" size="lg" />
          <Stat label="Closed" value={data.copy_closed_count || 0} size="lg" />
          <Stat label="Total" value={data.copy_total_count || 0} size="lg" />
        </div>
      </Card>

      {/* Performance Stats */}
      <Card>
        <CardHeader title="Performance Stats" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat
            label="Total Return"
            value={`${sign(data.total_return_pct)}${data.total_return_pct?.toFixed(2)}%`}
            tone={pnlTone(data.total_return_pct)}
          />
          <Stat label="Max Drawdown" value={`${data.max_drawdown_pct?.toFixed(2)}%`} tone="text-danger" />
          <Stat label="Sharpe Ratio" value={data.sharpe_ratio?.toFixed(2)} />
          <Stat label="Total Profit" value={`$${fmt2(data.total_profit || 0)}`} tone={pnlTone(data.total_profit)} />
          <Stat label="Min Investment" value={`$${fmt2(data.min_investment || 0)}`} />
          <Stat label="Status" value={<Badge variant={statusVariant(data.status)} className="capitalize">{data.status}</Badge>} />
        </div>
      </Card>

      {/* My Followers Section */}
      <Card>
        <CardHeader
          title="My Followers"
          description="Users currently following your trades"
          actions={
            <Button size="sm" variant="outline" onClick={loadFollowers} disabled={followersLoading} loading={followersLoading}>
              {followersLoading ? 'Loading...' : 'Refresh'}
            </Button>
          }
        />
        {followersLoading ? <Loading /> : <FollowersTable followers={followers} detailed />}
      </Card>

      {/* Transaction History — commissions + withdrawals + transfers */}
      <MasterTransactionHistory />

      <FollowersModal
        open={showFollowers}
        onClose={() => setShowFollowers(false)}
        title={`My Followers (${followers.length})`}
        followers={followers}
        loading={followersLoading}
        detailed
      />
    </div>
  );
}

/* ─── Trade History Tab — all copy trades across every subscription ─── */
interface CopyHistoryRow {
  id: string;
  allocation_id: string;
  account_key: string;
  account_number: string;
  provider_name: string;
  copy_type: string;
  symbol: string;
  side: string;
  lots: number;
  open_price: number;
  close_price?: number | null;
  opened_at?: string | null;
  closed_at?: string | null;
  pnl: number;
  close_reason?: string | null;
  status: string;
}
interface CopyHistoryAccount {
  account_key: string;
  account_number: string;
  master_name: string;
  copy_type: string;
}
interface CopyHistoryResponse {
  items: CopyHistoryRow[];
  accounts: CopyHistoryAccount[];
  symbols: string[];
  open_count: number;
  closed_count: number;
  total: number;
  total_pnl: number;
}

type HistoryStatus = 'all' | 'open' | 'closed';
const HISTORY_STATUS_OPTIONS: { value: HistoryStatus; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' },
];

function CopyTradeHistoryTab() {
  const [data, setData] = useState<CopyHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountKey, setAccountKey] = useState('all');
  const [symbol, setSymbol] = useState('all');
  const [status, setStatus] = useState<HistoryStatus>('all');

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<CopyHistoryResponse>('/social/copy-trade-history');
      setData(res);
    } catch (e: unknown) {
      setError(getErrorMessage(e, 'Failed to load trade history'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // Client-side filtering keeps the dropdowns snappy; the response already
  // carries the full account + symbol lists so the filters stay populated
  // even when a narrower view is selected.
  const rows = useMemo(() => {
    const all = data?.items ?? [];
    return all.filter((r) =>
      (accountKey === 'all' || r.account_key === accountKey) &&
      (symbol === 'all' || r.symbol === symbol) &&
      (status === 'all' || r.status === status),
    );
  }, [data, accountKey, symbol, status]);

  const filteredPnl = useMemo(
    () => rows.reduce((s, r) => s + (r.pnl || 0), 0),
    [rows],
  );

  if (loading) return <Loading rows={6} />;
  if (error) return <ErrorBanner message={error} onRetry={fetchHistory} />;
  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        icon={<Inbox />}
        title="No copy trades yet"
        description="Once you follow a master and trades mirror in, they'll show up here."
      />
    );
  }

  const filtersActive = accountKey !== 'all' || symbol !== 'all' || status !== 'all';

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total Trades" value={data.total} />
        <StatCard label="Open" value={<span className="text-success">{data.open_count}</span>} />
        <StatCard label="Closed" value={data.closed_count} />
        <StatCard
          label="Net P&L"
          value={<span className={pnlTone(data.total_pnl)}>{sign(data.total_pnl)}${fmt2(data.total_pnl)}</span>}
        />
      </div>

      {/* Filters: account-wise + trade-wise (symbol) + status */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[180px]">
          <Select label="Account" size="sm" value={accountKey} onChange={(e) => setAccountKey(e.target.value)}>
            <option value="all">All accounts</option>
            {data.accounts.map((a) => (
              <option key={a.account_key} value={a.account_key}>
                {a.account_number} · {a.master_name}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-[150px]">
          <Select label="Instrument" size="sm" value={symbol} onChange={(e) => setSymbol(e.target.value)} className="font-mono">
            <option value="all">All instruments</option>
            {data.symbols.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </div>
        <Segmented aria-label="Trade status" size="md" value={status} onChange={setStatus} options={HISTORY_STATUS_OPTIONS} />
        {filtersActive && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => { setAccountKey('all'); setSymbol('all'); setStatus('all'); }}
          >
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <Card padding="none">
        <div className="flex items-center justify-between border-b border-border-primary px-4 py-2.5">
          <p className="text-xs font-semibold text-text-primary">
            {rows.length} trade{rows.length === 1 ? '' : 's'}
          </p>
          <p className={cn('font-mono text-xs font-semibold tabular-nums', pnlTone(filteredPnl))}>
            {sign(filteredPnl)}${fmt2(filteredPnl)}
          </p>
        </div>
        {rows.length === 0 ? (
          <EmptyState compact icon={<Search />} title="No trades match the selected filters" />
        ) : (
          <Table dense>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Master</TH>
                <TH>Account</TH>
                <TH>Symbol</TH>
                <TH>Side</TH>
                <TH align="right">Lots</TH>
                <TH align="right">Open</TH>
                <TH align="right">Close</TH>
                <TH align="right">P&amp;L</TH>
                <TH align="right">Status</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((t) => {
                const ts = t.closed_at || t.opened_at;
                return (
                  <TR key={`${t.status}-${t.id}`} interactive>
                    <TD muted className="text-xxs">{ts ? new Date(ts).toLocaleString() : '—'}</TD>
                    <TD>
                      <div className="flex items-center gap-1.5">
                        <span className="max-w-[120px] truncate">{t.provider_name}</span>
                        <Badge variant="accent" size="sm">{t.copy_type}</Badge>
                      </div>
                    </TD>
                    <TD muted className="font-mono">{t.account_number}</TD>
                    <TD className="font-medium">{t.symbol}</TD>
                    <TD><SideBadge side={t.side} /></TD>
                    <TD numeric muted>{t.lots}</TD>
                    <TD numeric muted>{t.open_price}</TD>
                    <TD numeric muted>{t.close_price ?? '—'}</TD>
                    <TD numeric className={cn('font-medium', pnlTone(t.pnl))}>
                      {sign(t.pnl)}{fmt2(t.pnl)}
                    </TD>
                    <TD align="right">
                      <Badge variant={statusVariant(t.status)} size="sm">
                        {t.status === 'closed' && t.close_reason ? t.close_reason : t.status}
                      </Badge>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

/* ─── Master transaction history ─── */
type MasterTxnFollower = { user_id: string; name: string; email: string };
type MasterTxn = {
  id: string;
  created_at: string | null;
  type: string;
  amount: number;
  balance_after: number | null;
  description: string | null;
  follower: MasterTxnFollower | null;
  symbol: string | null;
  side: 'buy' | 'sell' | null;
  lots: number | null;
  gross_profit: number | null;
  performance_fee_pct: number | null;
  performance_fee_gross: number | null;
  admin_commission_pct: number | null;
  admin_fee: number | null;
  master_net: number | null;
};
type MasterTxnResponse = {
  items: MasterTxn[];
  page: number;
  per_page: number;
  total: number;
  pages: number;
  summary: {
    total_commission: number;
    total_withdrawn: number;
    total_transferred: number;
    total_deposit: number;
  };
};

const TXN_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'commission', label: 'Commission' },
  { id: 'withdrawal', label: 'Withdrawals' },
  { id: 'transfer', label: 'Transfers' },
  { id: 'deposit', label: 'Deposits' },
] as const;
type TxnFilter = (typeof TXN_FILTERS)[number]['id'];
const TXN_FILTER_OPTIONS: { value: TxnFilter; label: string }[] = TXN_FILTERS.map((f) => ({ value: f.id, label: f.label }));

const txnTypeLabel = (t: string): { text: string; variant: BadgeVariant } => {
  switch (t) {
    case 'ib_commission':
      return { text: 'Commission', variant: 'success' };
    case 'withdrawal':
      return { text: 'Withdrawal', variant: 'danger' };
    case 'transfer':
      return { text: 'Transfer', variant: 'accent' };
    case 'deposit':
      return { text: 'Deposit', variant: 'success' };
    case 'bonus':
      return { text: 'Bonus', variant: 'warning' };
    default:
      return { text: t, variant: 'neutral' };
  }
};

function MasterTransactionHistory() {
  const [filter, setFilter] = useState<TxnFilter>('all');
  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [data, setData] = useState<MasterTxnResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const perPage = 15;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    (async () => {
      try {
        const params: Record<string, string> = {
          page: String(page),
          per_page: String(perPage),
          filter_type: filter,
        };
        if (dateFrom) params.date_from = dateFrom;
        if (dateTo) params.date_to = dateTo;
        const res = await api.get<MasterTxnResponse>('/social/master/transactions', params);
        if (alive) setData(res);
      } catch (e) {
        if (alive) toast.error(getErrorMessage(e, 'Failed to load transaction history'));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [filter, page, dateFrom, dateTo]);

  return (
    <Card padding="none">
      <div className="space-y-3 border-b border-border-primary px-4 py-4 md:px-5">
        <CardHeader
          className="mb-0"
          title="Master Account History"
          description="Activity on your master pool account only — commissions earned per follower, plus any withdrawals or transfers of those earnings. General wallet activity lives in Funds → Transaction History."
        />
        <div className="flex flex-wrap items-center gap-2">
          <div className="max-w-full overflow-x-auto scrollbar-none">
            <Segmented
              aria-label="Transaction type"
              size="xs"
              value={filter}
              onChange={(v) => { setFilter(v); setPage(1); }}
              options={TXN_FILTER_OPTIONS}
            />
          </div>
          {/* Date window — inclusive; backend treats date_to as the whole day */}
          <div className="flex items-center gap-1.5">
            <div className="w-36">
              <Input
                type="date"
                size="sm"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                aria-label="From date"
              />
            </div>
            <span className="text-xxs text-text-tertiary" aria-hidden>→</span>
            <div className="w-36">
              <Input
                type="date"
                size="sm"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                aria-label="To date"
              />
            </div>
            {(dateFrom || dateTo) && (
              <Button size="xs" variant="ghost" onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }}>
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-2 gap-4 border-b border-border-primary bg-bg-tertiary/40 px-4 py-3 md:grid-cols-4 md:px-5">
          <Stat label="Total Commission" value={`$${fmt2(data.summary.total_commission)}`} tone="text-success" />
          <Stat label="Total Withdrawn" value={`$${fmt2(data.summary.total_withdrawn)}`} tone="text-danger" />
          <Stat
            label="Net Transferred"
            value={`${sign(data.summary.total_transferred)}$${fmt2(data.summary.total_transferred)}`}
          />
          <Stat label="Total Deposits" value={`$${fmt2(data.summary.total_deposit)}`} tone="text-success" />
        </div>
      )}

      <div className="p-4 md:p-5">
        {loading ? (
          <Loading />
        ) : !data || data.items.length === 0 ? (
          <EmptyState compact icon={<Inbox />} title="No transactions yet" />
        ) : (
          <Table dense>
            <THead>
              <TR>
                <TH>Date</TH>
                <TH>Type</TH>
                <TH>Source / Details</TH>
                <TH align="right">Amount</TH>
                <TH align="right">Balance</TH>
                <TH align="right" className="w-8" aria-label="Details" />
              </TR>
            </THead>
            <TBody>
              {data.items.map((t) => {
                const lbl = txnTypeLabel(t.type);
                const isExpandable = t.type === 'ib_commission';
                const isOpen = expanded === t.id;
                return (
                  <Fragment key={t.id}>
                    <TR
                      interactive={isExpandable}
                      onClick={() => isExpandable && setExpanded(isOpen ? null : t.id)}
                    >
                      <TD muted className="text-xxs">
                        {t.created_at ? new Date(t.created_at).toLocaleString() : '—'}
                      </TD>
                      <TD>
                        <Badge variant={lbl.variant} size="sm">{lbl.text}</Badge>
                      </TD>
                      <TD className="whitespace-normal">
                        {t.type === 'ib_commission' ? (
                          t.follower ? (
                            <div>
                              <p className="font-medium">{t.follower.name}</p>
                              <p className="text-xxs text-text-tertiary">
                                {t.symbol ? `${t.symbol} ${t.side?.toUpperCase() ?? ''} ${t.lots ?? ''} lots` : t.follower.email}
                              </p>
                            </div>
                          ) : (
                            <span className="text-text-tertiary">Copy trade</span>
                          )
                        ) : (
                          <span className="text-text-secondary">{t.description || '—'}</span>
                        )}
                      </TD>
                      <TD numeric className={cn('font-semibold', pnlTone(t.amount))}>
                        {sign(t.amount)}${fmt2(Math.abs(t.amount))}
                      </TD>
                      <TD numeric muted className="text-xxs">
                        {t.balance_after != null ? `$${fmt2(t.balance_after)}` : '—'}
                      </TD>
                      <TD align="right">
                        {isExpandable && (
                          <ChevronDown
                            className={cn('inline-block h-4 w-4 text-text-tertiary transition-transform', isOpen && 'rotate-180')}
                            aria-hidden
                          />
                        )}
                      </TD>
                    </TR>
                    {isExpandable && isOpen && (
                      <TR className="bg-card-nested">
                        <TD colSpan={6} className="whitespace-normal">
                          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                            <Stat
                              label="Follower P/L (Gross)"
                              value={`${sign(t.gross_profit ?? 0)}$${fmt2(t.gross_profit ?? 0)}`}
                              tone={pnlTone(t.gross_profit ?? 0)}
                            />
                            <Stat label={`Perf Fee ${t.performance_fee_pct?.toFixed(0)}%`} value={`$${fmt2(t.performance_fee_gross ?? 0)}`} />
                            <Stat
                              label={`Platform Cut ${t.admin_commission_pct?.toFixed(0)}%`}
                              value={`−$${fmt2(t.admin_fee ?? 0)}`}
                              tone="text-danger"
                            />
                            <Stat label="You Earned" value={`+$${fmt2(t.master_net ?? 0)}`} tone="text-success" />
                            <Stat label="Follower ID" value={t.follower?.user_id ?? '—'} tone="text-text-secondary" size="sm" />
                          </div>
                        </TD>
                      </TR>
                    )}
                  </Fragment>
                );
              })}
            </TBody>
          </Table>
        )}

        {data && data.pages > 1 && (
          <Pager
            page={data.page}
            pages={data.pages}
            disabled={loading}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(data.pages, p + 1))}
            meta={`Page ${data.page} of ${data.pages} · ${data.total} entries`}
          />
        )}
      </div>
    </Card>
  );
}

/* ─── Marketing blocks under the tabs ─── */
const WHY_ITEMS = [
  { icon: Clock, title: 'Save Time', desc: 'No need to analyze the market' },
  { icon: GraduationCap, title: 'Learn & Grow', desc: 'Learn strategies from top traders' },
  { icon: ShieldCheck, title: 'Risk Management', desc: 'Diversified portfolio with top traders' },
  { icon: BarChart2, title: 'Transparent Performance', desc: 'Real-time results and performance tracking' },
];

const HOW_STEPS = [
  { icon: Search, title: 'Choose a Master', desc: 'Select a top trader' },
  { icon: DollarSign, title: 'Set Your Amount', desc: 'Invest any amount' },
  { icon: ArrowDownToLine, title: 'Start Copying', desc: 'We copy trades for you' },
];

function FeatureTile({ icon: Icon, size = 'md' }: { icon: typeof Clock; size?: 'md' | 'lg' }) {
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-lg bg-accent-soft text-accent',
        size === 'lg' ? 'h-12 w-12' : 'h-10 w-10',
      )}
      aria-hidden
    >
      <Icon size={size === 'lg' ? 20 : 18} />
    </span>
  );
}

/* ─── Main Page ─── */
function SocialPageInner() {
  const isDemo = useAuthStore((s) => s.user?.is_demo);
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabId>(() => tabFromQuery(searchParams.get('tab')));

  // Aggregate stats for the top 4 cards (DAG mockup). Refetched on mount.
  // Backend returns my-copies list — we sum invested/profit/this-month locally.
  const [copySummary, setCopySummary] = useState({
    totalInvested: 0,
    totalProfit: 0,
    profitThisMonth: 0,
    activeCopies: 0,
  });
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ items: Array<{
          allocated_amount?: number; current_value?: number; total_pnl?: number;
          joined_at?: string; status?: string;
        }> }>('/social/my-allocations');
        const items = res.items ?? [];
        const active = items.filter((i) => (i.status || 'active') === 'active');
        const totalInvested = active.reduce((s, i) => s + (Number(i.allocated_amount) || 0), 0);
        const totalProfit = active.reduce((s, i) => s + (Number(i.total_pnl) || 0), 0);
        const now = new Date();
        const thisMonthCutoff = new Date(now.getFullYear(), now.getMonth(), 1);
        const profitThisMonth = active
          .filter((i) => i.joined_at && new Date(i.joined_at) >= thisMonthCutoff)
          .reduce((s, i) => s + (Number(i.total_pnl) || 0), 0);
        if (!cancelled) {
          setCopySummary({
            totalInvested,
            totalProfit,
            profitThisMonth,
            activeCopies: active.length,
          });
        }
      } catch {
        // empty state — stay at zero
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setActiveTab(tabFromQuery(searchParams.get('tab')));
  }, [searchParams]);

  if (isDemo) {
    return (
      <DashboardShell>
        <DemoLockGate
          feature="Trade Master"
          description="Trade Master and becoming a provider require a real trading account. Register a live account to follow top traders or share your strategy."
        >
          <></>
        </DemoLockGate>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <PageHeader
        title="Copy Trading"
        description={
          <>
            Follow top traders and earn by copying their trades. For pooled accounts, use{' '}
            <span className="font-medium text-accent">PAMM</span> in the sidebar.
          </>
        }
      />

      <div className="space-y-4 md:space-y-5">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total Invested" value={`$${fmt2(copySummary.totalInvested)}`} icon={<DollarSign />} />
          <StatCard label="Total Profit" value={`$${fmt2(copySummary.totalProfit)}`} icon={<TrendingUp />} />
          <StatCard label="Profit This Month" value={`$${fmt2(copySummary.profitThisMonth)}`} icon={<ArrowDownToLine />} />
          <StatCard
            label="Active Copy Trades"
            value={
              <>
                {copySummary.activeCopies} <span className="text-xs font-medium text-text-tertiary">/ 10</span>
              </>
            }
            icon={<Users />}
          />
        </div>

        {/* Section tabs */}
        <div className="overflow-x-auto scrollbar-none">
          <Tabs
            variant="underline"
            aria-label="Copy trading sections"
            tabs={TABS}
            active={activeTab}
            onChange={(id) => setActiveTab(id as TabId)}
            className="min-w-max sm:min-w-0"
          />
        </div>

        <div key={activeTab} className="min-h-[200px] animate-fade-in">
          {activeTab === 'leaderboard' && <LeaderboardTab />}
          {activeTab === 'my-copies' && <MyCopiesTab />}
          {activeTab === 'become-provider' && <BecomeProviderTab />}
          {activeTab === 'my-dashboard' && <MyDashboardTab />}
          {activeTab === 'trade-history' && <CopyTradeHistoryTab />}
        </div>

        {/* ── Why Copy Top Traders? ── */}
        <Card>
          <CardHeader title="Why Copy Top Traders?" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {WHY_ITEMS.map((b) => (
              <div key={b.title} className="flex items-start gap-3">
                <FeatureTile icon={b.icon} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary">{b.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-text-tertiary">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* ── How Copy Trading Works? (3-step horizontal flow) ── */}
        <Card>
          <CardHeader title="How Copy Trading Works?" />
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-2">
            {HOW_STEPS.map((s, idx, arr) => (
              <div key={s.title} className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <FeatureTile icon={s.icon} size="lg" />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-text-primary">{idx + 1}. {s.title}</p>
                    <p className="mt-0.5 text-xs text-text-tertiary">{s.desc}</p>
                  </div>
                </div>
                {idx < arr.length - 1 && (
                  <ArrowRight size={18} className="hidden shrink-0 text-text-tertiary sm:block" aria-hidden />
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}

export default function SocialPage() {
  return (
    <Suspense fallback={null}>
      <SocialPageInner />
    </Suspense>
  );
}
