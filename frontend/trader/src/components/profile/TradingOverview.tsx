'use client';

import { useMemo, useState, useCallback } from 'react';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import {
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Eye,
  LineChart,
  Target,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CalendarDayCell, TradingDashboardData } from '@/lib/trading-dashboard';
import { getTradingDashboardMock } from '@/lib/trading-dashboard';
import TradingJournalSection from '@/components/profile/TradingJournalSection';
import { Button, Card, CardHeader, Segmented, Select } from '@/components/ui';

function fmtUsd(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function fmtCompactSigned(n: number) {
  const sign = n >= 0 ? '+' : '−';
  const a = Math.abs(n);
  if (a >= 1000) return `${sign}$${(a / 1000).toFixed(1)}K`;
  return `${sign}$${a.toFixed(0)}`;
}

function dayMapFromCells(cells: CalendarDayCell[]) {
  const m = new Map<string, CalendarDayCell>();
  cells.forEach((c) => m.set(c.date, c));
  return m;
}

function EquityChart({ points }: { points: { date: string; equityUsd: number }[] }) {
  const [hover, setHover] = useState<{ x: number; y: number; label: string; v: number } | null>(null);
  const w = 560;
  const h = 200;
  const pad = { t: 16, r: 16, b: 28, l: 44 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;

  const { pathD, areaD, pts, minY, maxY } = useMemo(() => {
    if (points.length < 2) {
      return { pathD: '', areaD: '', pts: [] as { x: number; y: number; label: string; v: number }[], minY: 0, maxY: 1 };
    }
    const vals = points.map((p) => p.equityUsd);
    let min = Math.min(...vals);
    let max = Math.max(...vals);
    const padY = (max - min) * 0.15 || 500;
    min -= padY;
    max += padY;
    const n = points.length - 1;
    const mapped = points.map((p, i) => {
      const x = pad.l + (i / n) * innerW;
      const y = pad.t + innerH - ((p.equityUsd - min) / (max - min)) * innerH;
      return { x, y, label: p.date, v: p.equityUsd };
    });
    const line = mapped.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const area =
      /* mapped derives from points; both are guarded by length checks above. */
      `M ${mapped[0]!.x} ${pad.t + innerH} ` +
      mapped.map((p) => `L ${p.x} ${p.y}`).join(' ') +
      ` L ${mapped[mapped.length - 1]!.x} ${pad.t + innerH} Z`;
    return { pathD: line, areaD: area, pts: mapped, minY: min, maxY: max };
  }, [points, innerW, innerH, pad.l, pad.t]);

  const onMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (pts.length === 0) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * w;
      /* pts.length > 0 guard above ensures pts[0] is defined. */
      let best = pts[0]!;
      let d = Infinity;
      for (const p of pts) {
        const dx = Math.abs(p.x - mx);
        if (dx < d) {
          d = dx;
          best = p;
        }
      }
      setHover({ x: best.x, y: best.y, label: best.label, v: best.v });
    },
    [pts, w],
  );

  const yTicks = useMemo(() => {
    if (pts.length === 0) return [];
    const ticks = 4;
    const out: number[] = [];
    for (let i = 0; i <= ticks; i++) {
      out.push(minY + ((maxY - minY) * i) / ticks);
    }
    return out;
  }, [minY, maxY, pts.length]);

  return (
    <Card nested padding="sm" className="relative w-full overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 mb-2 text-xxs text-text-tertiary">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-accent" /> Strong profit
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-success" /> Small win
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-danger" /> Losing day
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-text-tertiary" /> Rest
        </span>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-auto max-h-[220px] touch-none"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        {yTicks.map((yv, i) => {
          const y = pad.t + innerH - ((yv - minY) / (maxY - minY)) * innerH;
          return (
            <g key={i}>
              <line x1={pad.l} y1={y} x2={w - pad.r} y2={y} style={{ stroke: 'var(--border-primary)' }} strokeWidth={1} />
              <text x={4} y={y + 4} style={{ fill: 'var(--text-tertiary)' }} fontSize={10}>
                ${(yv / 1000).toFixed(0)}k
              </text>
            </g>
          );
        })}
        <defs>
          <linearGradient id="eqFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: 'var(--accent)', stopOpacity: 0.25 }} />
            <stop offset="100%" style={{ stopColor: 'var(--accent)', stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        {areaD ? <path d={areaD} fill="url(#eqFill)" /> : null}
        {pathD ? (
          <path d={pathD} fill="none" style={{ stroke: 'var(--accent)' }} strokeWidth={2} />
        ) : null}
        {hover ? (
          <>
            <line x1={hover.x} y1={pad.t} x2={hover.x} y2={pad.t + innerH} style={{ stroke: 'var(--text-tertiary)' }} strokeDasharray="4 4" />
            <circle cx={hover.x} cy={hover.y} r={5} style={{ fill: 'var(--accent)' }} />
          </>
        ) : null}
      </svg>
      {hover ? (
        <div
          className="absolute z-10 rounded-md border border-border-primary bg-card px-3 py-2 text-xs shadow-md pointer-events-none"
          style={{
            left: `clamp(8px, ${(hover.x / w) * 100}%, calc(100% - 160px))`,
            top: 48,
          }}
        >
          <div className="text-text-tertiary">{(() => {
            try {
              if (!hover.label) return '';
              const d = typeof hover.label === 'string' ? parseISO(hover.label) : new Date(hover.label);
              return Number.isNaN(d.getTime()) ? String(hover.label) : format(d, 'MMM dd, yyyy');
            } catch {
              return String(hover.label ?? '');
            }
          })()}</div>
          <div className="font-mono tabular-nums font-semibold text-text-primary">Equity {fmtUsd(hover.v)}</div>
        </div>
      ) : null}
    </Card>
  );
}

