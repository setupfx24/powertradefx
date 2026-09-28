'use client';

import { clsx } from 'clsx';
import type { TradingAccount } from '@/stores/tradingStore';
import { Badge } from '@/components/ui';

type Variant = 'default' | 'compact';

/**
 * Shows the trading account number, Live/Demo, and optional group name so users always know which wallet they are on.
 */
export function ActiveAccountBadge({
  account,
  variant = 'default',
  className,
}: {
  account: TradingAccount;
  variant?: Variant;
  className?: string;
}) {
  const g = account.account_group?.name;
  const compact = variant === 'compact';

  return (
    <div
      className={clsx(
        'flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0',
        compact ? 'text-xxs sm:text-xs' : 'text-xs sm:text-sm',
        className,
      )}
      title={`Trading account ${account.account_number}${g ? ` — ${g}` : ''}`}
    >
      <span className="text-xxs font-bold uppercase tracking-[0.12em] text-text-tertiary shrink-0">
        Account
      </span>
      <span
        className={clsx(
          'font-mono font-extrabold text-text-primary tracking-tight truncate max-w-[9rem] sm:max-w-[12rem]',
          compact ? 'text-xs' : 'text-sm sm:text-base',
        )}
      >
        {account.account_number}
      </span>
      <Badge variant={account.is_demo ? 'warning' : 'success'} size={compact ? 'sm' : 'md'}>
        {account.is_demo ? 'Demo' : 'Live'}
      </Badge>
      {g ? (
        <Badge variant="neutral" tone="outline" size={compact ? 'sm' : 'md'} className="normal-case tracking-normal max-w-[6rem] sm:max-w-[8rem]">
          <span className="truncate">{g}</span>
        </Badge>
      ) : null}
    </div>
  );
}
