'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface TabItem {
  id: string;
  label: ReactNode;
  count?: number;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  tabs: TabItem[];
  active: string;
  onChange: (tabId: string) => void;
  /** `underline` for page/section tabs, `pills` for compact toggles. */
  variant?: 'underline' | 'pills';
  size?: 'sm' | 'md';
  /** Stretch tabs to fill the row. */
  fullWidth?: boolean;
  className?: string;
  'aria-label'?: string;
}

export function Tabs({ tabs, active, onChange, variant = 'underline', size = 'md', fullWidth, className, ...aria }: TabsProps) {
  const pills = variant === 'pills';
  return (
    <div
      role="tablist"
      aria-label={aria['aria-label']}
      className={cn(
        'flex items-center',
        pills ? 'gap-1 rounded-md bg-bg-tertiary border border-border-primary p-1' : 'gap-1 border-b border-border-primary',
        fullWidth && '[&>button]:flex-1',
        className,
      )}
    >
      {tabs.map((tab) => {
        const on = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={on}
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            className={cn(
              'relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-semibold transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 disabled:opacity-50 disabled:pointer-events-none',
              size === 'sm' ? 'text-xs' : 'text-sm',
              pills
                ? cn('rounded-sm', size === 'sm' ? 'h-7 px-2.5' : 'h-8 px-3', on ? 'bg-bg-card text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary')
                : cn('-mb-px border-b-2', size === 'sm' ? 'h-8 px-2.5' : 'h-10 px-3', on ? 'border-accent text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'),
            )}
          >
            {tab.icon && <span className="[&>svg]:h-3.5 [&>svg]:w-3.5">{tab.icon}</span>}
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className={cn('rounded-sm px-1 text-xxs tabular-nums', on ? 'bg-accent/15 text-accent' : 'bg-bg-hover text-text-tertiary')}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