type CalView = 'usd' | 'pct' | 'r' | 'trades';

const CAL_VIEWS: { value: CalView; label: string }[] = [
  { value: 'usd', label: '$' },
  { value: 'pct', label: '%' },
  { value: 'r', label: 'R' },
  { value: 'trades', label: 'T' },
];

export default function TradingOverview({ data }: { data?: TradingDashboardData }) {
  const d = data ?? getTradingDashboardMock();
  const j = d.journal;
  const [calMonth, setCalMonth] = useState(() => parseISO(`${d.calendar.defaultMonth}-01`));
  const [calView, setCalView] = useState<CalView>('usd');
  const dayMap = useMemo(() => dayMapFromCells(d.calendar.days), [d.calendar.days]);

  const weeks = useMemo(() => {
    const start = startOfWeek(startOfMonth(calMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(calMonth), { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start, end });
    const rows: Date[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      rows.push(days.slice(i, i + 7));
    }
    return rows;
  }, [calMonth]);

  const weekTotals = useMemo(() => {
    return weeks.map((row) => {
      let sum = 0;
      let n = 0;
      for (const dt of row) {
        if (!isSameMonth(dt, calMonth)) continue;
        const key = format(dt, 'yyyy-MM-dd');
        const cell = dayMap.get(key);
        if (cell?.pnlUsd != null) {
          sum += cell.pnlUsd;
          n++;
        }
      }
      return { sum, n };
    });
  }, [weeks, calMonth, dayMap]);

  const s = d.calendar.summary;

  const performanceRows: [string, string, string][] = [
    ['Profit factor', d.stats.profitFactor.toFixed(2), 'text-text-primary'],
    ['Avg win', fmtUsd(d.stats.avgWinUsd), 'text-success'],
    ['Avg loss', fmtUsd(-d.stats.avgLossUsd), 'text-danger'],
    ['Period P&L', fmtCompactSigned(d.stats.periodPnlUsd), d.stats.periodPnlUsd >= 0 ? 'text-success' : 'text-danger'],
    ['Total trades', String(d.stats.totalTrades), 'text-text-primary'],
  ];

  return (
    <div className="space-y-4 md:space-y-5 text-text-primary">
      <TradingJournalSection journal={j} />

      {/* —— Calendar + sidebar —— */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card padding="none" className="xl:col-span-2 overflow-hidden">
          <div className="p-3 md:p-4 border-b border-border-primary flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-accent" aria-hidden />
              <h3 className="text-md font-semibold text-text-primary">Trading calendar</h3>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Segmented
                size="sm"
                aria-label="Calendar view"
                value={calView}
                onChange={setCalView}
                options={CAL_VIEWS}
              />
              <Button variant="ghost" size="sm" iconOnly aria-label="Toggle visibility">
                <Eye className="w-4 h-4" aria-hidden />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                iconOnly
                onClick={() => setCalMonth(subMonths(calMonth, 1))}
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" aria-hidden />
              </Button>
              <span className="text-sm font-semibold text-text-primary min-w-[100px] text-center">
                {format(calMonth, 'MMM yyyy')}
              </span>
              <Button
                variant="outline"
                size="sm"
                iconOnly
                onClick={() => setCalMonth(addMonths(calMonth, 1))}
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" aria-hidden />
              </Button>
            </div>
          </div>

          <div className="px-3 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs border-b border-border-primary bg-bg-secondary/40">
            <span className={cn('font-semibold font-mono tabular-nums', s.monthlyPnlUsd >= 0 ? 'text-success' : 'text-danger')}>
              Monthly P&L {fmtCompactSigned(s.monthlyPnlUsd)}
            </span>
            <span className="text-text-tertiary">
              Active days <span className="text-text-primary font-mono tabular-nums">{s.activeDays}</span>
            </span>
            <span className="text-text-tertiary">
              Trades <span className="text-text-primary font-mono tabular-nums">{s.trades}</span>
            </span>
            <span className="text-text-tertiary">
              Lots <span className="text-text-primary font-mono tabular-nums">{s.lots.toFixed(2)}</span>
            </span>
            <span className="ml-auto text-text-tertiary font-mono tabular-nums">
              <span className="text-success">{s.wins}W</span> <span className="text-danger">{s.losses}L</span>
            </span>
          </div>

          <div className="p-2 md:p-3">
            <div className="grid grid-cols-[repeat(8,minmax(0,1fr))] gap-1 text-xxs text-text-tertiary font-semibold uppercase tracking-[0.1em] mb-1 px-0.5">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Wk'].map((h) => (
                <div key={h} className="text-center py-1">
                  {h}
                </div>
              ))}
            </div>
            {weeks.map((row, wi) => (
              <div key={wi} className="grid grid-cols-[repeat(8,minmax(0,1fr))] gap-1 mb-1">
                {row.map((dt) => {
                  const inMonth = isSameMonth(dt, calMonth);
                  const key = format(dt, 'yyyy-MM-dd');
                  const cell = dayMap.get(key);
                  const isWin = cell?.kind === 'win';
                  const isLoss = cell?.kind === 'loss';
                  const showUsd = calView === 'usd' && cell?.pnlUsd != null;
                  return (
                    <div
                      key={key}
                      className={cn(
                        'min-h-[72px] rounded-md border p-1 flex flex-col',
                        !inMonth && 'opacity-25 border-transparent bg-transparent',
                        inMonth && !cell && 'border-border-primary bg-bg-secondary/40',
                        inMonth && isWin && 'border-success/50 bg-success/10',
                        inMonth && isLoss && 'border-danger/50 bg-danger/10',
                      )}
                    >
                      <span className="text-xxs text-text-tertiary">{format(dt, 'd')}</span>
                      {inMonth && cell && cell.kind !== 'empty' ? (
                        <>
                          {showUsd ? (
                            <span
                              className={cn(
                                'text-xs font-bold leading-tight font-mono tabular-nums',
                                cell.pnlUsd! >= 0 ? 'text-success' : 'text-danger',
                              )}
                            >
                              {fmtCompactSigned(cell.pnlUsd!)}
                            </span>
                          ) : null}
                          {calView === 'trades' && cell.trades != null ? (
                            <span className="text-xxs text-text-secondary">{cell.trades} trades</span>
                          ) : null}
                          {calView === 'r' && cell.rMultiple != null ? (
                            <span className="text-xxs text-text-secondary">{cell.rMultiple}R</span>
                          ) : null}
                          {calView === 'pct' && cell.pnlUsd != null ? (
                            <span className="text-xxs text-text-secondary">{(cell.pnlUsd / 100).toFixed(1)}%</span>
                          ) : null}
                          {calView === 'usd' && cell.trades != null ? (
                            <span className="text-xxs text-text-tertiary mt-auto">{cell.trades} t</span>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  );
                })}
                <div className="min-h-[72px] rounded-md border border-border-primary bg-bg-secondary/50 flex flex-col items-center justify-center text-xxs">
                  <span className="text-text-tertiary font-mono tabular-nums">
                    {/* wi is the week-index loop counter, bounded by weekTotals.length. */}
                    {weekTotals[wi]!.n > 0 ? fmtCompactSigned(weekTotals[wi]!.sum) : '—'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <div className="flex justify-end">
            <div className="w-28">
              <Select label="Currency" size="sm" aria-label="Currency">
                <option>USD</option>
              </Select>
            </div>
          </div>
          <Card>
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <Target className="w-4 h-4 text-accent" aria-hidden />
                  Trade win %
                </span>
              }
            />
            <p className={cn('font-mono tabular-nums text-2xl font-semibold', d.stats.tradeWinPct >= 50 ? 'text-success' : 'text-danger')}>
              {d.stats.tradeWinPct.toFixed(1)}%
            </p>
            <div className="h-2 rounded-full bg-danger/40 mt-3 overflow-hidden flex">
              <div
                className="h-full bg-success"
                style={{ width: `${Math.min(100, d.stats.tradeWinPct)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs mt-2 font-mono tabular-nums">
              <span className="text-success">{j.wins} won</span>
              <span className="text-danger">{j.losses} lost</span>
            </div>
          </Card>
          <Card>
            <CardHeader
              title={
                <span className="inline-flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-accent" aria-hidden />
                  Performance
                </span>
              }
            />
            <ul className="space-y-2 text-sm">
              {performanceRows.map(([k, v, c]) => (
                <li key={k} className="flex justify-between gap-2">
                  <span className="text-text-tertiary">{k}</span>
                  <span className={cn('font-mono font-semibold tabular-nums', c)}>{v}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      {/* —— Equity —— */}
      <Card>
        <CardHeader
          title={
            <span className="inline-flex items-center gap-2">
              <LineChart className="w-4 h-4 text-accent" aria-hidden />
              Equity growth
            </span>
          }
        />
        <EquityChart points={d.equity} />
      </Card>
    </div>
  );
}
