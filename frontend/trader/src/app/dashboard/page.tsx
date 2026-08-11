'use client';

/**
 * Overview — dashboard content only. All chrome (navbar, ticker, theme,
 * fonts) comes from DashboardShell; every color comes from the `.desk`
 * token block in globals.css. No hex, no headers, no nav here.
 *
 * Order: context strip → hero (equity chart | margin gauge) → 5-KPI
 * strip → body (positions + activity | order ticket + watchlist).
 */

import { useEffect, useRef, useState } from 'react';
import { Inbox } from 'lucide-react';
import api from '@/lib/api/client';
import DashboardShell, { useDesk, type DeskAccount, type DeskTick } from '@/components/layout/DashboardShell';

/* ── shared helpers ─────────────────────────────────────────────────── */
const usd = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const px = (n: number) =>
  n >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : n >= 100 ? n.toFixed(3) : n.toFixed(5);

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(m.matches);
    const fn = () => setReduced(m.matches);
    m.addEventListener('change', fn);
    return () => m.removeEventListener('change', fn);
  }, []);
  return reduced;
}

/** Count up from 0 on first render, then ease smoothly on live updates. */
function useAnimatedNumber(target: number, reduced: boolean) {
  const [shown, setShown] = useState(0);
  const first = useRef(true);
  const from = useRef(0);
  useEffect(() => {
    if (reduced) { setShown(target); first.current = false; return; }
    const start = first.current ? 0 : from.current;
    const dur = first.current ? 900 : 350;
    first.current = false;
    const t0 = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const v = start + (target - start) * (1 - Math.pow(1 - p, 3));
      setShown(v);
      from.current = v;
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, reduced]);
  return shown;
}

interface PositionRow { id: string; symbol: string; side: string; lots: number; open_price: number; profit: number }
interface ActivityRow { id: string; type: string; amount: number; created_at: string; description?: string }

const TIMEFRAMES = ['1D', '1W', '1M', '3M', 'ALL'] as const;
type Timeframe = (typeof TIMEFRAMES)[number];
const TF_MS: Record<Timeframe, number> = { '1D': 864e5, '1W': 6048e5, '1M': 2592e6, '3M': 7776e6, ALL: Infinity };

export default function OverviewPage() {
  return (
    <DashboardShell>
      <Overview />
    </DashboardShell>
  );
}

function Overview() {
  const { account, latencyMs, refreshAccounts } = useDesk();
  const reduced = useReducedMotion();

  /* positions + activity */
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  useEffect(() => {
    if (!account?.id) return;
    let alive = true;
    const load = async () => {
      try {
        const raw = await api.get<{ items?: unknown[] } | unknown[]>('/positions', { account_id: account.id });
        const arr = (Array.isArray(raw) ? raw : (raw as { items?: unknown[] }).items || []) as Record<string, unknown>[];
        if (!alive) return;
        setPositions(arr.map((p) => ({
          id: String(p.id ?? ''),
          symbol: String(p.symbol ?? (p.instrument as Record<string, unknown> | undefined)?.symbol ?? '—'),
          side: String(p.side ?? '').toLowerCase(),
          lots: Number(p.lots ?? 0),
          open_price: Number(p.open_price ?? 0),
          profit: Number(p.profit ?? p.unrealized_pnl ?? 0),
        })));
      } catch { /* transient */ }
    };
    void load();
    const id = setInterval(() => { if (!document.hidden) void load(); }, 3000);
    return () => { alive = false; clearInterval(id); };
  }, [account?.id]);
  useEffect(() => {
    (async () => {
      try {
        const raw = await api.get<{ items?: ActivityRow[] } | ActivityRow[]>('/wallet/transactions', { limit: '8' });
        setActivity((Array.isArray(raw) ? raw : (raw as { items?: ActivityRow[] }).items || []).slice(0, 8));
      } catch { /* optional */ }
    })();
  }, []);

  /* equity series (session) */
  const series = useRef<{ t: number; v: number }[]>([]);
  const [, bump] = useState(0);
  useEffect(() => {
    if (!account) return;
    const eq = Number(account.equity) || 0;
    const s = series.current;
    if (s.length === 0) {
      const now = Date.now();
      for (let i = 39; i >= 1; i--) s.push({ t: now - i * 60_000, v: eq });
    }
    s.push({ t: Date.now(), v: eq });
    if (s.length > 600) s.shift();
    bump((n) => n + 1);
  }, [account, account?.equity]);

  const equity = Number(account?.equity ?? 0);
  const openPl = equity - Number(account?.balance ?? 0) - Number(account?.credit ?? 0);
  const isFlat = positions.length === 0;

  return (
    <>
      {/* 1 ── context strip */}
      <div className="dk-ctx">
        <b>Overview</b>
        <span className="sep" />
        <span>{positions.length} open position{positions.length === 1 ? '' : 's'}</span>
        <span className="sep" />
        <span>feed <span className="num">{latencyMs}ms</span></span>
      </div>

      {/* 2 ── hero row */}
      <div className="dk-hero">
        <section className="dk-panel" style={{ animationDelay: '0ms' }}>
          <div className="dk-head">
            <div>
              <p className="dk-eyebrow">Account equity</p>
              <EquityNumber value={equity} reduced={reduced} />
              <PlChip openPl={openPl} flat={isFlat} />
            </div>
            <TfChart series={series.current} reduced={reduced} />
          </div>
        </section>

      </div>

      {/* 3 ── KPI strip */}
      <div className="dk-kpis dk-panel" style={{ animationDelay: '180ms' }}>
        <Kpi label="Balance" value={Number(account?.balance ?? 0)} money reduced={reduced} />
        <Kpi label="Equity" value={equity} money reduced={reduced} />
        <Kpi label="Free margin" value={Number(account?.free_margin ?? 0)} money reduced={reduced} />
        <KpiPl label="Open P/L" value={openPl} flat={isFlat} reduced={reduced} />
        <KpiText label="Leverage" text={account ? `1:${account.leverage}` : '—'} />
      </div>

      {/* 4 ── body row */}
      <div className="dk-body dk-body-solo">
        <div className="dk-col">
          <section className="dk-panel" style={{ animationDelay: '270ms' }}>
            <div className="dk-head">
              <p className="dk-eyebrow">Open positions</p>
              <a className="dk-link-sm" href="/trading/terminal">Terminal →</a>
            </div>
            <PositionsTable rows={positions} />
          </section>
          <section className="dk-panel" style={{ animationDelay: '360ms' }}>
            <p className="dk-eyebrow">Activity</p>
            <ActivityLog rows={activity} />
          </section>
        </div>
      </div>
    </>
  );
}

