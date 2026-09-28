'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SegmentedOption<V extends string> {
  value: V;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
  /** Colour the active state by trade side (Buy / Sell toggles). */
  tone?: 'buy' | 'sell';
}

export interface SegmentedProps<V extends string> {
  options: SegmentedOption<V>[];
  value: V;
  onChange: (value: V) => void;
  size?: 'xs' | 'sm' | 'md';
  fullWidth?: boolean;
  className?: string;
  'aria-label'?: string;
}

const SIZE = { xs: 'h-6 px-2 text-xxs', sm: 'h-7 px-2.5 text-xs', md: 'h-8 px-3 text-sm' } as const;

/** Exclusive toggle group: Market / Pending, timeframes, Buy / Sell. */
export function Segmented<V extends string>({ options, value, onChange, size = 'sm', fullWidth, className, ...aria }: SegmentedProps<V>) {
  return (
    <div
      role="radiogroup"
      aria-label={aria['aria-label']}
      className={cn('inline-flex items-center gap-0.5 rounded-md border border-border-primary bg-bg-tertiary p-0.5', fullWidth && 'flex w-full', className)}
    >
      {options.map((o) => {
        const on = o.value === value;
        const activeLook =
          o.tone === 'buy' ? 'bg-buy text-text-inverse' : o.tone === 'sell' ? 'bg-sell text-text-on-accent' : 'bg-bg-card text-text-primary shadow-sm';
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-sm font-semibold uppercase tracking-wide whitespace-nowrap transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 disabled:opacity-50 disabled:pointer-events-none',
              SIZE[size],
              fullWidth && 'flex-1',
              on ? activeLook : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {o.icon && <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{o.icon}</span>}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default Segmented;
