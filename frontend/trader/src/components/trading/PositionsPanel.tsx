'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useUIStore } from '@/stores/uiStore';
import { useTradingStore, type Position, type InstrumentInfo } from '@/stores/tradingStore';
import { clsx } from 'clsx';
import api from '@/lib/api/client';
import toast from 'react-hot-toast';
import { sounds, unlockAudio } from '@/lib/sounds';
import { netPnl, sumNetPnl } from '@/lib/pnl';
import {
  RefreshCw,
  Download,
  Pencil,
  Check,
  X,
  Plus,
  TrendingUp,
  TrendingDown,
  Layers,
  Info,
  LayoutGrid,
  LayoutList,
  ArrowRight,
  Share2,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Segmented,
  SideBadge,
  Skeleton,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Tabs,
} from '@/components/ui';
import type { BadgeVariant } from '@/components/ui';
import { ActiveAccountBadge } from '@/components/trading/ActiveAccountBadge';
import dynamic from 'next/dynamic';

// Lazy: ShareTradeModal pulls in html-to-image (~50KB) which is only needed
// when the user actually opens the share dialog — keep it out of the
// terminal's initial bundle.
const ShareTradeModal = dynamic(() => import('@/components/trading/ShareTradeModal'), { ssr: false });
import MarginRing from '@/components/trading/MarginRing';

interface ClosedTrade {
  id: string;
  symbol: string;
  side: string;
  lots: number;
  open_price: number;
  close_price: number;
  /** SL/TP that were set on the underlying Position when this trade
   * closed. Null when no limit was configured. Backed by a join in
   * portfolio_service.trade_history. */
  stop_loss?: number | null;
  take_profit?: number | null;
  pnl: number;
  commission: number;
  swap: number;
  close_time: string;
  close_reason?: string;
  trade_type?: string;
}

type CloseModal = { id: string; symbol: string; side: string; lots: number; closeLots: string; selectedPct: number | null } | null;
type SltpEdit = { positionId: string; sl: string; tp: string } | null;
type BulkCloseType = 'all' | 'profit' | 'loss';

type TabId = 'open' | 'pending' | 'history';

/** Maps API close_reason (sl, tp, manual, …) to a short label + badge style for history.
 *  When a trigger price is available (SL/TP hits close at the level itself), the label
 *  includes "@ <price>" so the user sees exactly where it fired. */
/** Maps API close_reason (sl, tp, manual, …) to a short label + Badge variant for history.
 *  When a trigger price is available (SL/TP hits close at the level itself), the label
 *  includes "@ <price>" so the user sees exactly where it fired. */
function closeReasonBadge(
  reason: string | null | undefined,
  triggerPrice?: number,
  digits: number = 5,
): { label: string; variant: BadgeVariant } {
  const r = (reason || 'manual').toLowerCase();
  const priceStr = triggerPrice != null && Number.isFinite(triggerPrice)
    ? ` @ ${Number(triggerPrice).toFixed(digits)}`
    : '';
  if (r === 'sl' || r === 'stop_loss')
    return { label: `Stop loss${priceStr}`, variant: 'sell' };
  if (r === 'tp' || r === 'take_profit')
    return { label: `Take profit${priceStr}`, variant: 'buy' };
  if (r === 'admin')
    return { label: 'Admin', variant: 'warning' };
  if (r === 'margin' || r === 'liquidation' || r === 'margin_call')
    return { label: 'Margin', variant: 'danger' };
  // Treat copy_close / copy / manual / anything else as manual close for clarity.
  return { label: 'Manual close', variant: 'neutral' };
}

/** Signed P/L colour: positive = success, negative = danger. */
function pnlTone(n: number): string {
  return n >= 0 ? 'text-success' : 'text-danger';
}

/** "Copy" (copy-trade) vs "Real" position chip. */
function TradeTypeBadge({ tradeType }: { tradeType?: string }) {
  const copy = tradeType === 'copy_trade';
  return (
    <Badge variant={copy ? 'info' : 'success'} size="sm" className="normal-case tracking-normal">
      {copy ? 'Copy' : 'Real'}
    </Badge>
  );
}

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const esc = (c: string | number) => {
    const s = String(c);
    return `"${s.replace(/"/g, '""')}"`;
  };
  const body = rows.map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type PositionsPanelProps = {
  /** Terminal: minimal borders / grid lines (clean table). */
  variant?: 'default' | 'terminal';
};

function estimatePositionMargin(
  pos: Position,
  instruments: { symbol: string; contract_size: number }[],
  leverage: number,
): number | null {
  const inst = instruments.find((i) => i.symbol === pos.symbol);
  if (!inst || !leverage) return null;
  const notional = pos.lots * inst.contract_size * pos.open_price;
  return notional / leverage;
}

function formatPositionOpenedAt(iso: string | undefined): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function partitionCloneLots(pos: Position, instruments: InstrumentInfo[]): number {
  const inst = instruments.find((i) => i.symbol === pos.symbol);
  const step = inst?.lot_step ?? 0.01;
  const minL = inst?.min_lot ?? 0.01;
  const half = pos.lots / 2;
  let snapped = Math.floor(half / step) * step;
  snapped = Number(Math.max(minL, snapped).toFixed(8));
  if (snapped >= pos.lots - 1e-12) return minL;
  return snapped;
}

/** Lots for partial close by fraction of open size, snapped to instrument lot step. */
function snapLotsForCloseFraction(
  totalLots: number,
  symbol: string,
  instruments: InstrumentInfo[],
  fraction: number,
): number {
  if (fraction >= 1 - 1e-12) return totalLots;
  const inst = instruments.find((i) => i.symbol === symbol);
  const step = inst?.lot_step ?? 0.01;
  const minL = inst?.min_lot ?? 0.01;
  const raw = totalLots * Math.min(1, Math.max(0, fraction));
  let v = Math.floor(raw / step) * step;
  v = Number(Math.max(minL, Math.min(v, totalLots)).toFixed(8));
  if (v >= totalLots - 1e-12) {
    const backoff = Number((totalLots - step).toFixed(8));
    if (backoff >= minL - 1e-12) return backoff;
    return totalLots;
  }
  return v;
}

function formatLotsInput(n: number): string {
  const r = Number(n.toFixed(8));
  return String(r);
}