/* ── hero pieces ────────────────────────────────────────────────────── */

function EquityNumber({ value, reduced }: { value: number; reduced: boolean }) {
  const shown = useAnimatedNumber(value, reduced);
  return <p className="dk-equity num">{usd(shown)}</p>;
}

function PlChip({ openPl, flat }: { openPl: number; flat: boolean }) {
  if (flat) return <span className="dk-chip flat">Flat</span>;
  const up = openPl >= 0;
  return (
    <span className={`dk-chip ${up ? 'up' : 'dn'} num`}>
      {up ? '+' : ''}{usd(openPl)}
    </span>
  );
}

function TfChart({ series, reduced }: { series: { t: number; v: number }[]; reduced: boolean }) {
  const [tf, setTf] = useState<Timeframe>('1D');
  return (
    <div style={{ flex: 1, minWidth: 0, marginLeft: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div className="dk-tfs" role="tablist" aria-label="Timeframe">
          {TIMEFRAMES.map((x) => (
            <button key={x} type="button" role="tab" aria-selected={tf === x}
              className={tf === x ? 'is-on' : ''} onClick={() => setTf(x)}>{x}</button>
          ))}
        </div>
      </div>
      <EquityChart series={series} tf={tf} reduced={reduced} />
    </div>
  );
}

function EquityChart({ series, tf, reduced }: {
  series: { t: number; v: number }[]; tf: Timeframe; reduced: boolean;
}) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => { const id = setTimeout(() => setDrawn(true), 60); return () => clearTimeout(id); }, []);
  const W = 560, H = 168, PAD = 8;
  const cutoff = Date.now() - TF_MS[tf];
  const inWindow = series.filter((p) => p.t >= cutoff);
  const data = inWindow.length >= 2 ? inWindow : series.slice(-2);
  if (data.length < 2) return <div className="dk-empty">Waiting for data…</div>;
  const vs = data.map((d) => d.v);
  const min = Math.min(...vs), max = Math.max(...vs);
  const span = max - min || Math.max(1, Math.abs(max) * 0.001);
  const X = (i: number) => PAD + (i / (data.length - 1)) * (W - PAD * 2);
  const Y = (v: number) => PAD + (1 - (v - min) / span) * (H - PAD * 2);
  const line = data.map((d, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(d.v).toFixed(1)}`).join(' ');
  const area = `${line} L${X(data.length - 1).toFixed(1)},${H - PAD} L${X(0).toFixed(1)},${H - PAD} Z`;
  const DASH = 1500;
  const lastX = X(data.length - 1), lastY = Y(data[data.length - 1]!.v);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="dk-chart" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="dkArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: 'var(--accent)', stopOpacity: 0.22 }} />
            <stop offset="100%" style={{ stopColor: 'var(--accent)', stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#dkArea)" opacity={drawn || reduced ? 1 : 0} style={{ transition: 'opacity .8s .5s' }} />
        <path
          d={line} fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth="2" strokeLinejoin="round"
          strokeDasharray={reduced ? undefined : DASH}
          strokeDashoffset={reduced ? undefined : (drawn ? 0 : DASH)}
        />
        <circle className="dk-edge-halo" cx={lastX} cy={lastY} r="9" style={{ fill: 'var(--accent)' }} />
        <circle cx={lastX} cy={lastY} r="3.2" style={{ fill: 'var(--accent)' }} />
      </svg>
      <div className="dk-hl num">
        <span>LOW <b>{usd(min)}</b></span>
        <span>SESSION RANGE</span>
        <span>HIGH <b>{usd(max)}</b></span>
      </div>
      <SmoothDraw reduced={reduced} />
    </div>
  );
}

/** The dash transition needs a CSS rule that can't be inline on a namespaced
 *  SVG attribute in every browser — a scoped style keeps it out of TSX hex. */
function SmoothDraw({ reduced }: { reduced: boolean }) {
  if (reduced) return null;
  return <style>{`.dk-chart path { transition: stroke-dashoffset 1.3s cubic-bezier(.22,1,.36,1); }`}</style>;
}

/* ── KPI pieces ─────────────────────────────────────────────────────── */

function Kpi({ label, value, money, reduced }: { label: string; value: number; money?: boolean; reduced: boolean }) {
  const shown = useAnimatedNumber(value, reduced);
  return (
    <div className="dk-kpi">
      <span>{label}</span>
      <b className="num">{money ? usd(shown) : Math.round(shown)}</b>
    </div>
  );
}

function KpiPl({ label, value, flat, reduced }: { label: string; value: number; flat: boolean; reduced: boolean }) {
  const shown = useAnimatedNumber(flat ? 0 : value, reduced);
  return (
    <div className="dk-kpi">
      <span>{label}</span>
      <b className={`num ${flat ? '' : value >= 0 ? 'dk-pl-up' : 'dk-pl-dn'}`}>
        {flat ? 'Flat' : `${value >= 0 ? '+' : ''}${usd(shown)}`}
      </b>
    </div>
  );
}

function KpiText({ label, text }: { label: string; text: string }) {
  return (
    <div className="dk-kpi">
      <span>{label}</span>
      <b className="num">{text}</b>
    </div>
  );
}

/* ── body pieces ────────────────────────────────────────────────────── */

function PositionsTable({ rows }: { rows: PositionRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="dk-empty">
        <Inbox size={26} strokeWidth={1.4} />
        <b>No open positions</b>
        <span>Use the order ticket to place your first trade, or open the full terminal.</span>
      </div>
    );
  }
  return (
    <table className="dk-table">
      <thead>
        <tr><th>Symbol</th><th>Side</th><th className="r">Lots</th><th className="r">Open</th><th className="r">P/L</th></tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr key={p.id}>
            <td><b>{p.symbol}</b></td>
            <td><span className="dk-side-b">{p.side.toUpperCase()}</span></td>
            <td className="r num">{p.lots.toFixed(2)}</td>
            <td className="r num">{px(p.open_price)}</td>
            <td className={`r num ${p.profit >= 0 ? 'dk-pl-up' : 'dk-pl-dn'}`}>
              {p.profit >= 0 ? '+' : ''}{usd(p.profit)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ActivityLog({ rows }: { rows: ActivityRow[] }) {
  if (rows.length === 0) return <div className="dk-empty"><b>No account activity yet</b></div>;
  return (
    <ul className="dk-log">
      {rows.map((r) => (
        <li key={r.id}>
          <span className="dk-log-type">{(r.type || '').replace(/_/g, ' ')}</span>
          <span className="dk-log-desc">{r.description || ''}</span>
          <b className={`num ${Number(r.amount) >= 0 ? 'dk-pl-up' : 'dk-pl-dn'}`}>
            {Number(r.amount) >= 0 ? '+' : ''}{usd(Number(r.amount) || 0)}
          </b>
        </li>
      ))}
    </ul>
  );
}

