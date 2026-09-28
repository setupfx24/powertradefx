import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Card } from './Card';
import { Skeleton } from './Skeleton';

export interface StatCardProps {
  label: ReactNode;
  value: ReactNode;
  /** Change vs. a reference: a number is coloured by sign; a node is shown as-is. */
  delta?: number | ReactNode;
  /** Formatter for numeric deltas. Default: signed 2-decimals. */
  formatDelta?: (n: number) => string;
  /** Small caption under the value (period, currency, note). */
  hint?: ReactNode;
  icon?: ReactNode;
  loading?: boolean;
  className?: string;
}

const defaultFormat = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(2)}`;

/** KPI tile: label, one big numeral, optional signed delta. */
export function StatCard({ label, value, delta, formatDelta = defaultFormat, hint, icon, loading, className }: StatCardProps) {
  let deltaNode: ReactNode = null;
  if (typeof delta === 'number') {
    const tone = delta > 0 ? 'text-success' : delta < 0 ? 'text-danger' : 'text-text-tertiary';
    deltaNode = <span className={cn('font-mono tabular-nums text-xs font-semibold', tone)}>{formatDelta(delta)}</span>;
  } else if (delta) {
    deltaNode = delta;
  }

  return (
    <Card padding="md" className={cn('flex items-center justify-between gap-3', className)}>
      <div className="min-w-0 flex flex-col gap-1.5">
        <span className="text-xxs font-semibold uppercase tracking-[0.1em] text-text-secondary">{label}</span>
        {loading ? (
          <Skeleton className="h-6 w-28" />
        ) : (
          <span className="font-mono tabular-nums text-xl font-semibold text-text-primary leading-none truncate">{value}</span>
        )}
        {(deltaNode || hint) && (
          <span className="flex items-center gap-2 text-xs text-text-tertiary">
            {deltaNode}
            {hint}
          </span>
        )}
      </div>
      {icon && (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border-primary bg-bg-tertiary text-text-secondary [&>svg]:h-4 [&>svg]:w-4">
          {icon}
        </span>
      )}
    </Card>
  );
}

export default StatCard;
