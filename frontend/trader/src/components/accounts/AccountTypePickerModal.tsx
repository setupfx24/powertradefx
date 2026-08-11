'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { ChevronDown, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api/client';
import { useAuthStore } from '@/stores/authStore';

export interface AvailableAccountGroup {
  id: string;
  name: string;
  description: string;
  leverage_default: number;
  /** Hard cap from migration 0020 — falls back to leverage_default for legacy rows. */
  max_leverage?: number;
  /** Per-user effective ceiling: the smaller of group cap and KYC gate
   *  (1:50 until verified). */
  effective_max_leverage?: number;
  /** UI hints for why the dropdown is locked below the group's hard cap. */
  kyc_unlock_required?: boolean;
  minimum_deposit: number;
  spread_markup: number;
  commission_per_lot: number;
  /** Percentage brokerage fee (e.g. 0.0006 = 0.06%) from migration 0020. May be null on legacy rows. */
  commission_pct?: number | null;
  swap_free: boolean;
}

const fmtMoney = (n: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: 0 })
    .format(n);

/** Generic candidate leverages — filtered to <= each group's max. */
const LEVERAGE_OPTIONS = [1, 25, 50, 100, 200, 300, 500, 1000, 2000];

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated?: (accountId: string) => void;
};

/**
 * AccountTypePickerModal — right-side slide-in drawer.
 *
 * Previously a centred modal that capped at max-w-5xl, the picker now
 * matches the Vantage / OctaFX-style "Open Account" drawer that anchors
 * to the right edge of the viewport: full-height panel, content sections
 * stacked vertically, sticky Submit at the bottom. The data model and
 * create flow are unchanged.
 */
