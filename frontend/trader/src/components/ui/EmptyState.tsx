import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Usually one Button. */
  action?: ReactNode;
  /** Compact height for table bodies and side panels. */
  compact?: boolean;
  className?: string;
}

export function EmptyState({ icon, title, description, action, compact, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center gap-2 px-4',
        compact ? 'py-8' : 'py-14',
        className,
      )}
    >
      {icon && (
        <span className="mb-1 grid h-10 w-10 place-items-center rounded-lg border border-border-primary bg-bg-tertiary text-text-tertiary [&>svg]:h-5 [&>svg]:w-5">
          {icon}
        </span>
      )}
      <p className="text-md font-semibold text-text-primary">{title}</p>
      {description && <p className="max-w-sm text-sm text-text-tertiary leading-relaxed">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export default EmptyState;
