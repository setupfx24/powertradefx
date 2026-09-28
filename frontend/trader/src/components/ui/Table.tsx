import { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Align = 'left' | 'right' | 'center';
const ALIGN: Record<Align, string> = { left: 'text-left', right: 'text-right', center: 'text-center' };

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  /** Tighter rows for dense data (terminal, history). */
  dense?: boolean;
}

/** Scrollable wrapper + table. Compose with THead / TBody / TR / TH / TD. */
export function Table({ dense, className, ...props }: TableProps) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={cn('w-full border-collapse', dense ? 'text-xs' : 'text-sm', className)}
        data-dense={dense || undefined}
        {...props}
      />
    </div>
  );
}

export function THead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('[&_th]:bg-bg-secondary/60', className)} {...props} />;
}

export function TBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export interface TRProps extends HTMLAttributes<HTMLTableRowElement> {
  /** Hover surface + pointer for clickable rows. */
  interactive?: boolean;
}

export function TR({ interactive, className, ...props }: TRProps) {
  return (
    <tr
      className={cn(
        'border-b border-border-secondary last:border-b-0',
        interactive && 'cursor-pointer transition-colors hover:bg-bg-hover',
        className,
      )}
      {...props}
    />
  );
}

export interface THProps extends ThHTMLAttributes<HTMLTableCellElement> {
  align?: Align;
}

export function TH({ align = 'left', className, ...props }: THProps) {
  return (
    <th
      className={cn(
        'px-3 py-2 text-xxs font-bold uppercase tracking-[0.1em] text-text-tertiary whitespace-nowrap border-b border-border-primary',
        '[table[data-dense]_&]:px-2 [table[data-dense]_&]:py-1.5',
        ALIGN[align],
        className,
      )}
      {...props}
    />
  );
}

export interface TDProps extends TdHTMLAttributes<HTMLTableCellElement> {
  align?: Align;
  /** Tabular monospace digits, right-aligned by default. */
  numeric?: boolean;
  muted?: boolean;
}

export function TD({ align, numeric, muted, className, ...props }: TDProps) {
  const a = align ?? (numeric ? 'right' : 'left');
  return (
    <td
      className={cn(
        'px-3 py-2.5 align-middle whitespace-nowrap',
        '[table[data-dense]_&]:px-2 [table[data-dense]_&]:py-1.5',
        numeric && 'font-mono tabular-nums',
        muted ? 'text-text-secondary' : 'text-text-primary',
        ALIGN[a],
        className,
      )}
      {...props}
    />
  );
}

export default Table;
