'use client';

import { BookOpen, BarChart3, DollarSign, Info, PieChart, TrendingUp, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TradingJournalBlock } from '@/lib/trading-dashboard';
import { Card, CardHeader, StatCard } from '@/components/ui';

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

function RingGauge({
  value,
  max,
  label,
  sub,
  size = 100,
}: {
  value: number;
  max: number;
  label: string;
  sub: string;
  size?: number;
}) {
  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, max > 0 ? value / max : 0);
  const dash = c * pct;
  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="rotate-[-90deg]" aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" style={{ stroke: 'var(--border-primary)' }} strokeWidth={6} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            style={{ stroke: 'var(--accent)' }}
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="font-mono tabular-nums text-xl font-semibold text-text-primary leading-none">{label}</span>
          <span className="text-xxs text-text-tertiary uppercase mt-1 tracking-wide">{sub}</span>
        </div>
      </div>
    </div>
  );
}

export default function TradingJournalSection({
  journal: j,
  title = 'Trading Journal',
}: {
  journal: TradingJournalBlock;
  title?: string;
}) {
  const metrics = [
    {
      label: 'Net P&L',
      icon: DollarSign,
      value: fmtCompactSigned(j.netPl),
      valueClass: j.netPl >= 0 ? 'text-success' : 'text-danger',
      sub: `${j.netPlTradeCount} trades`,
    },
    {
      label: 'Profit factor',
      icon: TrendingUp,
      value: String(j.profitFactor),
      valueClass: 'text-text-primary',
      sub: j.profitFactorNote,
    },
    {
      label: 'Lots traded',
      icon: BarChart3,
      value: j.lotsTraded.toFixed(2),
      valueClass: 'text-text-primary',
      sub: `${j.totalTrades} trades`,
    },
    {
      label: 'Total trades',
      icon: BarChart3,
      value: String(j.totalTrades),
      valueClass: 'text-text-primary',
      sub: `${j.wins} win, ${j.losses} losses`,
    },
  ];

  return (
    <section className="text-text-primary space-y-4">
      <div className="flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-lg border border-border-primary bg-bg-tertiary">
          <BookOpen className="h-4 w-4 text-accent" aria-hidden />
        </div>
        <h2 className="text-md font-semibold tracking-tight">{title}</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard label="Balance" value={fmtUsd(j.balance)} icon={<Wallet />} />
        <StatCard label="Equity" value={fmtUsd(j.equity)} icon={<DollarSign />} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <StatCard
            key={m.label}
            label={m.label}
            value={<span className={cn(m.valueClass)}>{m.value}</span>}
            hint={m.sub}
            icon={<m.icon />}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader
            title={
              <span className="inline-flex items-center gap-2">
                Current streak
                <Info className="h-3.5 w-3.5 text-text-tertiary" aria-hidden />
              </span>
            }
          />
          <div className="flex flex-wrap justify-around gap-6">
            <RingGauge value={j.streakDays} max={7} label={String(j.streakDays)} sub={`Days / ${j.streakDaysNote}`} />
            <RingGauge
              value={j.streakTrades}
              max={10}
              label={String(j.streakTrades)}
              sub={`Trades / ${j.streakTradesNote}`}
            />
          </div>
        </Card>
        <Card>
          <CardHeader
            title={
              <span className="inline-flex items-center gap-2">
                <PieChart className="h-4 w-4 text-accent" aria-hidden />
                Account stats
              </span>
            }
          />
          <ul className="space-y-2.5 text-sm">
            {[
              ['Free margin', fmtUsd(j.freeMargin)],
              ['Used margin', fmtUsd(j.usedMargin)],
              ['Margin level', j.marginLevel ?? 'N/A'],
              ['Currency', j.currency],
            ].map(([k, v]) => (
              <li key={k} className="flex justify-between gap-2">
                <span className="text-text-tertiary">{k}</span>
                <span className="font-mono tabular-nums text-right font-medium text-text-primary">{v}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </section>
  );
}
