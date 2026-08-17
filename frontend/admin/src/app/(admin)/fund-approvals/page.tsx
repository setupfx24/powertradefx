'use client';

/**
 * Fund Approvals — the second half of the two-person rule for admin fund
 * moves. Non-super-admin add/deduct-fund and give/take-credit requests are
 * staged by the backend as `pending` here; a DIFFERENT admin with the
 * `funds.approve` permission (or a super admin) executes or rejects them.
 * The backend refuses self-approval, so the buttons may 403 for the
 * requester — that is the feature, not a bug.
 */

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { ShieldCheck, Check, X } from 'lucide-react';
import { adminApi } from '@/lib/api';
import { cn } from '@/lib/utils';

interface FundApproval {
  id: string;
  action: string;
  target_user_email: string;
  target_account_id: string | null;
  amount: number;
  source: string | null;
  description: string | null;
  status: string;
  requested_by_email: string;
  requested_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
}

const ACTION_LABELS: Record<string, string> = {
  add_fund: 'Add Fund',
  deduct_fund: 'Deduct Fund',
  give_credit: 'Give Credit',
  take_credit: 'Take Credit',
};

const TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'executed', label: 'Executed' },
  { key: 'rejected', label: 'Rejected' },
] as const;

type Tab = (typeof TABS)[number]['key'];

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function FundApprovalsPage() {
  const [tab, setTab] = useState<Tab>('pending');
  const [items, setItems] = useState<FundApproval[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<FundApproval | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const perPage = 20;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.get<{ items: FundApproval[]; total: number }>(
        '/fund-approvals',
        { status: tab, page: String(page), per_page: String(perPage) },
      );
      setItems(res.items || []);
      setTotal(res.total || 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load approvals');
    } finally {
      setLoading(false);
    }
  }, [tab, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const approve = async (a: FundApproval) => {
    setActingId(a.id);
    try {
      await adminApi.post(`/fund-approvals/${a.id}/approve`);
      toast.success(`${ACTION_LABELS[a.action] || a.action} executed`);
      fetchData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Approval failed');
    } finally {
      setActingId(null);
    }
  };

  const submitReject = async () => {
    if (!rejecting) return;
    setActingId(rejecting.id);
    try {
      await adminApi.post(`/fund-approvals/${rejecting.id}/reject`, {
        reason: rejectReason || undefined,
      });
      toast.success('Request rejected');
      setRejecting(null);
      setRejectReason('');
      fetchData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Reject failed');
    } finally {
      setActingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <ShieldCheck size={20} className="text-accent" />
        <h1 className="text-lg font-semibold text-text-primary">Fund Approvals</h1>
      </div>
      <p className="text-xs text-text-secondary max-w-2xl">
        Fund moves initiated by employees wait here until a second admin with the
        <span className="font-mono mx-1">funds.approve</span>permission executes or
        rejects them. You cannot approve your own request.
      </p>

      <div className="flex gap-1 border-b border-border-primary">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setTab(t.key); setPage(1); }}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-fast',
              tab === t.key
                ? 'border-accent text-text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border-primary bg-bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-text-tertiary border-b border-border-primary">
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Requested by</th>
              <th className="px-4 py-3">Requested at</th>
              {tab === 'rejected' && <th className="px-4 py-3">Reason</th>}
              {tab === 'pending' && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-text-tertiary">Loading…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-text-tertiary">No {tab} requests</td></tr>
            ) : items.map((a) => (
              <tr key={a.id} className="border-b border-border-primary last:border-0">
                <td className="px-4 py-3 font-medium text-text-primary">
                  {ACTION_LABELS[a.action] || a.action}
                </td>
                <td className="px-4 py-3 text-text-secondary">{a.target_user_email}</td>
                <td className="px-4 py-3 font-mono text-text-primary">
                  ${a.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  {a.source || (a.target_account_id ? 'trading account' : 'main wallet')}
                </td>
                <td className="px-4 py-3 text-text-secondary">{a.requested_by_email}</td>
                <td className="px-4 py-3 text-text-tertiary">{fmtDate(a.requested_at)}</td>
                {tab === 'rejected' && (
                  <td className="px-4 py-3 text-text-tertiary">{a.rejection_reason || '—'}</td>
                )}
                {tab === 'pending' && (
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={actingId === a.id}
                        onClick={() => approve(a)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-buy/10 border border-buy/25 text-buy text-xs font-semibold hover:bg-buy/20 transition-fast disabled:opacity-50"
                      >
                        <Check size={12} /> Approve
                      </button>
                      <button
                        type="button"
                        disabled={actingId === a.id}
                        onClick={() => { setRejecting(a); setRejectReason(''); }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-sell/10 border border-sell/25 text-sell text-xs font-semibold hover:bg-sell/20 transition-fast disabled:opacity-50"
                      >
                        <X size={12} /> Reject
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs text-text-secondary">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="px-3 py-1.5 rounded border border-border-primary disabled:opacity-40"
          >
            Prev
          </button>
          <span>Page {page} / {totalPages}</span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="px-3 py-1.5 rounded border border-border-primary disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {rejecting && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg-base/80 backdrop-blur-sm"
          onClick={() => setRejecting(null)}
        >
          <div
            className="w-full max-w-md rounded-lg border border-border-primary bg-bg-card p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-sm font-semibold text-text-primary">
              Reject {ACTION_LABELS[rejecting.action] || rejecting.action} — $
              {rejecting.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} for {rejecting.target_user_email}
            </h2>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason (optional)"
              rows={3}
              className="w-full rounded-md border border-border-primary bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejecting(null)}
                className="px-4 py-2 rounded-md border border-border-primary text-sm text-text-secondary hover:text-text-primary transition-fast"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actingId === rejecting.id}
                onClick={submitReject}
                className="px-4 py-2 rounded-md bg-sell/10 border border-sell/25 text-sell text-sm font-semibold hover:bg-sell/20 transition-fast disabled:opacity-50"
              >
                Reject request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
