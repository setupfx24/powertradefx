import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant = 'neutral' | 'accent' | 'success' | 'danger' | 'warning' | 'info' | 'buy' | 'sell';
export type BadgeTone = 'soft' | 'solid' | 'outline';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  tone?: BadgeTone;
  size?: BadgeSize;
  /** Leading status dot. */
  dot?: boolean;
}

const SOFT: Record<BadgeVariant, string> = {
  neutral: 'bg-bg-hover text-text-secondary',
  accent: 'bg-accent/15 text-accent',
  success: 'bg-success/10 text-success',
  danger: 'bg-danger/10 text-danger',
  warning: 'bg-warning/15 text-warning',
  info: 'bg-info/15 text-info',
  buy: 'bg-buy/10 text-buy',
  sell: 'bg-sell/10 text-sell',
};

const SOLID: Record<BadgeVariant, string> = {
  neutral: 'bg-bg-active text-text-primary',
  accent: 'bg-accent text-text-on-accent',
  success: 'bg-success text-text-inverse',
  danger: 'bg-danger text-text-on-accent',
  warning: 'bg-warning text-text-inverse',
  info: 'bg-info text-text-on-accent',
  buy: 'bg-buy text-text-inverse',
  sell: 'bg-sell text-text-on-accent',
};

const OUTLINE: Record<BadgeVariant, string> = {
  neutral: 'border-border-strong text-text-secondary',
  accent: 'border-accent/50 text-accent',
  success: 'border-success/50 text-success',
  danger: 'border-danger/50 text-danger',
  warning: 'border-warning/50 text-warning',
  info: 'border-info/50 text-info',
  buy: 'border-buy/50 text-buy',
  sell: 'border-sell/50 text-sell',
};

const DOT: Record<BadgeVariant, string> = {
  neutral: 'bg-text-tertiary',
  accent: 'bg-accent',
  success: 'bg-success',
  danger: 'bg-danger',
  warning: 'bg-warning',
  info: 'bg-info',
  buy: 'bg-buy',
  sell: 'bg-sell',
};

const SIZE: Record<BadgeSize, string> = {
  sm: 'h-5 px-1.5 text-xxs',
  md: 'h-6 px-2 text-xs',
};

export function Badge({ variant = 'neutral', tone = 'soft', size = 'md', dot, className, children, ...props }: BadgeProps) {
  const look = tone === 'solid' ? SOLID[variant] : tone === 'outline' ? OUTLINE[variant] : SOFT[variant];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border border-transparent font-semibold uppercase tracking-wide whitespace-nowrap',
        SIZE[size],
        look,
        className,
      )}
      {...props}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', DOT[variant])} aria-hidden />}
      {children}
    </span>
  );
}

/** Buy/Sell chip used in positions, orders and history tables. */
export function SideBadge({ side, size = 'sm', className }: { side: 'buy' | 'sell' | string; size?: BadgeSize; className?: string }) {
  const s = String(side).toLowerCase() === 'sell' ? 'sell' : 'buy';
  return (
    <Badge variant={s} size={size} className={className}>
      {s}
    </Badge>
  );
}

export default Badge;
