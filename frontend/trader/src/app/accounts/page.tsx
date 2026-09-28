'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import {
  Pencil,
  ArrowLeftRight,
  Trash2,
  Settings,
  LayoutGrid,
  List as ListIcon,
  Wallet,
  ArrowDownToLine,
  TrendingUp,
  Users,
} from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import { Badge, Button, Card, EmptyState, Input, PageHeader, Segmented, Select, Skeleton, StatCard } from '@/components/ui';
import api from '@/lib/api/client';
import { useAuthStore } from '@/stores/authStore';
import { useTradingStore, type TradingAccount, type AccountGroupInfo } from '@/stores/tradingStore';
import {
  getPersistedTradingAccountId,
  setPersistedTradingAccountId,
  tradingTerminalUrl,
} from '@/lib/tradingNav';
import { Modal } from '@/components/ui';
import AccountTypePickerModal from '@/components/accounts/AccountTypePickerModal';

const ALIAS_PREFIX = 'ptd-account-alias:';

interface AccountRow {
  id: string;
  account_number: string;
  balance: number;
  credit: number;
  equity: number;
  margin_used: number;
  free_margin: number;
  margin_level: number;
  leverage: number;
  currency: string;
  is_demo: boolean;
  is_wallet_account?: boolean;
  is_copy_trading?: boolean;
  is_active?: boolean;
  account_group?: AccountGroupInfo | null;
  created_at?: string;
}

function fmt(n: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(n);
}

function readAlias(id: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(`${ALIAS_PREFIX}${id}`) || '';
  } catch {
    return '';
  }
}

function writeAlias(id: string, value: string) {
  try {
    const v = value.trim();
    if (v) localStorage.setItem(`${ALIAS_PREFIX}${id}`, v);
    else localStorage.removeItem(`${ALIAS_PREFIX}${id}`);
  } catch {
    /* ignore */
  }
}

function toTradingAccount(row: AccountRow): TradingAccount {
  return {
    id: row.id,
    account_number: row.account_number,
    balance: row.balance,
    credit: row.credit,
    equity: row.equity,
    margin_used: row.margin_used,
    free_margin: row.free_margin,
    margin_level: row.margin_level,
    leverage: row.leverage,
    currency: row.currency,
    is_demo: row.is_demo,
    is_wallet_account: Boolean(row.is_wallet_account),
    account_group: row.account_group ?? null,
  };
}

type AccountKindFilter = 'all' | 'live' | 'demo';
type ViewMode = 'grid' | 'list';