export default function AccountTypePickerModal({ open, onClose, onCreated }: Props) {
  const user = useAuthStore((s) => s.user);
  const userIsDemo = !!user?.is_demo;

  const [mounted, setMounted] = useState(false);
  const [groups, setGroups] = useState<AvailableAccountGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [leverage, setLeverage] = useState<number | null>(null);
  // Real users can open either a real or a demo (practice) account.
  // Demo users are locked to demo. Default tracks the user's own status.
  const [requestedType, setRequestedType] = useState<'real' | 'demo'>(
    userIsDemo ? 'demo' : 'real',
  );

  useEffect(() => { setMounted(true); }, []);

  // Body scroll lock + Escape-to-close while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setSelectedId(null);
    setLeverage(null);
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const url = `/accounts/available-groups?type=${requestedType}`;
        const res = await api.get<{ items: AvailableAccountGroup[] }>(url);
        if (cancelled) return;
        const list = Array.isArray(res.items) ? res.items : [];
        setGroups(list);
        if (list.length > 0) {
          setSelectedId(list[0]!.id);
          setLeverage(list[0]!.leverage_default);
        }
      } catch (e) {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Could not load account types');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, requestedType]);

  const selected = useMemo(
    () => groups.find((g) => g.id === selectedId) || null,
    [groups, selectedId],
  );

  // The user-effective cap is what actually limits the dropdown — it's the
  // smaller of the group's hard cap (max_leverage), the KYC gate, and the
  // XP gate. Falls back to leverage_default for legacy rows.
  const groupMaxLeverage = (g: AvailableAccountGroup) =>
    Number(g.effective_max_leverage ?? g.max_leverage ?? g.leverage_default ?? 100);

  /** When the user picks a different group, clamp leverage to its max. */
  useEffect(() => {
    if (!selected) return;
    const maxLev = groupMaxLeverage(selected);
    if (leverage == null || leverage > maxLev) {
      setLeverage(maxLev);
    }
  }, [selected]);

  const leverageOptions = useMemo(() => {
    if (!selected) return [] as number[];
    const max = groupMaxLeverage(selected);
    const opts = LEVERAGE_OPTIONS.filter((l) => l <= max);
    if (!opts.includes(max)) opts.push(max);
    return Array.from(new Set(opts)).sort((a, b) => a - b);
  }, [selected]);

  const handleCreate = async () => {
    if (!selected) {
      toast.error('Select an account type');
      return;
    }
    setCreating(true);
    try {
      const res = await api.post<{ id: string; account_number: string }>('/accounts/open', {
        account_group_id: selected.id,
        leverage: leverage ?? selected.leverage_default,
        is_demo: requestedType === 'demo',
      });
      toast.success('Trading account created');
      onClose();
      if (res?.id) {
        try { sessionStorage.setItem('ptd-accounts-expand', res.id); } catch {}
        onCreated?.(res.id);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'KYC_REQUIRED') {
        toast.error('Please complete KYC verification before opening a live account.');
        onClose();
      } else {
        toast.error(msg || 'Could not open account');
      }
    } finally {
      setCreating(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    // The outer fixed wrapper stays mounted across open/close so the
    // slide animation has something to animate against. `pointer-events-
    // none` while closed lets clicks pass through to the underlying
    // page — without it, the invisible overlay swallowed every click
    // including the "Open Account" trigger that's supposed to reopen
    // this drawer.
    <div
      className={clsx(
        // Bumped above the AppNavbar (sticky z-50) and the support FAB
        // (z-75). Without this the navbar's backdrop-blur stacking
        // context bled through the top of the drawer.
        'fixed inset-0 z-[9999]',
        !open && 'pointer-events-none',
      )}
      aria-hidden={!open}
    >
      {/* Backdrop. Fades in/out so the drawer slide doesn't feel detached. */}
      <div
        className={clsx(
          'absolute inset-0 bg-black/40 transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={onClose}
      />

      {/* Panel — slides in from the right. transform-translate keeps the
          panel mounted across open/close so React state survives a close-
          and-reopen, while the body-scroll-lock effect only runs while
          `open` is true. */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Open account"
        // Inline `background` is belt-and-suspenders: even if the
        // bg-card utility doesn't apply for any reason, the panel
        // still renders fully opaque so the navbar can't bleed through.
        style={{ background: 'var(--bg-card, #FFFFFF)' }}
        className={clsx(
          'absolute top-0 right-0 h-full w-full sm:max-w-[640px] border-l border-border-primary shadow-2xl',
          'flex flex-col transform transition-transform duration-300 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Sticky header with title + close. */}
        <header className="flex items-center justify-between px-6 sm:px-8 py-5 border-b border-border-primary shrink-0">
          <h2 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">Open Account</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 -m-1.5 rounded-full text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
          >
            <X size={20} />
          </button>
        </header>

        {/* Scrollable content area. */}
        <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 space-y-7">
          {/* Live / Demo toggle — large pill row, occupies the full width
              like the Vantage drawer rather than a small inline segmented
              control. */}
          <div
            className="grid grid-cols-2 p-1 rounded-full"
            style={{ background: 'var(--bg-card-nested)', border: '1px solid var(--border-primary)' }}
          >
            <TypePill
              active={requestedType === 'real'}
              disabled={userIsDemo}
              label="Live Account"
              onClick={() => setRequestedType('real')}
            />
            <TypePill
              active={requestedType === 'demo'}
              disabled={false}
              label="Demo Account"
              onClick={() => setRequestedType('demo')}
            />
          </div>
          {userIsDemo && (
            <p className="-mt-3 text-xs text-text-tertiary">
              Demo users can only open demo accounts. Sign up for a real account to trade live.
            </p>
          )}

          {/* Account type picker — 2-column grid of group cards. */}
          <section>
            <h3 className="text-sm font-bold text-text-primary mb-3">Choose An Account Type</h3>
            {loading ? (
              <div className="flex items-center justify-center py-16 text-text-secondary text-sm gap-2">
                <Loader2 size={14} className="animate-spin" /> Loading account types…
              </div>
            ) : groups.length === 0 ? (
              <div
                className="rounded-xl border p-8 text-center text-sm text-text-secondary"
                style={{ background: 'var(--bg-card-nested)', borderColor: 'var(--border-primary)' }}
              >
                No account types are available yet. Please contact support.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {groups.map((g) => {
                  const sel = selectedId === g.id;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setSelectedId(g.id)}
                      className={clsx(
                        'relative text-left rounded-xl p-4 transition-all',
                        sel ? 'ring-2 ring-accent/60' : '',
                      )}
                      style={{
                        background: 'var(--bg-card-nested)',
                        border: `1px solid ${sel ? 'var(--accent)' : 'var(--border-primary)'}`,
                      }}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-bold text-text-primary tracking-wide uppercase">
                          {g.name || 'Standard'}
                        </span>
                        {g.swap_free && (
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                            style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981', border: '1px solid rgba(16,185,129,0.35)' }}
                          >
                            Swap-free
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-tertiary mb-3 leading-snug line-clamp-2">
                        {g.description || 'Currencies, indices, metals, energies, crypto'}
                      </p>
                      <div className="space-y-1 text-[11px] text-text-secondary">
                        <Row k="Spread from" v={`${(g.spread_markup || 0.6).toFixed(1)} pips`} />
                        <Row k="Min deposit" v={fmtMoney(g.minimum_deposit || 0)} />
                        <Row
                          k="Max leverage"
                          v={`1:${groupMaxLeverage(g)}`}
                        />
                        <Row
                          k={g.commission_pct != null ? 'Brokerage' : 'Commission'}
                          v={
                            g.commission_pct != null
                              ? `${(g.commission_pct * 100).toFixed(2)}%`
                              : `${fmtMoney(g.commission_per_lot || 0)} / lot`
                          }
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* Leverage */}
          <section>
            <h3 className="text-sm font-bold text-text-primary mb-3">Leverage</h3>
            <div className="relative">
              <select
                value={leverage ?? ''}
                onChange={(e) => setLeverage(Number(e.target.value))}
                disabled={!selected || leverageOptions.length === 0}
                className="w-full appearance-none pl-4 pr-10 py-3 rounded-xl text-sm font-semibold bg-card-nested text-text-primary disabled:opacity-50"
                style={{ border: '1px solid var(--border-primary)' }}
              >
                {leverageOptions.map((l) => (
                  <option key={l} value={l}>1:{l}</option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
            </div>
            {selected && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-text-tertiary">
                  Capped at this account type&apos;s maximum: 1:{groupMaxLeverage(selected)}
                </p>
                {selected.kyc_unlock_required && (
                  <p className="text-xs text-amber-400/85">
                    Complete KYC to unlock higher leverage.
                  </p>
                )}
              </div>
            )}
          </section>
        </div>

        {/* Sticky footer with Submit. */}
        <footer className="px-6 sm:px-8 py-4 border-t border-border-primary shrink-0 bg-card">
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || !selected}
            className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-accent hover:bg-accent-hover text-white shadow-[0_2px_8px_rgb(var(--accent-rgb) / 0.25)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating && <Loader2 size={14} className="animate-spin" />}
            {creating ? 'Creating…' : 'Submit'}
          </button>
        </footer>
      </aside>
    </div>,
    document.body,
  );
}

/* ───────────── Tiny UI atoms ───────────── */

function TypePill({
  active,
  disabled,
  label,
  onClick,
}: {
  active: boolean;
  disabled: boolean;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className="py-2.5 text-sm font-semibold rounded-full transition-colors select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
      style={{
        background: active ? 'var(--bg-card)' : 'transparent',
        color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: 'none',
        boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
      }}
    >
      {label}
    </button>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-text-tertiary">{k}</span>
      <span className="font-medium text-text-primary tabular-nums">{v}</span>
    </div>
  );
}
