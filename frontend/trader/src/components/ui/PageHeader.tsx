import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Small uppercase label above the title (section / context). */
  eyebrow?: ReactNode;
  /** Right-aligned actions: usually one primary Button and at most one secondary. */
  actions?: ReactNode;
  /** Tabs or filters rendered under the title row. */
  children?: ReactNode;
  className?: string;
}

/** Every dashboard page opens with this: one title scale, one spacing, one actions slot. */
export function PageHeader({ title, description, eyebrow, actions, children, className }: PageHeaderProps) {
  return (
    <header className={cn('mb-5 md:mb-6', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-xxs font-bold uppercase tracking-[0.12em] text-text-tertiary mb-1.5">{eyebrow}</p>
          )}
          <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-text-primary leading-tight">{title}</h1>
          {description && <p className="mt-1 text-sm text-text-secondary max-w-2xl">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </header>
  );
}

export default PageHeader;