export default function AccountsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const setStoreAccounts = useTradingStore((s) => s.setAccounts);
  const setActiveAccount = useTradingStore((s) => s.setActiveAccount);
  const removeAccount = useTradingStore((s) => s.removeAccount);

  /* New filter state for the Vantage-style header row. */
  const [kindFilter, setKindFilter] = useState<AccountKindFilter>('live');
  const [groupFilter, setGroupFilter] = useState<string>('all'); // 'all' or AccountGroupInfo.id
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadGen = useRef(0);

  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [demoUpgradeOpen, setDemoUpgradeOpen] = useState(false);
  /** After creating an account, open-account sets sessionStorage; expand that card on Accounts. */
  const [expandAccountId, setExpandAccountId] = useState<string | null>(null);

  const fetchAccounts = useCallback(async (signal?: AbortSignal, opts: { silent?: boolean } = {}) => {
    const id = ++loadGen.current;
    if (!opts.silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await api.get<any>('/accounts', undefined, { signal });
      if (id !== loadGen.current) return;
      const list: AccountRow[] = Array.isArray(res) ? res : (res?.items ?? []);
      setRows(list);
      const tradingList = list.map(toTradingAccount);
      setStoreAccounts(tradingList);
    } catch (e) {
      if (id !== loadGen.current) return;
      // Silent polls swallow errors so a transient blip doesn't surface
      // a toast every 2s; the initial-load handler still shows them.
      if (opts.silent) return;
      const msg = e instanceof Error ? e.message : 'Failed to load accounts';
      setError(msg);
      toast.error(msg);
    } finally {
      if (id === loadGen.current && !opts.silent) setLoading(false);
    }
  }, [setStoreAccounts]);

  useEffect(() => {
    document.documentElement.setAttribute('data-page', 'accounts');
    return () => {
      document.documentElement.removeAttribute('data-page');
    };
  }, []);

  useEffect(() => {
    const ac = new AbortController();
    void fetchAccounts(ac.signal);
    return () => {
      ac.abort();
      loadGen.current += 1;
    };
  }, [fetchAccounts]);

  // Live equity / P&L polling. The backend recomputes equity on every
  // /accounts request using current Redis tick prices + open positions
  // (see account_service.list_accounts), so a 2 s poll keeps the P&L
  // column moving without any extra WebSocket plumbing. Polling pauses
  // while the tab is hidden so we don't burn requests for nothing.
  useEffect(() => {
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.hidden) return;
      void fetchAccounts(undefined, { silent: true });
    };

    const interval = setInterval(tick, 2000);
    const onVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden) tick();
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }
    return () => {
      cancelled = true;
      clearInterval(interval);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
  }, [fetchAccounts]);

  useEffect(() => {
    if (loading || rows.length === 0) return;
    let id: string | null = null;
    try {
      id = sessionStorage.getItem('ptd-accounts-expand');
    } catch {
      /* ignore */
    }
    if (!id) return;
    if (!rows.some((r) => r.id === id)) return;
    setExpandAccountId(id);
    try {
      sessionStorage.removeItem('ptd-accounts-expand');
    } catch {
      /* ignore */
    }
  }, [loading, rows]);

  useEffect(() => {
    if (!expandAccountId) return;
    const el = document.getElementById(`account-card-${expandAccountId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [expandAccountId]);

  /* Show all active accounts. CF/IF (follower copy-trade / managed sub-accounts)
     render with "View Trades" instead of Trade — the copy engine places trades
     there automatically. Pool accounts (CT/PM/MM) shown for master funding.
     Inactive accounts are hidden via is_active (delete_master sets this false). */
  const visibleRows = useMemo(() => {
    if (user?.is_demo) return rows.filter((a) => a.is_demo);
    return rows.filter((a) => {
      if ((a as { is_active?: boolean }).is_active === false) return false;
      /* Live/Demo filter — 'all' passes both through; 'live' hides demo;
         'demo' hides live. */
      if (kindFilter === 'live' && a.is_demo) return false;
      if (kindFilter === 'demo' && !a.is_demo) return false;
      /* Account-group filter — 'all' or a specific group id. */
      if (groupFilter !== 'all' && a.account_group?.id !== groupFilter) return false;
      return true;
    });
  }, [rows, user?.is_demo, kindFilter, groupFilter]);

  /* Distinct account groups present in the loaded data — drives the
     "All" dropdown. Only populated when group data is on the rows. */
  const availableGroups = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of rows) {
      const g = r.account_group;
      if (g && g.id && !seen.has(g.id)) seen.set(g.id, g.name || 'Standard');
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  /** Sync store + session before opening terminal (navigation via `<Link href>` so clicks always work). */
  const prepareTradeSession = (row: AccountRow) => {
    setActiveAccount(toTradingAccount(row));
    setPersistedTradingAccountId(row.id);
  };

  const handleAccountRemoved = (id: string) => {
    removeAccount(id);
    setRows((prev) => {
      const next = prev.filter((r) => r.id !== id);
      setStoreAccounts(next.map(toTradingAccount));
      return next;
    });
    if (getPersistedTradingAccountId() === id) setPersistedTradingAccountId(null);
  };


  /** Live account creation no longer gates on KYC — the only KYC gate left is
   *  on Razorpay (Card / UPI) deposits. Everything else (open account, trade,
   *  manual / crypto deposits, withdrawals) is unblocked. */
  const handleOpenNewAccount = () => {
    setAccountPickerOpen(true);
  };

  /* KPI strip — derived from the rows currently in view. */
  const totals = useMemo(() => {
    let balance = 0;
    let equity = 0;
    let credit = 0;
    for (const r of visibleRows) {
      balance += Number.isFinite(r.balance) ? r.balance : 0;
      equity += Number.isFinite(r.equity) ? r.equity : 0;
      credit += Number.isFinite(r.credit) ? r.credit : 0;
    }
    return { balance, equity, credit };
  }, [visibleRows]);
  const liveCount = visibleRows.filter((r) => !r.is_demo).length;
  const demoCount = visibleRows.length - liveCount;

  return (
    <DashboardShell>
      <AccountTypePickerModal
        open={accountPickerOpen}
        onClose={() => setAccountPickerOpen(false)}
        onCreated={() => void fetchAccounts()}
      />
      <Modal
        open={demoUpgradeOpen}
        onClose={() => setDemoUpgradeOpen(false)}
        title="Register a real account"
        width="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary leading-relaxed">
            Demo accounts are provisioned by our team and cannot add new trading accounts. To open additional accounts, please register a real account.
          </p>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t border-border-primary">
            <Button variant="outline" onClick={() => setDemoUpgradeOpen(false)}>
              Close
            </Button>
            <Link
              href="/auth/register"
              onClick={() => setDemoUpgradeOpen(false)}
              className="inline-flex h-9 items-center justify-center rounded-md bg-accent px-4 text-sm font-semibold text-text-on-accent shadow-sm transition-colors hover:bg-accent-hover"
            >
              Register Real Account
            </Link>
          </div>
        </div>
      </Modal>

      <div className="page-main w-full space-y-4 md:space-y-5 animate-fade-in">
        <PageHeader
          title="Accounts"
          description="Your live and demo trading accounts — open, fund and trade from one place."
          actions={
            <Button variant="primary" onClick={user?.is_demo ? () => setDemoUpgradeOpen(true) : handleOpenNewAccount}>
              Open Account
            </Button>
          }
        >
          {/* Filter / view bar */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Live/Demo + account-group filters only make sense for a
                registered user who can hold real accounts across tiers.
                A demo (try-with-demo) user has exactly one demo account,
                so the filters are hidden — they'd only show confusing
                'Live Account' / 'Standard' options that don't apply. */}
            {!user?.is_demo && (
              <>
                <Segmented
                  aria-label="Account kind"
                  value={kindFilter}
                  onChange={setKindFilter}
                  options={[
                    { value: 'all', label: 'All' },
                    { value: 'live', label: 'Live' },
                    { value: 'demo', label: 'Demo' },
                  ]}
                />
                {availableGroups.length > 0 && (
                  <div className="w-44">
                    <Select
                      size="sm"
                      aria-label="Account group"
                      value={groupFilter}
                      onChange={(e) => setGroupFilter(e.target.value)}
                    >
                      <option value="all">All groups</option>
                      {availableGroups.map((g) => (
                        <option key={g.id} value={g.id}>{g.name}</option>
                      ))}
                    </Select>
                  </div>
                )}
              </>
            )}
            <div className="flex-1" />

            {/* Grid / List view toggle */}
            <Segmented
              aria-label="View mode"
              value={viewMode}
              onChange={setViewMode}
              options={[
                { value: 'grid', label: <span className="sr-only">Grid view</span>, icon: <LayoutGrid aria-hidden /> },
                { value: 'list', label: <span className="sr-only">List view</span>, icon: <ListIcon aria-hidden /> },
              ]}
            />
          </div>
        </PageHeader>

        {/* KPI strip */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Accounts"
            value={loading ? '' : visibleRows.length}
            loading={loading}
            hint={loading ? undefined : `${liveCount} live · ${demoCount} demo`}
            icon={<Users />}
          />
          <StatCard label="Total balance" value={fmt(totals.balance)} loading={loading} icon={<Wallet />} />
          <StatCard label="Total equity" value={fmt(totals.equity)} loading={loading} icon={<TrendingUp />} />
          <StatCard label="Total credit" value={fmt(totals.credit)} loading={loading} icon={<ArrowDownToLine />} />
        </div>

        {loading && (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2" aria-busy>
            <Skeleton className="h-52" />
            <Skeleton className="h-52" />
          </div>
        )}

        {!loading && error && (
          <Card>
            <EmptyState
              compact
              title="Could not load accounts"
              description={<span className="text-danger">{error}</span>}
              action={
                <Button variant="outline" size="sm" onClick={() => void fetchAccounts()}>
                  Retry
                </Button>
              }
            />
          </Card>
        )}

        {!loading && !error && visibleRows.length === 0 && (
          <Card>
            <EmptyState
              icon={<Wallet />}
              title={user?.is_demo ? 'No demo account linked' : 'No trading account yet'}
              description={
                user?.is_demo
                  ? 'No demo trading account is linked yet.'
                  : 'You do not have a trading account yet. Use the "Open Account" button above to open one.'
              }
            />
          </Card>
        )}

        {!loading && !error && visibleRows.length > 0 && (
          <div
            className={cn(
              'grid gap-4',
              viewMode === 'grid'
                ? 'grid-cols-1 md:grid-cols-2'
                : 'grid-cols-1',
            )}
          >
            {visibleRows.map((row) => (
              <AccountCard
                key={row.id}
                row={row}
                onDeposit={() => router.push(`/wallet?tab=transfer&account=${row.id}`)}
                onTransfer={() => router.push('/wallet?tab=transfer')}
                onTrade={() => {
                  prepareTradeSession(row);
                  router.push(tradingTerminalUrl(row.id, { view: 'chart' }));
                }}
                onRemoved={handleAccountRemoved}
              />
            ))}

            {/* Join Copy Trading promo — full width across the grid */}
            <JoinCopyTradingCard onStart={() => router.push('/social')} />
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

/* ----------------------------------------------------------------------------
   Join Copy Trading promo card — spans both columns at md+.
   Click "Start Copying" → routes to /social (where the copy-trading UI lives).
   The inline SVG line is intentionally minimal so it stays performant and
   doesn't pull in image assets.
   ------------------------------------------------------------------------ */
function JoinCopyTradingCard({ onStart }: { onStart: () => void }) {
  return (
    <Card className="md:col-span-2 relative overflow-hidden" padding="lg">
      <div className="relative z-[1] flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
        <div className="max-w-md">
          <h3 className="text-md font-semibold tracking-tight text-text-primary">Join Copy Trading</h3>
          <p className="mt-2 text-sm leading-relaxed text-text-secondary">
            Mirror professional strategies with full transparency —
            <br />
            see every trade, set your own limits, stop any time.
          </p>
        </div>
        <Button variant="secondary" onClick={onStart} className="shrink-0">
          Start Copying
        </Button>
      </div>
      {/* Faded background trend graph — purely decorative */}
      <svg
        className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-1/2 opacity-30 md:block text-success"
        viewBox="0 0 400 160"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <linearGradient id="copy-trend-fade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d="M0,120 L40,110 L80,115 L120,90 L160,95 L200,70 L240,80 L280,55 L320,60 L360,35 L400,40 L400,160 L0,160 Z"
          fill="url(#copy-trend-fade)"
        />
        <path
          d="M0,120 L40,110 L80,115 L120,90 L160,95 L200,70 L240,80 L280,55 L320,60 L360,35 L400,40"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Card>
  );
}

/* ----------------------------------------------------------------------------
   AccountCard — compact card: status badges + account number + settings
   menu, group/server subline, nested summary tile with equity / credit /
   balance and the Deposit / Trade actions.
   ------------------------------------------------------------------------ */
function AccountCard({
  row,
  onDeposit,
  onTransfer,
  onTrade,
  onRemoved,
}: {
  row: AccountRow;
  onDeposit: () => void;
  onTransfer: () => void;
  onTrade: () => void;
  onRemoved: (id: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  /* `alias` is the persisted label shown on the card; `aliasDraft` is the
     in-flight edit inside the rename modal. Keeping them separate lets us
     update the card immediately on save without re-fetching from storage. */
  const [alias, setAlias] = useState('');
  const [aliasDraft, setAliasDraft] = useState('');
  const menuRef = useRef<HTMLDivElement | null>(null);

  /* Close the settings menu on outside-click. */
  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  useEffect(() => {
    const saved = readAlias(row.id);
    setAlias(saved);
    setAliasDraft(saved);
  }, [row.id]);

  const isActive = row.is_active !== false;
  // Copy-trading accounts get the "Copy Trading" tag. True when the backend
  // flags it (any master account — including an existing account picked at
  // apply time — or an active follower account) OR the account-number prefix
  // is a known copy/pool prefix (CF/IF followers, CT/PM/MM pools).
  const isManagedAccount = !!row.is_copy_trading || /^(CF|IF|CT|PM|MM)/.test(row.account_number);
  const groupName = row.account_group?.name?.trim() || 'Standard';
  /* PowerTradeFX has a single server — Live for real, Demo for demo accounts. */
  const serverLabel = row.is_demo ? 'PowerTradeFX-Demo' : 'PowerTradeFX-Live';

  const balance = Number.isFinite(row.balance) ? row.balance : 0;
  const credit = Number.isFinite(row.credit) ? row.credit : 0;
  const hasNumbers = balance > 0 || credit > 0;

  const confirmCloseAccount = async () => {
    setDeleting(true);
    try {
      await api.delete(`/accounts/${row.id}`);
      toast.success(row.is_demo ? 'Demo account removed.' : 'Account closed.');
      setCloseModal(false);
      onRemoved(row.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not close account');
    } finally {
      setDeleting(false);
    }
  };

  const saveAlias = () => {
    const next = aliasDraft.trim();
    writeAlias(row.id, next);
    setAlias(next);
    setRenameOpen(false);
    toast.success(next ? 'Label updated' : 'Label cleared');
  };

  const menuItemClass =
    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-bg-hover transition-colors';

  return (
    <Card id={`account-card-${row.id}`} interactive={false}>
      {/* Header — status badge + account number + settings cog */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <Badge variant={isActive ? 'success' : 'neutral'} size="sm" dot>
            {isActive ? 'Active' : 'Inactive'}
          </Badge>
          <Badge variant={row.is_demo ? 'neutral' : 'accent'} size="sm">
            {row.is_demo ? 'Demo' : 'Live'}
          </Badge>
          {isManagedAccount && (
            <Badge
              variant="accent"
              size="sm"
              title="Copy-trading account — trades are mirrored from the master you follow"
            >
              <Users size={12} aria-hidden />
              Copy Trading
            </Badge>
          )}
          {alias ? (
            <div className="min-w-0 flex flex-col leading-tight">
              <span className="truncate text-sm font-semibold text-text-primary" title={alias}>
                {alias}
              </span>
              <span className="text-xs font-mono tabular-nums text-text-tertiary">
                {row.account_number}
              </span>
            </div>
          ) : (
            <span className="text-sm font-semibold font-mono tabular-nums text-text-primary">
              {row.account_number}
            </span>
          )}
        </div>

        <div className="relative" ref={menuRef}>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Account settings"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
          >
            <Settings size={18} aria-hidden />
          </Button>
          {menuOpen && (
            <div role="menu" className="absolute right-0 top-9 z-20 w-44 rounded-lg border border-border-primary bg-card py-1 shadow-md animate-fade-in">
              <button
                type="button"
                role="menuitem"
                onClick={() => { setMenuOpen(false); setRenameOpen(true); }}
                className={menuItemClass}
              >
                <Pencil size={14} aria-hidden />
                Rename label
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => { setMenuOpen(false); onTransfer(); }}
                className={menuItemClass}
              >
                <ArrowLeftRight size={14} aria-hidden />
                Transfer funds
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => { setMenuOpen(false); setCloseModal(true); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger hover:bg-danger/10 transition-colors"
              >
                <Trash2 size={14} aria-hidden />
                Close account
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sub-header — copy-trading accounts show just "Copy Trading"; regular
          accounts show their group + server line. */}
      <p className="mt-2 text-xs text-text-tertiary">
        {isManagedAccount ? (
          <span className="font-medium text-accent">Copy Trading</span>
        ) : (
          <>
            {groupName} STP <span className="mx-2 text-border-strong">|</span> {serverLabel}
          </>
        )}
      </p>

      {/* Inner summary tile */}
      <Card nested className="mt-4">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-accent/15">
            <Wallet size={20} className="text-accent" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xxs font-semibold uppercase tracking-[0.1em] text-text-secondary">Equity</p>
            <p className="truncate text-xl font-semibold font-mono tabular-nums text-text-primary">
              {hasNumbers ? fmt(balance, row.currency) : '--'}
            </p>
            <p className="mt-0.5 text-xs text-text-tertiary font-mono tabular-nums">
              Credits: {hasNumbers ? fmt(credit, row.currency) : '-'}
              <span className="mx-2 text-border-strong">|</span>
              Balance: {hasNumbers ? fmt(balance, row.currency) : '-'}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          {/* Demo accounts run on play money — deposit doesn't apply, so
              the button is hidden on demo cards. Live cards keep it. */}
          {!row.is_demo && (
            <Button variant="secondary" size="sm" onClick={onDeposit} leftIcon={<ArrowDownToLine size={15} aria-hidden />}>
              Deposit
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onTrade}
            title={
              isManagedAccount
                ? 'Managed account — trades are mirrored from the master. Open the terminal to view the copied positions.'
                : undefined
            }
            leftIcon={<TrendingUp size={15} aria-hidden />}
          >
            {isManagedAccount ? 'View Trades' : 'Trade'}
          </Button>
        </div>
      </Card>

      {/* Close-account confirmation */}
      <Modal open={closeModal} onClose={() => !deleting && setCloseModal(false)} title="Close account">
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Close account <span className="font-mono font-semibold tabular-nums">{row.account_number}</span>?
          </p>
          <ul className="text-xs text-text-tertiary space-y-1 pl-4 list-disc">
            <li>Any open positions will close at their open price (zero P&amp;L).</li>
            <li>Pending orders will be cancelled.</li>
            {balance > 0 ? (
              <li>
                <span className="text-text-secondary font-semibold font-mono tabular-nums">{fmt(balance, row.currency)}</span> will transfer to your main wallet.
              </li>
            ) : null}
          </ul>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" disabled={deleting} onClick={() => setCloseModal(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              disabled={deleting}
              loading={deleting}
              onClick={() => void confirmCloseAccount()}
            >
              {deleting ? 'Closing…' : 'Close account'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Rename-label modal */}
      <Modal open={renameOpen} onClose={() => setRenameOpen(false)} title="Rename account label">
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Set a friendly label for account{' '}
            <span className="font-mono font-semibold tabular-nums">{row.account_number}</span>. Labels are stored
            locally on this device.
          </p>
          <Input
            value={aliasDraft}
            onChange={(e) => setAliasDraft(e.target.value)}
            placeholder="e.g. Main trading"
            aria-label="Account label"
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setRenameOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="primary" size="sm" onClick={saveAlias}>
              Save
            </Button>
          </div>
        </div>
      </Modal>
    </Card>
  );
}
