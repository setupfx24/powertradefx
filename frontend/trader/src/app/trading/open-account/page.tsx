'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api/client';
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton } from '@/components/ui';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { tradingTerminalUrl, setPersistedTradingAccountId } from '@/lib/tradingNav';

interface OpenAccountResponse {
  id: string;
  account_number: string;
  balance: number;
  account_group_id: string;
  account_group_name: string;
}

interface GroupItem {
  id: string;
  name: string;
  description: string;
  leverage_default: number;
  minimum_deposit: number;
  spread_markup: number;
  commission_per_lot: number;
  swap_free: boolean;
}

function fmtMoney(n: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 2 }).format(n);
}

/** Label + monospace value pair inside an account-type card. */
function Spec({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="text-xxs text-text-tertiary">
      {label}{' '}
      <span className="text-text-primary font-mono tabular-nums">{value}</span>
    </div>
  );
}

function OpenAccountPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ items: GroupItem[] }>('/accounts/available-groups');
        if (!cancelled) setGroups(Array.isArray(res.items) ? res.items : []);
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Could not load account types');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const preselectId = searchParams.get('group');
  useEffect(() => {
    if (!preselectId || groups.length === 0) return;
    if (groups.some((g) => g.id === preselectId)) setSelected(preselectId);
  }, [preselectId, groups]);

  const openAccount = async (groupId: string) => {
    setOpening(groupId);
    try {
      const res = await api.post<OpenAccountResponse>('/accounts/open', { account_group_id: groupId });
      toast.success('Trading account created — opening terminal…');
      if (res?.id) {
        setPersistedTradingAccountId(res.id);
        router.push(tradingTerminalUrl(res.id, { view: 'chart' }));
      } else {
        router.push('/trading');
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not open account');
    } finally {
      setOpening(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-bg-base">
      <div className="page-main max-w-3xl mx-auto py-6 sm:py-8 space-y-4 md:space-y-5">
        <PageHeader
          title="Open live account"
          description="Choose an account type configured by your broker. If a minimum opening amount is set and you already have funded live accounts, that amount is moved from your existing balances into this new account. Your first account opens at $0 until you deposit; you must meet the minimum balance before placing trades."
        />

        {loading ? (
          <div className="space-y-3" aria-busy>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : groups.length === 0 ? (
          <Card>
            <EmptyState title="No account types available" description="No account types are available yet. Please contact support." />
          </Card>
        ) : (
          <ul className="space-y-3">
            {groups.map((g) => {
              const isSel = selected === g.id;
              return (
                <li key={g.id}>
                  <Card
                    padding="none"
                    interactive={!isSel}
                    className={clsx('overflow-hidden', isSel && 'border-accent bg-accent/5')}
                  >
                    <button
                      type="button"
                      onClick={() => setSelected(g.id)}
                      aria-pressed={isSel}
                      className="w-full text-left p-4 sm:p-5 space-y-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 rounded-lg"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-md font-semibold text-text-primary">{g.name}</span>
                        {g.swap_free ? <Badge variant="success" size="sm">Swap-free</Badge> : null}
                      </div>
                      {g.description ? (
                        <p className="text-xs text-text-secondary">{g.description}</p>
                      ) : null}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
                        <Spec label="Min. balance (to trade)" value={fmtMoney(g.minimum_deposit)} />
                        <Spec label="Leverage" value={`1:${g.leverage_default}`} />
                        <Spec label="Commission / lot" value={g.commission_per_lot} />
                      </div>
                    </button>
                    {isSel ? (
                      <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0 flex flex-col sm:flex-row gap-2 sm:justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="md"
                          onClick={() => setSelected(null)}
                          className="sm:w-auto"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          variant="primary"
                          size="md"
                          loading={opening === g.id}
                          onClick={() => openAccount(g.id)}
                          className="sm:w-auto"
                        >
                          Open this account
                        </Button>
                      </div>
                    ) : null}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-xs text-text-tertiary">
          <Link href="/trading" className="text-accent hover:underline underline-offset-4">
            Back to trading
          </Link>
          {' · '}
          <Link href="/dashboard" className="text-accent hover:underline underline-offset-4">
            Dashboard
          </Link>
          {' · '}
          <Link href="/accounts" className="text-accent hover:underline underline-offset-4">
            Accounts
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function OpenAccountPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 overflow-y-auto bg-bg-base">
          <div className="page-main max-w-3xl mx-auto py-6 sm:py-8">
            <div className="text-sm text-text-tertiary py-12 text-center">Loading…</div>
          </div>
        </div>
      }
    >
      <OpenAccountPageInner />
    </Suspense>
  );
}
