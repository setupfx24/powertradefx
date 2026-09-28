'use client';

import { useEffect, useState } from 'react';
import { Check, Clock, X, Trophy } from 'lucide-react';
import api from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { Badge, Card, CardHeader, Skeleton } from '@/components/ui';

type Eligibility = {
  active_days: number;
  active_days_required: number;
  active_days_ok: boolean;
  profitable: boolean;
  profitable_ok: boolean;
  total_pnl_usd: number;
  trade_volume_usd: number;
  trade_volume_required: number;
  trade_volume_ok: boolean;
  trade_count: number;
  trade_count_required: number;
  trade_count_ok: boolean;
  all_passed: boolean;
};

const fmtUsd = (n: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

/** Banner shown above the Become-Master form. Live-fetches the user's stats
 * vs. the four eligibility criteria from COPY_TRADING_PAGE.docx so they can
 * see exactly what's missing before they apply. */
export default function MasterEligibilityBanner() {
  const [data, setData] = useState<Eligibility | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api.get<Eligibility>('/social/masters/eligibility');
        if (!cancelled) setData(r);
      } catch { /* silent — admin path remains via external_pnl_url */ }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <Card padding="sm" className="flex items-center gap-3 text-xs text-text-secondary" aria-busy>
        <Skeleton className="h-4 w-4 rounded-full" />
        Checking your eligibility…
      </Card>
    );
  }
  if (!data) return null;

  const allPassed = data.all_passed;
  return (
    <Card className={cn('animate-fade-in', allPassed ? 'border-success/40' : 'border-warning/40')}>
      <CardHeader
        className="mb-3"
        title={
          <span className="inline-flex items-center gap-2">
            <Trophy size={16} className={allPassed ? 'text-success' : 'text-warning'} aria-hidden />
            {allPassed ? 'You qualify as a Master Trader' : 'Master Trader eligibility'}
          </span>
        }
        actions={
          <Badge variant={allPassed ? 'success' : 'warning'} size="sm">
            {allPassed ? <Check size={10} aria-hidden /> : <Clock size={10} aria-hidden />}
            {allPassed ? 'Ready to apply' : 'Not yet'}
          </Badge>
        }
      />

      <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
        <Criterion
          label="Active for 30+ days"
          ok={data.active_days_ok}
          progress={`${data.active_days} / ${data.active_days_required} days`}
        />
        <Criterion
          label="Profitable lifetime P&L"
          ok={data.profitable_ok}
          progress={fmtUsd(data.total_pnl_usd)}
        />
        <Criterion
          label="$100k trading volume"
          ok={data.trade_volume_ok}
          progress={`${fmtUsd(data.trade_volume_usd)} / ${fmtUsd(data.trade_volume_required)}`}
        />
        <Criterion
          label="100+ closed trades"
          ok={data.trade_count_ok}
          progress={`${data.trade_count} / ${data.trade_count_required}`}
        />
      </div>

      {!allPassed && (
        <p className="mt-3 text-xs leading-relaxed text-text-tertiary">
          Don&apos;t meet the criteria yet? You can still apply with a verified external track record (e.g.
          MyFxBook URL, audited statement). Admin will review.
        </p>
      )}
    </Card>
  );
}

function Criterion({ label, ok, progress }: { label: string; ok: boolean; progress: string }) {
  return (
    <div className="flex items-start gap-2 py-1">
      <span
        className={cn(
          'mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full',
          ok ? 'bg-success/15 text-success' : 'border border-border-primary bg-bg-tertiary text-text-tertiary',
        )}
        aria-hidden
      >
        {ok ? <Check size={10} /> : <X size={10} />}
      </span>
      <div className="min-w-0">
        <p className={cn('font-medium', ok ? 'text-text-primary' : 'text-text-secondary')}>{label}</p>
        <p className="font-mono text-xxs tabular-nums text-text-tertiary">{progress}</p>
      </div>
    </div>
  );
}