/** Terminal card view: compact; close / partial close open the same modal as table layout. */
/** Terminal card view: compact; close / partial close open the same modal as table layout. */
function TerminalPositionStaticCard({
  pos,
  digits,
  marginExposureLine,
  swapsFeeLine,
  onCloseFull,
  onPartialClose,
}: {
  pos: Position;
  digits: number;
  marginExposureLine: string;
  swapsFeeLine: string;
  onCloseFull: () => void;
  onPartialClose: () => void;
}) {
  // NET P&L (profit − commission + swap; swap stored negative) so the card
  // matches the position rows and the mobile app.
  const pnl = netPnl(pos);
  const cur = pos.current_price;
  const priceDown = cur != null && (pos.side === 'buy' ? cur < pos.open_price : cur > pos.open_price);

  return (
    <Card padding="none" className="w-full max-w-[300px] overflow-hidden shadow-md">
      <div className="px-2.5 pt-2 pb-2 flex justify-between gap-2 border-b border-border-primary">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-text-primary font-mono tracking-tight">{pos.symbol}</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <SideBadge side={pos.side} />
            <span className="text-xxs text-text-tertiary tabular-nums">{pos.lots} Lots</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <Badge variant={pnl >= 0 ? 'success' : 'danger'} tone="outline" size="sm" className="font-mono tabular-nums normal-case">
            {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
          </Badge>
          <div className="flex justify-end gap-0.5 mt-1">
            <span className="text-xxs font-semibold uppercase px-1 py-0.5 rounded-sm bg-bg-secondary text-text-tertiary">
              SL
            </span>
            <span className="text-xxs font-semibold uppercase px-1 py-0.5 rounded-sm bg-bg-secondary text-text-tertiary">
              TP
            </span>
          </div>
        </div>
      </div>

      <div className="px-2.5 py-1.5 flex items-start justify-between gap-1.5">
        <div className="min-w-0 flex-1">
          <div className="text-xxs font-bold uppercase tracking-wide text-text-tertiary">Entry price</div>
          <div className="text-xs font-mono font-semibold text-text-primary tabular-nums leading-tight">
            {pos.open_price.toFixed(digits)}
          </div>
          <div className="text-xxs text-text-tertiary mt-0.5 leading-tight">{formatPositionOpenedAt(pos.created_at)}</div>
        </div>
        <ArrowRight className="w-3 h-3 text-text-tertiary shrink-0 mt-3" aria-hidden />
        <div className="min-w-0 flex-1 text-right">
          <div className="text-xxs font-bold uppercase tracking-wide text-text-tertiary">Current price</div>
          <div className="text-xs font-mono font-semibold tabular-nums inline-flex items-center justify-end gap-0.5 text-text-primary leading-tight">
            {cur != null ? cur.toFixed(digits) : '—'}
            {cur != null &&
              (priceDown ? (
                <TrendingDown className="w-3 h-3 text-danger" aria-hidden />
              ) : (
                <TrendingUp className="w-3 h-3 text-success" aria-hidden />
              ))}
          </div>
        </div>
      </div>

      <div className="px-2.5 pb-1.5 grid grid-cols-2 gap-x-2 gap-y-1 text-xxs">
        <div>
          <div className="text-xxs font-semibold uppercase text-text-tertiary mb-px">Stop loss</div>
          <div className="font-mono text-text-primary leading-tight tabular-nums">
            {pos.stop_loss != null ? pos.stop_loss.toFixed(digits) : '—'}
          </div>
        </div>
        <div>
          <div className="text-xxs font-semibold uppercase text-text-tertiary mb-px">Take profit</div>
          <div className="font-mono text-text-primary leading-tight tabular-nums">
            {pos.take_profit != null ? pos.take_profit.toFixed(digits) : '—'}
          </div>
        </div>
        <div>
          <div className="text-xxs font-semibold uppercase text-text-tertiary mb-px">Swaps / Fee</div>
          <div className="font-mono text-text-secondary tabular-nums leading-tight">{swapsFeeLine}</div>
        </div>
        <div>
          <div className="text-xxs font-semibold uppercase text-text-tertiary mb-px">Margin / Exposure</div>
          <div className="font-mono text-text-secondary tabular-nums leading-tight break-all">
            {marginExposureLine}
          </div>
        </div>
      </div>

      <p className="px-2.5 pb-1 text-xxs text-text-tertiary font-mono truncate" title={pos.id}>
        POSITION ID: {pos.id}
      </p>

      <div className="px-2.5 pb-2 pt-1.5 flex flex-col gap-1.5 border-t border-border-primary">
        <Button
          variant="danger"
          size="xs"
          fullWidth
          className="uppercase tracking-wide"
          onClick={(e) => {
            e.stopPropagation();
            onCloseFull();
          }}
        >
          Close
        </Button>
        <Button
          variant="secondary"
          size="xs"
          fullWidth
          className="uppercase tracking-wide"
          onClick={(e) => {
            e.stopPropagation();
            onPartialClose();
          }}
        >
          Partial close
        </Button>
      </div>
    </Card>
  );
}

export default function PositionsPanel({ variant = 'default' }: PositionsPanelProps) {
  const isTerminal = variant === 'terminal';
  // Narrow selectors: this panel re-renders on position/account updates but no
  // longer on unrelated slices (action references are stable in zustand).
  const positions = useTradingStore((s) => s.positions);
  const pendingOrders = useTradingStore((s) => s.pendingOrders);
  const activeAccount = useTradingStore((s) => s.activeAccount);
  const accounts = useTradingStore((s) => s.accounts);
  const removePosition = useTradingStore((s) => s.removePosition);
  const refreshPositions = useTradingStore((s) => s.refreshPositions);
  const refreshAccount = useTradingStore((s) => s.refreshAccount);
  const refreshPendingOrders = useTradingStore((s) => s.refreshPendingOrders);
  const instruments = useTradingStore((s) => s.instruments);
  // The active tab lives in the UI store so the order panel can jump here
  // ("pending") right after a limit/stop order is placed. The persisted
  // default is the legacy 'positions' value — anything unknown maps to 'open'.
  const storeTab = useUIStore((s) => s.activeBottomTab);
  const setActiveBottomTab = useUIStore((s) => s.setActiveBottomTab);
  const activeTab: TabId = storeTab === 'pending' || storeTab === 'history' ? storeTab : 'open';
  const setActiveTab = (t: TabId) => setActiveBottomTab(t);
  const [historyTrades, setHistoryTrades] = useState<ClosedTrade[]>([]);
  // Server-reported TOTAL closed trades — the list holds only the latest page
  // (200), so counts must come from here, not items.length.
  const [historyTotal, setHistoryTotal] = useState<number | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [closeModal, setCloseModal] = useState<CloseModal>(null);
  const [closeSubmitting, setCloseSubmitting] = useState(false);
  const [toolbarBusy, setToolbarBusy] = useState(false);
  const [sltpEdit, setSltpEdit] = useState<SltpEdit>(null);
  const [sltpSaving, setSltpSaving] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState<BulkCloseType | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  /** Terminal open tab: static trade cards vs compact table. */
  const [terminalOpenCardView, setTerminalOpenCardView] = useState(false);
  const [sharePosition, setSharePosition] = useState<Position | null>(null);

  // GROSS floating P&L — used for Equity / Free Margin only. Commission was
  // already deducted from balance at open, and swap when charged, so equity
  // MUST use gross (adding net here would double-count the fees).
  const totalPnl = positions.reduce((s, p) => s + (p.profit || 0), 0);
  // NET floating P&L (profit − commission + swap; swap is stored negative for
  // charges) — this is the figure shown to the trader and kept in sync with
  // the mobile app's per-position P&L.
  const netTotalPnl = sumNetPnl(positions);

  const profitPositions = positions.filter((p) => (p.profit || 0) > 0);
  const lossPositions = positions.filter((p) => (p.profit || 0) < 0);

  useEffect(() => {
    if (!closeModal && !bulkConfirm) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (bulkConfirm) setBulkConfirm(null);
      else setCloseModal(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeModal, bulkConfirm]);

  const getDigits = (symbol: string) => {
    const inst = instruments.find((i) => i.symbol === symbol);
    return inst?.digits ?? 5;
  };

  const accountLabel = (accountId: string) => {
    const a = accounts.find((x) => x.id === accountId);
    return a?.account_number ?? accountId.slice(0, 8);
  };

  // History is scoped to the ACTIVE account — without account_id the endpoint
  // returns every account's trades, so switching accounts showed the same
  // (mixed) history everywhere. Keyed on the account id so the callback
  // identity changes on switch and every effect below refetches.
  const activeAccountId = activeAccount?.id;
  const loadHistory = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!activeAccountId) {
      setHistoryTrades([]);
      return;
    }
    // Silent polls skip the loading toggle so the list doesn't
    // flicker into a "Loading history…" placeholder every 4 s.
    if (!opts.silent) setHistoryLoading(true);
    try {
      const res = await api.get<{ items?: ClosedTrade[]; total?: number } | ClosedTrade[]>('/portfolio/trades', {
        page: '1',
        per_page: '200',
        account_id: activeAccountId,
      });
      setHistoryTrades(
        (res && typeof res === 'object' && 'items' in res ? res.items : Array.isArray(res) ? res : []) || [],
      );
      setHistoryTotal(
        res && typeof res === 'object' && 'total' in res && Number.isFinite(Number(res.total))
          ? Number(res.total)
          : null,
      );
    } catch {
      // Silent polls swallow errors — last-known list stays put.
      if (!opts.silent) setHistoryTrades([]);
    }
    if (!opts.silent) setHistoryLoading(false);
  }, [activeAccountId]);

  useEffect(() => {
    if (activeTab === 'history') void loadHistory();
  }, [activeTab, loadHistory]);

  // Live refresh while the History tab is open. Without this, when a
  // trade closes via SL/TP (or admin action) the user has to manually
  // switch tabs to see it. Poll only when this tab is the visible one
  // and the browser tab itself isn't backgrounded.
  useEffect(() => {
    if (activeTab !== 'history') return;
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void loadHistory({ silent: true });
    }, 4000);
    return () => clearInterval(interval);
  }, [activeTab, loadHistory]);

  // Push refresh: the trading layout broadcasts `trade:closed` whenever
  // the SL/TP engine notifies us over WebSocket. Pull the new history row
  // immediately instead of waiting up to 4s for the next poll, so a fill
  // is visible the moment it happens — and works whether or not the
  // History tab is the active one.
  useEffect(() => {
    const onClosed = () => { void loadHistory({ silent: true }); };
    window.addEventListener('trade:closed', onClosed);
    return () => window.removeEventListener('trade:closed', onClosed);
  }, [loadHistory]);

  // Drop the previous account's rows the moment the account switches — the
  // silent refetch below would otherwise leave them visible until it lands.
  useEffect(() => {
    setHistoryTrades([]);
    setHistoryTotal(null);
  }, [activeAccountId]);

  // Load closed-trade history once on mount (and again on account switch,
  // since loadHistory is keyed on the account id) so the "Closed Positions"
  // count badge is accurate immediately — not 0 until the tab is opened.
  useEffect(() => {
    void loadHistory({ silent: true });
  }, [loadHistory]);

  // Reload history whenever an open position disappears (count drops) — a
  // close happened. This covers copy-trade closes on a follower account,
  // which close the position server-side via the copy engine but don't emit
  // a `trade:closed` event, so the History tab would otherwise stay stale.
  const prevOpenCountRef = useRef(positions.length);
  useEffect(() => {
    if (positions.length < prevOpenCountRef.current) {
      void loadHistory({ silent: true });
    }
    prevOpenCountRef.current = positions.length;
  }, [positions.length, loadHistory]);

  const closePosition = (id: string, lots?: number) => {
    unlockAudio();
    // Close modal instantly — don't wait for API
    setCloseModal(null);
    setCloseSubmitting(false);

    if (id.startsWith('optim-')) {
      toast('Trade still settling — try again in a moment', { icon: '⏳' });
      refreshPositions().catch(() => {});
      return;
    }

    const body: Record<string, unknown> = {};
    if (lots) body.lots = lots;

    // Optimistic: remove from UI immediately for full close
    if (!lots) removePosition(id);

    void (async () => {
      try {
        const res = await api.post<{ profit?: number; close_price?: number; remaining_lots?: number }>(
          `/positions/${id}/close`,
          body,
          { timeoutMs: 8_000 },
        );
        const pnl = res.profit ?? 0;
        const sign = pnl >= 0 ? '+' : '';
        pnl >= 0 ? sounds.profit() : sounds.loss();

        if (res.remaining_lots && res.remaining_lots > 0) {
          toast.success(`Partial @ ${res.close_price} | P&L: ${sign}$${pnl.toFixed(2)} | ${res.remaining_lots} lots left`);
        } else {
          toast.success(`Closed @ ${res.close_price} | P&L: ${sign}$${pnl.toFixed(2)}`);
        }
        Promise.all([refreshPositions(), refreshAccount(), loadHistory()]).catch(() => {});
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Close failed');
        // Restore position if close failed
        refreshPositions().catch(() => {});
      }
    })();
  };

  const executeBulkClose = async (type: BulkCloseType) => {
    setBulkConfirm(null);
    setBulkBusy(true);

    // Reconcile any optimistic rows (id prefix "optim-") into real server
    // UUIDs before sending the close batch. Calling /positions/optim-xxx/
    // close trips Pydantic's UUID validator. We force-refresh and poll the
    // store for up to ~3s; almost always the next refresh swaps the id.
    const pickTargets = () => {
      const fresh = useTradingStore.getState().positions;
      const filtered =
        type === 'profit'
          ? fresh.filter((p) => (p.profit || 0) > 0)
          : type === 'loss'
            ? fresh.filter((p) => (p.profit || 0) < 0)
            : fresh;
      return filtered;
    };

    let candidates = pickTargets();
    if (candidates.some((p) => p.id.startsWith('optim-'))) {
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline && candidates.some((p) => p.id.startsWith('optim-'))) {
        try {
          await refreshPositions();
        } catch {}
        candidates = pickTargets();
        if (candidates.every((p) => !p.id.startsWith('optim-'))) break;
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    const targets = candidates.filter((p) => !p.id.startsWith('optim-'));
    const stillUnsettled = candidates.length - targets.length;
    if (targets.length === 0) {
      toast(
        stillUnsettled > 0
          ? `${stillUnsettled} trade${stillUnsettled > 1 ? 's' : ''} still settling — try again in a moment`
          : type === 'profit'
            ? 'No profitable positions to close'
            : type === 'loss'
              ? 'No losing positions to close'
              : 'No open positions',
        { icon: 'ℹ️' },
      );
      setBulkBusy(false);
      return;
    }
    if (stillUnsettled > 0) {
      // We waited up to 3s for the server to acknowledge these and it
      // still hasn't — skip them this round so the rest can close.
      toast(`${stillUnsettled} trade${stillUnsettled > 1 ? 's' : ''} not yet acknowledged by the server — skipping`, { icon: '⏳' });
    }
    // Parallel close — each /positions/{id}/close acquires its own row lock,
    // so they can race safely. Sequential awaits were both slow AND let stale
    // store updates between calls drop trades that should have been closed.
    // Promise.allSettled keeps going on individual failures so one bad close
    // doesn't abandon the rest.
    const results = await Promise.allSettled(
      targets.map((pos) =>
        api
          .post<{ profit?: number; close_price?: number }>(`/positions/${pos.id}/close`, {})
          .then((res) => ({ id: pos.id, profit: res.profit ?? 0 })),
      ),
    );

    let closed = 0;
    let netProfit = 0;
    const errors: string[] = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        closed++;
        netProfit += r.value.profit;
        removePosition(r.value.id);
      } else {
        const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
        const sym = targets[i]?.symbol ?? 'position';
        errors.push(`${sym}: ${msg}`);
      }
    });
    if (closed > 0) (netProfit >= 0 ? sounds.profit() : sounds.loss());

    if (closed > 0) {
      toast.success(`${closed} position${closed > 1 ? 's' : ''} closed`);
    }
    if (errors.length > 0) {
      // Show one toast per distinct error message so the user actually sees
      // the backend's reason instead of an opaque "N failed" count.
      const unique = Array.from(new Set(errors));
      unique.slice(0, 3).forEach((m) => toast.error(m));
      if (unique.length > 3) toast.error(`+${unique.length - 3} more failures (see console)`);
      console.error('[bulk-close]', errors);
    }
    refreshPositions();
    refreshAccount();
    void loadHistory();
    setBulkBusy(false);
  };

  const saveSltpEdit = async () => {
    if (!sltpEdit) return;
    setSltpSaving(true);
    try {
      const body: Record<string, unknown> = {};
      const slVal = sltpEdit.sl.trim();
      const tpVal = sltpEdit.tp.trim();
      if (slVal !== '' && slVal !== '—') body.stop_loss = parseFloat(slVal);
      if (tpVal !== '' && tpVal !== '—') body.take_profit = parseFloat(tpVal);
      await api.put(`/positions/${sltpEdit.positionId}`, body);
      toast.success('SL/TP updated');
      setSltpEdit(null);
      refreshPositions();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update SL/TP');
    } finally {
      setSltpSaving(false);
    }
  };

  const handleRefresh = async () => {
    setToolbarBusy(true);
    try {
      if (activeTab === 'history') {
        await loadHistory();
        toast.success('History updated');
      } else {
        await refreshPositions();
        await refreshAccount();
        toast.success('Updated');
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Refresh failed');
    } finally {
      setToolbarBusy(false);
    }
  };

  const exportOpenCsv = () => {
    const rows: (string | number)[][] = [
      [
        'Account',
        'Symbol',
        'Side',
        'Qty',
        'Open Price',
        'Charges',
        'Current',
        'P&L',
        'SL',
        'TP',
      ],
    ];
    for (const pos of positions) {
      const d = getDigits(pos.symbol);
      const comm = pos.commission || 0;
      const gross = pos.profit || 0;
      rows.push([
        accountLabel(pos.account_id),
        pos.symbol,
        pos.side,
        pos.lots,
        pos.open_price.toFixed(d),
        comm.toFixed(2),
        (pos.current_price ?? '').toString() ? Number(pos.current_price).toFixed(d) : '',
        gross - comm,
        pos.stop_loss != null ? pos.stop_loss : '',
        pos.take_profit != null ? pos.take_profit : '',
      ]);
    }
    downloadCsv(`open-positions-${Date.now()}.csv`, rows);
    toast.success('CSV downloaded');
  };

  const exportPendingCsv = () => {
    const rows: (string | number)[][] = [
      ['Account', 'Symbol', 'Side', 'Type', 'Qty', 'Price', 'SL', 'TP'],
    ];
    for (const o of pendingOrders) {
      const d = getDigits(o.symbol);
      rows.push([
        accountLabel(o.account_id),
        o.symbol,
        o.side,
        o.order_type,
        o.lots,
        o.price.toFixed(d),
        o.stop_loss != null ? o.stop_loss : '',
        o.take_profit != null ? o.take_profit : '',
      ]);
    }
    downloadCsv(`pending-orders-${Date.now()}.csv`, rows);
    toast.success('CSV downloaded');
  };

  const exportHistoryCsv = () => {
    const rows: (string | number)[][] = [
      [
        'Symbol',
        'Side',
        'Qty',
        'Open Price',
        'Close Price',
        'P&L',
        'Close reason',
        'Closed At',
      ],
    ];
    for (const t of historyTrades) {
      const d = getDigits(t.symbol);
      const comm = t.commission || 0;
      const gross = t.pnl || 0;
      rows.push([
        t.symbol,
        t.side,
        t.lots,
        t.open_price.toFixed(d),
        t.close_price.toFixed(d),
        gross - comm,
        closeReasonBadge(t.close_reason, t.close_price, d).label,
        t.close_time,
      ]);
    }
    downloadCsv(`trade-history-${Date.now()}.csv`, rows);
    toast.success('CSV downloaded');
  };

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: 'open', label: 'Open', count: positions.length },
    { id: 'pending', label: 'Pending', count: pendingOrders.length },
    { id: 'history', label: 'History', count: historyTotal ?? historyTrades.length },
  ];

  const exportCurrentCsv = () => {
    if (activeTab === 'open') exportOpenCsv();
    else if (activeTab === 'pending') exportPendingCsv();
    else exportHistoryCsv();
  };

  const accountMetrics = activeAccount
    ? [
        { label: 'Balance', value: activeAccount.balance as number },
        { label: 'Equity', value: activeAccount.balance + (activeAccount.credit || 0) + totalPnl },
        { label: 'Credit', value: activeAccount.credit || 0 },
        { label: 'Used Margin', value: activeAccount.margin_used },
        {
          label: 'Free Margin',
          value: activeAccount.balance + (activeAccount.credit || 0) + totalPnl - activeAccount.margin_used,
          color: 'text-info' as const,
        },
        {
          label: 'Floating PL',
          value: netTotalPnl,
          color: netTotalPnl >= 0 ? 'text-buy' : 'text-sell',
          signed: true as const,
        },
      ]
    : [];


  const tabTitle = (id: TabId) =>
    id === 'open' ? 'Positions' : id === 'history' ? 'Closed Positions' : 'Pending';

  const equity =
    activeAccount != null
      ? activeAccount.balance + (activeAccount.credit || 0) + totalPnl
      : 0;
  const freeMarginCalc =
    activeAccount != null ? equity - activeAccount.margin_used : 0;
  const marginLevelDisplay =
    activeAccount != null && activeAccount.margin_level > 0
      ? `${activeAccount.margin_level % 1 === 0 ? activeAccount.margin_level.toFixed(0) : activeAccount.margin_level.toFixed(2)}%`
      : '—';

  const tabItems = tabs.map((t) => ({ id: t.id, label: isTerminal ? tabTitle(t.id) : t.label, count: t.count }));

  /** Header metric (terminal strip): eyebrow label over a mono value.
   *  Plain render helpers (not inline components) so React keeps the DOM
   *  between renders — an inline component type would remount every tick. */
  const renderMetric = ({ label, value, tone, icon }: { label: React.ReactNode; value: string; tone?: string; icon?: React.ReactNode }) => (
    <div className="flex flex-col items-end gap-0.5 shrink-0">
      <span className="text-xxs font-semibold uppercase tracking-wide text-text-tertiary leading-none inline-flex items-center gap-0.5">
        {label}
        {icon}
      </span>
      <span className={clsx('text-xs font-mono font-semibold tabular-nums leading-tight', tone ?? 'text-text-primary')}>
        {value}
      </span>
    </div>
  );

  /** SL / TP inline editor shared by the mobile cards and the desktop table.
   *  A render function, NOT a component: a component declared inside render
   *  gets a new identity each render, which would remount the inputs and
   *  drop focus on every keystroke. */
  const renderSltpEditor = (layout: 'row' | 'column') =>
    sltpEdit ? (
      <div className={clsx(layout === 'row' ? 'flex items-center gap-2 flex-wrap' : 'flex flex-col gap-1')}>
        <div className="flex items-center gap-1">
          <span className="text-text-tertiary w-5">SL:</span>
          <div className="w-20">
            <Input
              type="number"
              size="sm"
              numeric
              step="0.00001"
              value={sltpEdit.sl}
              onChange={(e) => setSltpEdit({ ...sltpEdit, sl: e.target.value })}
              placeholder="—"
              aria-label="Stop loss"
            />
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-text-tertiary w-5">TP:</span>
          <div className="w-20">
            <Input
              type="number"
              size="sm"
              numeric
              step="0.00001"
              value={sltpEdit.tp}
              onChange={(e) => setSltpEdit({ ...sltpEdit, tp: e.target.value })}
              placeholder="—"
              aria-label="Take profit"
            />
          </div>
        </div>
        <div className={clsx('flex gap-1', layout === 'column' && 'mt-0.5')}>
          <Button size="xs" iconOnly variant="buy" onClick={() => void saveSltpEdit()} disabled={sltpSaving} title="Save" aria-label="Save SL/TP">
            <Check className="w-3 h-3" aria-hidden />
          </Button>
          <Button size="xs" iconOnly variant="danger" onClick={() => setSltpEdit(null)} title="Cancel" aria-label="Cancel SL/TP edit">
            <X className="w-3 h-3" aria-hidden />
          </Button>
        </div>
      </div>
    ) : null;

  const cancelPendingOrder = async (orderId: string) => {
    try {
      await api.delete(`/orders/${orderId}`);
      toast.success('Order cancelled');
      void refreshPendingOrders();
      void refreshAccount();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const copyBadge = (
    <Badge variant="info" tone="outline" size="sm" title="Copy trade — only the Trade Master can close it">
      COPY
    </Badge>
  );

  return (
    <div className="h-full w-full min-w-0 flex flex-col min-h-0 bg-bg-base">
      {!isTerminal && activeAccount && (
        <div className="px-2 py-2 shrink-0 space-y-2 border-b border-border-primary bg-bg-secondary">
          <ActiveAccountBadge account={activeAccount} variant="compact" />
          <div className="flex flex-wrap gap-x-4 gap-y-1 items-center justify-between sm:justify-start text-xxs sm:text-xs">
            {accountMetrics.map((item) => (
              <div key={item.label} className="flex items-baseline gap-1.5 shrink-0">
                <span className="text-text-tertiary font-medium whitespace-nowrap">{item.label}</span>
                <span
                  className={clsx(
                    'font-bold tabular-nums font-mono whitespace-nowrap',
                    'color' in item && item.color ? item.color : 'text-text-primary',
                  )}
                >
                  {'signed' in item && item.signed && item.value >= 0 ? '+' : ''}
                  {item.value.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={clsx('flex-1 flex flex-col min-h-0 w-full min-w-0', isTerminal ? 'p-0' : 'p-1.5 sm:p-2')}>
        <div
          className={clsx(
            'flex flex-col flex-1 min-h-0 overflow-hidden w-full min-w-0',
            isTerminal
              ? 'rounded-none border-0 bg-transparent'
              : 'rounded-lg border border-border-primary bg-card',
          )}
        >
          {isTerminal ? (
            <div className="flex shrink-0 items-center justify-between gap-2 sm:gap-4 min-w-0 px-2 sm:px-3 py-1.5 border-b border-border-primary">
              <div className="flex items-center min-w-0 overflow-x-auto scrollbar-none no-scrollbar">
                <Tabs
                  variant="pills"
                  size="sm"
                  aria-label="Positions"
                  tabs={tabItems}
                  active={activeTab}
                  onChange={(id) => setActiveTab(id as TabId)}
                />
              </div>
              <div className="flex items-center gap-3 sm:gap-4 md:gap-5 shrink-0 min-w-0 overflow-x-auto scrollbar-none no-scrollbar">
                {activeAccount ? (
                  <>
                    {renderMetric({ label: 'Balance', value: `$${activeAccount.balance.toFixed(2)}` })}
                    {renderMetric({
                      label: <>Floating P&amp;L</>,
                      value: `${netTotalPnl >= 0 ? '+' : ''}$${netTotalPnl.toFixed(2)}`,
                      tone: pnlTone(netTotalPnl),
                    })}
                    {renderMetric({ label: 'Equity', value: `$${equity.toFixed(2)}` })}
                    {renderMetric({ label: 'Margin Used', value: `$${activeAccount.margin_used.toFixed(2)}` })}
                    {renderMetric({ label: 'Free Margin', value: `$${freeMarginCalc.toFixed(2)}` })}
                    {renderMetric({
                      label: 'Margin Level',
                      value: marginLevelDisplay,
                      icon: <Info className="w-3 h-3 text-text-tertiary" aria-label="Margin level info" />,
                    })}
                    {activeAccount.margin_used > 0 && (
                      <MarginRing
                        marginLevel={Number(activeAccount.margin_level) || 0}
                        size={56}
                        className="shrink-0"
                      />
                    )}
                  </>
                ) : null}
                {isTerminal && activeTab === 'open' && (
                  <div className="flex items-center gap-1 shrink-0 border-l border-border-primary ml-1 pl-2">
                    <Button
                      size="sm"
                      iconOnly
                      variant={terminalOpenCardView ? 'primary' : 'ghost'}
                      onClick={() => setTerminalOpenCardView((v) => !v)}
                      title={terminalOpenCardView ? 'Table view' : 'Card view'}
                      aria-label={terminalOpenCardView ? 'Switch to table view' : 'Switch to card view'}
                      aria-pressed={terminalOpenCardView}
                    >
                      {terminalOpenCardView ? (
                        <LayoutList className="w-4 h-4" strokeWidth={1.75} aria-hidden />
                      ) : (
                        <LayoutGrid className="w-4 h-4" strokeWidth={1.75} aria-hidden />
                      )}
                    </Button>
                  </div>
                )}
                <div className="flex items-center gap-0.5 shrink-0 ml-1 pl-1">
                  <Button
                    size="sm"
                    iconOnly
                    variant="ghost"
                    onClick={() => void handleRefresh()}
                    disabled={toolbarBusy || (activeTab === 'history' && historyLoading)}
                    title="Refresh"
                    aria-label="Refresh"
                  >
                    <RefreshCw className={clsx('w-4 h-4', toolbarBusy && 'animate-spin')} aria-hidden />
                  </Button>
                  <Button size="sm" iconOnly variant="ghost" onClick={exportCurrentCsv} title="Download CSV" aria-label="Download CSV">
                    <Download className="w-4 h-4" aria-hidden />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="shrink-0 bg-bg-secondary px-1 pt-1">
                <Tabs
                  variant="underline"
                  size="sm"
                  fullWidth
                  aria-label="Positions"
                  tabs={tabItems}
                  active={activeTab}
                  onChange={(id) => setActiveTab(id as TabId)}
                />
              </div>

              <div className="flex items-center justify-between gap-2 px-2 py-1.5 shrink-0 border-b border-border-primary bg-bg-secondary">
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => void handleRefresh()}
                  disabled={toolbarBusy || (activeTab === 'history' && historyLoading)}
                  leftIcon={<RefreshCw className={clsx('w-3.5 h-3.5', toolbarBusy && 'animate-spin')} aria-hidden />}
                >
                  Refresh
                </Button>
                <Button size="xs" variant="ghost" onClick={exportCurrentCsv} leftIcon={<Download className="w-3.5 h-3.5" aria-hidden />}>
                  Download CSV
                </Button>
              </div>
            </>
          )}

          <div className="flex-1 overflow-auto min-h-0 flex flex-col w-full min-w-0">
            {activeTab === 'open' && (
              <div className="min-w-0 w-full flex-1 flex flex-col min-h-0">
                {isTerminal && terminalOpenCardView ? (
                  <div className="flex-1 overflow-y-auto min-h-0 p-2 sm:p-3">
                    {positions.length === 0 ? (
                      <EmptyState compact title="No open positions" />
                    ) : (
                      <div className="flex flex-wrap gap-2 content-start items-start">
                        {positions.map((pos) => {
                          const d = getDigits(pos.symbol);
                          const lev = activeAccount?.leverage ?? 100;
                          const m = estimatePositionMargin(pos, instruments, lev);
                          const inst = instruments.find((i) => i.symbol === pos.symbol);
                          const notional =
                            inst != null ? pos.lots * inst.contract_size * pos.open_price : null;
                          const marginExposureLine =
                            m != null && notional != null
                              ? `$${m.toFixed(2)} / $${notional.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                              : notional != null
                                ? `— / $${notional.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                                : '— / —';
                          const swapsFeeLine =
                            pos.swap === 0
                              ? `— / $${pos.commission.toFixed(2)}`
                              : `$${pos.swap.toFixed(2)} / $${pos.commission.toFixed(2)}`;

                          return (
                            <TerminalPositionStaticCard
                              key={pos.id}
                              pos={pos}
                              digits={d}
                              marginExposureLine={marginExposureLine}
                              swapsFeeLine={swapsFeeLine}
                              onCloseFull={() =>
                                setCloseModal({
                                  id: pos.id,
                                  symbol: pos.symbol,
                                  side: pos.side,
                                  lots: pos.lots,
                                  closeLots: String(pos.lots),
                                  selectedPct: 100,
                                })
                              }
                              onPartialClose={() => {
                                const partLots = partitionCloneLots(pos, instruments);
                                if (partLots >= pos.lots - 1e-12) {
                                  toast.error('Position too small for partial close');
                                  return;
                                }
                                setCloseModal({
                                  id: pos.id,
                                  symbol: pos.symbol,
                                  side: pos.side,
                                  lots: pos.lots,
                                  closeLots: String(partLots),
                                  selectedPct: null,
                                });
                              }}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                {/* Mobile card layout */}
                <div className="md:hidden flex-1 overflow-y-auto space-y-2 p-2">
                  {positions.length === 0 ? (
                    <EmptyState compact title="No open positions" />
                  ) : (
                    positions.map((pos) => {
                      const d = getDigits(pos.symbol);
                      const net = netPnl(pos);
                      return (
                        <Card key={pos.id} padding="sm" className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-text-primary font-mono">{pos.symbol}</span>
                              <SideBadge side={pos.side} />
                              <TradeTypeBadge tradeType={pos.trade_type} />
                            </div>
                            <span className={clsx('font-mono text-sm font-bold tabular-nums', pnlTone(net))}>
                              {net >= 0 ? '+' : ''}${net.toFixed(2)}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
                            <div><span className="text-text-tertiary">Qty</span> <span className="text-text-primary font-mono tabular-nums">{pos.lots}</span></div>
                            <div><span className="text-text-tertiary">Open</span> <span className="text-text-primary font-mono tabular-nums">{pos.open_price.toFixed(d)}</span></div>
                            <div><span className="text-text-tertiary">Now</span> <span className="text-text-primary font-mono tabular-nums">{pos.current_price != null ? pos.current_price.toFixed(d) : '—'}</span></div>
                            <div><span className="text-text-tertiary">Acct</span> <span className="text-text-secondary">{accountLabel(pos.account_id)}</span></div>
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t border-border-secondary">
                            <div className="text-xxs">
                              {sltpEdit && sltpEdit.positionId === pos.id ? (
                                renderSltpEditor('row')
                              ) : (
                                <button type="button" onClick={() => setSltpEdit({ positionId: pos.id, sl: pos.stop_loss != null ? pos.stop_loss.toFixed(d) : '', tp: pos.take_profit != null ? pos.take_profit.toFixed(d) : '' })} className="text-text-tertiary active:text-text-secondary font-mono tabular-nums">
                                  SL: {pos.stop_loss != null ? pos.stop_loss.toFixed(d) : '—'} · TP: {pos.take_profit != null ? pos.take_profit.toFixed(d) : '—'}
                                  <Pencil className="w-2.5 h-2.5 inline ml-1 opacity-60" aria-hidden />
                                </button>
                              )}
                            </div>
                            <div className="inline-flex items-center gap-2">
                              <Button size="sm" iconOnly variant="ghost" onClick={() => setSharePosition(pos)} aria-label="Share trade">
                                <Share2 className="w-4 h-4" aria-hidden />
                              </Button>
                              {pos.trade_type === 'copy_trade' ? (
                                copyBadge
                              ) : (
                                <Button size="sm" variant="danger" className="uppercase" onClick={() => setCloseModal({ id: pos.id, symbol: pos.symbol, side: pos.side, lots: pos.lots, closeLots: String(pos.lots), selectedPct: 100 })}>
                                  Close
                                </Button>
                              )}
                            </div>
                          </div>
                        </Card>
                      );
                    })
                  )}
                </div>
                {/* Desktop table layout — block + full width so table aligns left, not centered in flex */}
                <div className="hidden md:block w-full min-w-0 flex-1 overflow-x-auto">
                  <Table dense className="min-w-[940px]">
                    <THead>
                      <TR>
                        <TH>Account</TH>
                        <TH>Symbol</TH>
                        <TH>Type</TH>
                        <TH>Side</TH>
                        <TH align="right">Qty</TH>
                        <TH align="right">Open</TH>
                        <TH align="right">Charges</TH>
                        <TH align="right">Current</TH>
                        <TH align="right">P&amp;L</TH>
                        <TH>SL / TP</TH>
                        <TH align="right">Action</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {positions.map((pos) => {
                        const d = getDigits(pos.symbol);
                        const charges = pos.commission || 0;
                        const net = netPnl(pos);
                        return (
                          <TR key={pos.id} interactive>
                            <TD muted>{accountLabel(pos.account_id)}</TD>
                            <TD className="font-bold font-mono">{pos.symbol}</TD>
                            <TD><TradeTypeBadge tradeType={pos.trade_type} /></TD>
                            <TD><SideBadge side={pos.side} /></TD>
                            <TD numeric>{pos.lots}</TD>
                            <TD numeric>{pos.open_price.toFixed(d)}</TD>
                            <TD numeric muted title="Commission charged by the broker on this position">
                              {charges > 0 ? `-$${charges.toFixed(2)}` : '—'}
                            </TD>
                            <TD numeric>{pos.current_price != null ? pos.current_price.toFixed(d) : '—'}</TD>
                            <TD numeric className={clsx('font-bold', pnlTone(net))}>
                              {net >= 0 ? '+' : ''}${net.toFixed(2)}
                            </TD>
                            <TD className="text-xxs">
                              {sltpEdit && sltpEdit.positionId === pos.id ? (
                                renderSltpEditor('column')
                              ) : (
                                <div className="flex flex-wrap gap-1.5 items-center">
                                  {pos.stop_loss != null ? (
                                    <button
                                      type="button"
                                      onClick={() => setSltpEdit({
                                        positionId: pos.id,
                                        sl: pos.stop_loss != null ? pos.stop_loss.toFixed(d) : '',
                                        tp: pos.take_profit != null ? pos.take_profit.toFixed(d) : '',
                                      })}
                                      className="text-left group inline-flex items-center gap-1 cursor-pointer"
                                      title="Click to edit Stop Loss"
                                    >
                                      <span className="text-danger font-mono tabular-nums">SL: {pos.stop_loss.toFixed(d)}</span>
                                      <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60 text-text-tertiary transition-opacity" aria-hidden />
                                    </button>
                                  ) : (
                                    <Button
                                      size="xs"
                                      variant="danger"
                                      className="uppercase tracking-wide"
                                      onClick={() => setSltpEdit({
                                        positionId: pos.id,
                                        sl: '',
                                        tp: pos.take_profit != null ? pos.take_profit.toFixed(d) : '',
                                      })}
                                      title="Add Stop Loss"
                                      leftIcon={<Plus className="w-2.5 h-2.5" aria-hidden />}
                                    >
                                      SL
                                    </Button>
                                  )}
                                  {pos.take_profit != null ? (
                                    <button
                                      type="button"
                                      onClick={() => setSltpEdit({
                                        positionId: pos.id,
                                        sl: pos.stop_loss != null ? pos.stop_loss.toFixed(d) : '',
                                        tp: pos.take_profit != null ? pos.take_profit.toFixed(d) : '',
                                      })}
                                      className="text-left group inline-flex items-center gap-1 cursor-pointer"
                                      title="Click to edit Take Profit"
                                    >
                                      <span className="text-success font-mono tabular-nums">TP: {pos.take_profit.toFixed(d)}</span>
                                      <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60 text-text-tertiary transition-opacity" aria-hidden />
                                    </button>
                                  ) : (
                                    <Button
                                      size="xs"
                                      variant="outline"
                                      className="uppercase tracking-wide !text-success !border-success/25 !bg-success/10 hover:!bg-success/20"
                                      onClick={() => setSltpEdit({
                                        positionId: pos.id,
                                        sl: pos.stop_loss != null ? pos.stop_loss.toFixed(d) : '',
                                        tp: '',
                                      })}
                                      title="Add Take Profit"
                                      leftIcon={<Plus className="w-2.5 h-2.5" aria-hidden />}
                                    >
                                      TP
                                    </Button>
                                  )}
                                </div>
                              )}
                            </TD>
                            <TD align="right">
                              <div className="inline-flex items-center gap-1.5">
                                <Button size="xs" iconOnly variant="ghost" onClick={() => setSharePosition(pos)} title="Share trade" aria-label="Share trade">
                                  <Share2 className="w-3.5 h-3.5" aria-hidden />
                                </Button>
                                {pos.trade_type === 'copy_trade' ? (
                                  copyBadge
                                ) : (
                                  <Button
                                    size="xs"
                                    variant="danger"
                                    className="uppercase"
                                    onClick={() =>
                                      setCloseModal({
                                        id: pos.id,
                                        symbol: pos.symbol,
                                        side: pos.side,
                                        lots: pos.lots,
                                        closeLots: String(pos.lots),
                                        selectedPct: 100,
                                      })
                                    }
                                  >
                                    Close
                                  </Button>
                                )}
                              </div>
                            </TD>
                          </TR>
                        );
                      })}
                      {positions.length === 0 && (
                        <TR>
                          <TD colSpan={11} className="!whitespace-normal">
                            <EmptyState compact title="No open positions" />
                          </TD>
                        </TR>
                      )}
                    </TBody>
                  </Table>
                </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'pending' && (
              <div className="min-w-0 w-full flex-1 flex flex-col min-h-0">
                {/* Mobile card layout */}
                <div className="md:hidden flex-1 overflow-y-auto space-y-2 p-2">
                  {pendingOrders.length === 0 ? (
                    <EmptyState compact title="No pending orders" />
                  ) : (
                    pendingOrders.map((order) => {
                      const d = getDigits(order.symbol);
                      return (
                        <Card key={order.id} padding="sm" className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-text-primary font-mono">{order.symbol}</span>
                              <SideBadge side={order.side} />
                              <span className="text-xxs text-text-tertiary">{order.order_type.replace(/_/g, ' ')}</span>
                            </div>
                            <span className="text-xs font-mono font-semibold text-text-primary tabular-nums">@ {order.price.toFixed(d)}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
                            <div><span className="text-text-tertiary">Qty</span> <span className="text-text-primary font-mono tabular-nums">{order.lots}</span></div>
                            <div><span className="text-text-tertiary">SL</span> <span className="text-text-secondary font-mono tabular-nums">{order.stop_loss != null ? order.stop_loss.toFixed(d) : '—'}</span></div>
                            <div><span className="text-text-tertiary">TP</span> <span className="text-text-secondary font-mono tabular-nums">{order.take_profit != null ? order.take_profit.toFixed(d) : '—'}</span></div>
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t border-border-secondary">
                            <span className="text-xxs text-text-tertiary">{accountLabel(order.account_id)}</span>
                            <Button size="sm" variant="danger" className="uppercase" onClick={() => void cancelPendingOrder(order.id)}>
                              Cancel
                            </Button>
                          </div>
                        </Card>
                      );
                    })
                  )}
                </div>
                {/* Desktop table layout */}
                <div className="hidden md:block w-full min-w-0 flex-1 overflow-x-auto">
                  <Table dense className="min-w-[560px]">
                    <THead>
                      <TR>
                        <TH>Account</TH>
                        <TH>Symbol</TH>
                        <TH>Side</TH>
                        <TH>Type</TH>
                        <TH align="right">Qty</TH>
                        <TH align="right">Price</TH>
                        <TH>SL / TP</TH>
                        <TH align="right">Action</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {pendingOrders.map((order) => {
                        const d = getDigits(order.symbol);
                        return (
                          <TR key={order.id} interactive>
                            <TD muted>{accountLabel(order.account_id)}</TD>
                            <TD className="font-bold font-mono">{order.symbol}</TD>
                            <TD><SideBadge side={order.side} /></TD>
                            <TD muted className="capitalize">{order.order_type.replace(/_/g, ' ')}</TD>
                            <TD numeric>{order.lots}</TD>
                            <TD numeric>{order.price.toFixed(d)}</TD>
                            <TD muted className="text-xxs font-mono tabular-nums">
                              SL: {order.stop_loss != null ? order.stop_loss.toFixed(d) : '—'}
                              <br />
                              TP: {order.take_profit != null ? order.take_profit.toFixed(d) : '—'}
                            </TD>
                            <TD align="right">
                              <Button size="xs" variant="danger" className="uppercase" onClick={() => void cancelPendingOrder(order.id)}>
                                Cancel
                              </Button>
                            </TD>
                          </TR>
                        );
                      })}
                      {pendingOrders.length === 0 && (
                        <TR>
                          <TD colSpan={8} className="!whitespace-normal">
                            <EmptyState compact title="No pending orders" />
                          </TD>
                        </TR>
                      )}
                    </TBody>
                  </Table>
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="min-w-0 w-full flex-1 flex flex-col min-h-0 overflow-hidden">
                {historyLoading ? (
                  <div className="p-3 space-y-2 flex-1 min-h-[120px]" aria-busy aria-label="Loading history">
                    <Skeleton className="h-7 w-full" />
                    <Skeleton className="h-7 w-full" />
                    <Skeleton className="h-7 w-5/6" />
                  </div>
                ) : (
                  <>
                  {/* Mobile card layout */}
                  <div className="md:hidden flex-1 overflow-y-auto space-y-2 p-2">
                    {historyTrades.length === 0 ? (
                      <EmptyState compact title="No trade history" />
                    ) : (
                      historyTrades.map((trade) => {
                        const d = getDigits(trade.symbol);
                        const pnl = trade.pnl || 0;
                        const charges = trade.commission || 0;
                        const net = pnl - charges + (trade.swap || 0);
                        const exitBadge = closeReasonBadge(trade.close_reason, trade.close_price, d);
                        // Re-use the same Position shape that ShareTradeModal
                        // expects so a closed trade can be shared from this
                        // card too. Open positions had a share button on
                        // mobile but history rows didn't — feature parity.
                        const sharePos: Position = {
                          id: trade.id,
                          account_id: '',
                          symbol: trade.symbol,
                          side: trade.side as 'buy' | 'sell',
                          lots: trade.lots,
                          open_price: trade.open_price,
                          current_price: trade.close_price,
                          stop_loss: trade.stop_loss ?? undefined,
                          take_profit: trade.take_profit ?? undefined,
                          swap: 0,
                          commission: trade.commission || 0,
                          profit: trade.pnl || 0,
                          trade_type: trade.trade_type,
                          created_at: trade.close_time,
                        };
                        return (
                          <Card key={trade.id} padding="sm" className="space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-text-primary font-mono">{trade.symbol}</span>
                                <SideBadge side={trade.side} />
                                <TradeTypeBadge tradeType={trade.trade_type} />
                              </div>
                              <div className="inline-flex items-center gap-2">
                                <Button size="sm" iconOnly variant="ghost" onClick={() => setSharePosition(sharePos)} aria-label="Share trade">
                                  <Share2 className="w-4 h-4" aria-hidden />
                                </Button>
                                <span className={clsx('font-mono text-sm font-bold tabular-nums', pnlTone(net))}>
                                  {net >= 0 ? '+' : ''}${net.toFixed(2)}
                                </span>
                              </div>
                            </div>
                            <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
                              <div><span className="text-text-tertiary">Qty</span> <span className="text-text-primary font-mono tabular-nums">{trade.lots}</span></div>
                              <div><span className="text-text-tertiary">Open</span> <span className="text-text-primary font-mono tabular-nums">{trade.open_price.toFixed(d)}</span></div>
                              <div><span className="text-text-tertiary">Close</span> <span className="text-text-primary font-mono tabular-nums">{trade.close_price.toFixed(d)}</span></div>
                              <div>
                                <span className="text-text-tertiary">SL</span>{' '}
                                <span className={clsx('font-mono tabular-nums', trade.stop_loss != null ? 'text-danger' : 'text-text-tertiary')}>
                                  {trade.stop_loss != null ? trade.stop_loss.toFixed(d) : '—'}
                                </span>
                              </div>
                              <div>
                                <span className="text-text-tertiary">TP</span>{' '}
                                <span className={clsx('font-mono tabular-nums', trade.take_profit != null ? 'text-success' : 'text-text-tertiary')}>
                                  {trade.take_profit != null ? trade.take_profit.toFixed(d) : '—'}
                                </span>
                              </div>
                              <div>
                                <Badge variant={exitBadge.variant} size="sm" className="normal-case tracking-normal">{exitBadge.label}</Badge>
                              </div>
                            </div>
                            <div className="text-xxs text-text-tertiary pt-1 border-t border-border-secondary">
                              {new Date(trade.close_time).toLocaleString()}
                            </div>
                          </Card>
                        );
                      })
                    )}
                  </div>
                  {/* Desktop table layout */}
                  <div className="hidden md:block w-full min-w-0 overflow-auto flex-1 min-h-0">
                  <Table dense className="min-w-[1020px]">
                    <THead>
                      <TR>
                        <TH>Symbol</TH>
                        <TH>Type</TH>
                        <TH>Side</TH>
                        <TH align="right">Qty</TH>
                        <TH align="right">Open</TH>
                        <TH align="right">Close</TH>
                        <TH align="right">SL</TH>
                        <TH align="right">TP</TH>
                        <TH align="right">P&amp;L</TH>
                        <TH>Reason</TH>
                        <TH>Closed</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {historyTrades.map((trade) => {
                        const d = getDigits(trade.symbol);
                        const pnl = trade.pnl || 0;
                        const charges = trade.commission || 0;
                        const net = pnl - charges + (trade.swap || 0);
                        const exitBadge = closeReasonBadge(trade.close_reason, trade.close_price, d);
                        return (
                          <TR key={trade.id} interactive>
                            <TD className="font-bold font-mono">{trade.symbol}</TD>
                            <TD><TradeTypeBadge tradeType={trade.trade_type} /></TD>
                            <TD><SideBadge side={trade.side} /></TD>
                            <TD numeric>{trade.lots}</TD>
                            <TD numeric>{trade.open_price.toFixed(d)}</TD>
                            <TD numeric>{trade.close_price.toFixed(d)}</TD>
                            <TD numeric className={trade.stop_loss != null ? 'text-danger' : 'text-text-tertiary'}>
                              {trade.stop_loss != null ? trade.stop_loss.toFixed(d) : '—'}
                            </TD>
                            <TD numeric className={trade.take_profit != null ? 'text-success' : 'text-text-tertiary'}>
                              {trade.take_profit != null ? trade.take_profit.toFixed(d) : '—'}
                            </TD>
                            <TD numeric className={clsx('font-bold', pnlTone(net))}>
                              {net >= 0 ? '+' : ''}${net.toFixed(2)}
                            </TD>
                            <TD>
                              <Badge variant={exitBadge.variant} size="sm" className="normal-case tracking-normal">{exitBadge.label}</Badge>
                            </TD>
                            <TD muted className="text-xxs">{new Date(trade.close_time).toLocaleString()}</TD>
                          </TR>
                        );
                      })}
                      {historyTrades.length === 0 && (
                        <TR>
                          <TD colSpan={11} className="!whitespace-normal">
                            <EmptyState compact title="No trade history" />
                          </TD>
                        </TR>
                      )}
                    </TBody>
                  </Table>
                  </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {bulkConfirm &&
        typeof document !== 'undefined' &&
        createPortal(
          (() => {
            const countMap = { all: positions.length, profit: profitPositions.length, loss: lossPositions.length };
            const labelMap = {
              all: 'Close All Positions',
              profit: 'Close Profitable Positions',
              loss: 'Close Losing Positions',
            };
            const descMap = {
              all: `Close all ${positions.length} open position${positions.length !== 1 ? 's' : ''} at market price.`,
              profit: `Close ${profitPositions.length} profitable position${profitPositions.length !== 1 ? 's' : ''} at market price.`,
              loss: `Close ${lossPositions.length} losing position${lossPositions.length !== 1 ? 's' : ''} at market price.`,
            };
            const count = countMap[bulkConfirm];
            return (
              <div className="fixed inset-0 p-0" style={{ zIndex: 2147483646, isolation: 'isolate' }}>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label="Dismiss"
                  className="absolute inset-0 z-0 m-0 h-full w-full cursor-default border-0 bg-bg-overlay p-0"
                  onClick={() => setBulkConfirm(null)}
                />
                <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="bulk-close-title"
                    className="relative w-full max-w-[280px] rounded-sheet border border-border-primary bg-card p-3.5 shadow-lg overflow-hidden pointer-events-auto"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <h3 id="bulk-close-title" className="text-sm font-bold pr-2 text-text-primary">
                      {labelMap[bulkConfirm]}
                    </h3>
                    <Button
                      size="xs"
                      iconOnly
                      variant="ghost"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setBulkConfirm(null);
                      }}
                      aria-label="Close"
                    >
                      <X className="w-4 h-4" strokeWidth={2.5} aria-hidden />
                    </Button>
                  </div>
                  <p className="text-xs text-text-secondary mb-2">{descMap[bulkConfirm]}</p>
                  {count === 0 ? (
                    <>
                      <p className="text-xs mb-3 text-text-tertiary">
                        No matching positions found.
                      </p>
                      <Button variant="secondary" size="sm" fullWidth onClick={() => setBulkConfirm(null)}>
                        OK
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-xs mb-4 text-text-tertiary">
                        This action cannot be undone.
                      </p>
                      <div className="flex gap-2">
                        <Button variant="secondary" size="sm" fullWidth onClick={() => setBulkConfirm(null)}>
                          Cancel
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          fullWidth
                          onClick={() => void executeBulkClose(bulkConfirm)}
                          disabled={bulkBusy}
                        >
                          {bulkBusy ? 'Closing…' : 'Confirm'}
                        </Button>
                      </div>
                    </>
                  )}
                  </div>
                </div>
              </div>
            );
          })(),
          document.body,
        )}

      {closeModal &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 p-0" style={{ zIndex: 2147483646, isolation: 'isolate' }}>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Dismiss"
              className="absolute inset-0 z-0 m-0 h-full w-full cursor-default border-0 bg-bg-overlay p-0"
              onClick={() => { if (!closeSubmitting) setCloseModal(null); }}
            />
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="close-position-title"
                className="pointer-events-auto relative w-full max-w-[420px] rounded-sheet border border-border-primary bg-card p-3.5 shadow-lg overflow-hidden"
                onMouseDown={(e) => e.stopPropagation()}
              >
              <div className="flex items-start justify-between gap-2 mb-3">
                <h3 id="close-position-title" className="text-sm font-bold text-text-primary">
                  Close Position
                </h3>
                <Button
                  size="xs"
                  iconOnly
                  variant="ghost"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setCloseModal(null);
                  }}
                  aria-label="Close dialog"
                >
                  <X className="w-4 h-4" strokeWidth={2.5} aria-hidden />
                </Button>
              </div>

              <div className="space-y-3">
                <div className="rounded-lg p-3 space-y-1.5 border bg-bg-secondary border-border-primary">
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-text-secondary">Symbol</span>
                    <span className="font-mono text-text-primary">{closeModal.symbol}</span>
                  </div>
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-text-secondary">Side</span>
                    <SideBadge side={closeModal.side} />
                  </div>
                  <div className="flex justify-between text-xs font-medium">
                    <span className="text-text-secondary">Open lots</span>
                    <span className="font-mono text-text-primary tabular-nums">{closeModal.lots}</span>
                  </div>
                  {(() => {
                    // Live P/L for the position being closed. Looked up by id
                    // every render so the row tracks the same price feed the
                    // positions list does — closing a trade should never show
                    // a stale number to the user about to commit.
                    const pos = positions.find((p) => p.id === closeModal.id);
                    const pnl = pos?.profit ?? 0;
                    const charges = pos?.commission ?? 0;
                    const net = pnl - charges + (pos?.swap ?? 0);
                    return (
                      <div className="flex justify-between text-xs font-medium pt-1.5 mt-1.5 border-t border-border-secondary">
                        <span className="text-text-secondary">P&amp;L</span>
                        <span className={clsx('font-mono font-bold tabular-nums', pnlTone(net))}>
                          {net >= 0 ? '+' : ''}${net.toFixed(2)}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                <div>
                  <label htmlFor="close-position-lots" className="text-xxs font-bold uppercase tracking-[0.12em] block mb-1.5 text-text-tertiary">
                    Lots to close
                  </label>
                  {/* Per-percentage chips. We always let the user click any
                      chip and always show the corresponding partial P&L —
                      even for a 0.01-lot trade where the broker can't
                      physically split the lot, the trader can still see
                      what 25%/50%/75% of the current P&L *would* be. If the
                      lot snap forces a full close we surface that as a note
                      below the input so the trader knows what'll actually
                      happen when they hit Close. */}
                  <Segmented
                    fullWidth
                    size="xs"
                    aria-label="Lots to close"
                    className="mb-2"
                    value={closeModal.selectedPct != null ? String(closeModal.selectedPct) : ''}
                    onChange={(v) => {
                      if (v === '100') {
                        setCloseModal((m) =>
                          m ? { ...m, closeLots: formatLotsInput(m.lots), selectedPct: 100 } : m,
                        );
                        return;
                      }
                      const pct = Number(v) as 25 | 50 | 75;
                      const snapped = snapLotsForCloseFraction(closeModal.lots, closeModal.symbol, instruments, pct / 100);
                      setCloseModal((m) =>
                        m ? { ...m, closeLots: formatLotsInput(snapped), selectedPct: pct } : m,
                      );
                    }}
                    options={[
                      { value: '25', label: '25%' },
                      { value: '50', label: '50%' },
                      { value: '75', label: '75%' },
                      { value: '100', label: 'Full' },
                    ]}
                  />
                  <Input
                    id="close-position-lots"
                    type="number"
                    size="md"
                    numeric
                    step="0.01"
                    min="0.01"
                    max={closeModal.lots}
                    value={closeModal.closeLots}
                    onChange={(e) => setCloseModal({ ...closeModal, closeLots: e.target.value, selectedPct: null })}
                  />
                  {(() => {
                    // Estimated P&L for the chosen close size. When a chip is
                    // selected we honor the *requested* percentage (so the
                    // trader sees 25% of P/L when they clicked 25%, even if
                    // the actual broker-side close has to round up to the
                    // minimum lot). When no chip is selected we fall back to
                    // closeLots/openLots from the manual input.
                    const pos = positions.find((p) => p.id === closeModal.id);
                    if (!pos) return null;
                    const closeLotsNum = parseFloat(closeModal.closeLots);
                    let frac: number;
                    if (closeModal.selectedPct != null) {
                      frac = closeModal.selectedPct / 100;
                    } else if (Number.isFinite(closeLotsNum) && closeLotsNum > 0 && closeModal.lots > 0) {
                      frac = Math.min(1, closeLotsNum / closeModal.lots);
                    } else {
                      return null;
                    }
                    const partPnl = (pos.profit ?? 0) * frac;
                    const partCharges = (pos.commission ?? 0) * frac;
                    const net = partPnl - partCharges + (pos.swap ?? 0) * frac;
                    const pct = Math.round(frac * 100);
                    // Will the broker actually close less than the full lot?
                    const willClose = Number.isFinite(closeLotsNum) && closeLotsNum > 0
                      ? Math.min(closeLotsNum, closeModal.lots)
                      : closeModal.lots;
                    const forcedFull = pct < 100 && willClose >= closeModal.lots - 1e-9;
                    return (
                      <>
                        <div className="mt-2 flex items-center justify-between px-3 py-2 rounded-md bg-bg-secondary border border-border-primary">
                          <span className="text-xxs font-semibold uppercase tracking-[0.12em] text-text-tertiary">
                            Est. P&amp;L {pct < 100 ? `(${pct}%)` : ''}
                          </span>
                          <span className={clsx('font-mono text-sm font-bold tabular-nums', pnlTone(net))}>
                            {net >= 0 ? '+' : ''}${net.toFixed(2)}
                          </span>
                        </div>
                        {forcedFull && (
                          <p className="mt-1.5 text-xxs text-text-tertiary leading-tight">
                            Lot size too small to partial-close — Close will exit the full position.
                          </p>
                        )}
                      </>
                    );
                  })()}
                </div>

                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" fullWidth onClick={() => setCloseModal(null)}>
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    fullWidth
                    loading={closeSubmitting}
                    onClick={() => {
                      const cl = parseFloat(closeModal.closeLots);
                      if (Number.isNaN(cl) || cl <= 0) {
                        toast.error('Invalid lots');
                        return;
                      }
                      if (cl > closeModal.lots + 1e-9) {
                        toast.error(`Cannot exceed ${closeModal.lots} lots`);
                        return;
                      }
                      closePosition(closeModal.id, cl < closeModal.lots - 1e-9 ? cl : undefined);
                    }}
                  >
                    {closeSubmitting ? 'Closing…' : 'Close'}
                  </Button>
                </div>

                <div className="pt-3 mt-1 border-t border-border-primary">
                  <p className="text-xxs font-semibold uppercase tracking-[0.12em] text-center mb-2 text-text-tertiary">
                    Bulk close
                  </p>
                  {/* Stacked icon / label / count tiles — no primitive has
                      this layout, so they stay raw buttons on token utilities. */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setCloseModal(null);
                        setBulkConfirm('all');
                      }}
                      disabled={bulkBusy || positions.length === 0}
                      className="flex flex-col items-center gap-0.5 py-2 px-0.5 rounded-md border transition-colors active:translate-y-px disabled:opacity-40 disabled:pointer-events-none bg-bg-secondary border-border-primary hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
                    >
                      <Layers className="w-3.5 h-3.5 text-text-secondary" aria-hidden />
                      <span className="text-xxs font-bold text-text-primary">All</span>
                      <span className="text-xxs tabular-nums text-text-tertiary">
                        ({positions.length})
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCloseModal(null);
                        setBulkConfirm('profit');
                      }}
                      disabled={bulkBusy || profitPositions.length === 0}
                      className="flex flex-col items-center gap-0.5 py-2 px-0.5 rounded-md border transition-colors active:translate-y-px disabled:opacity-40 disabled:pointer-events-none bg-success/5 border-success/20 hover:bg-success/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
                    >
                      <TrendingUp className="w-3.5 h-3.5 text-success" aria-hidden />
                      <span className="text-xxs font-bold text-success">
                        Profit
                      </span>
                      <span className="text-xxs tabular-nums text-text-tertiary">
                        ({profitPositions.length})
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCloseModal(null);
                        setBulkConfirm('loss');
                      }}
                      disabled={bulkBusy || lossPositions.length === 0}
                      className="flex flex-col items-center gap-0.5 py-2 px-0.5 rounded-md border transition-colors active:translate-y-px disabled:opacity-40 disabled:pointer-events-none bg-danger/5 border-danger/20 hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45"
                    >
                      <TrendingDown className="w-3.5 h-3.5 text-danger" aria-hidden />
                      <span className="text-xxs font-bold text-danger">
                        Loss
                      </span>
                      <span className="text-xxs tabular-nums text-text-tertiary">
                        ({lossPositions.length})
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>,
          document.body,
        )}

      {sharePosition && (
        <ShareTradeModal
          open={!!sharePosition}
          onClose={() => setSharePosition(null)}
          position={sharePosition}
          leverage={Number(activeAccount?.leverage) || 100}
        />
      )}
    </div>
  );
}
