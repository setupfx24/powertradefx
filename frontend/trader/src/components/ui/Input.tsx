'use client';

import {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  forwardRef,
  useId,
} from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Field: label / hint / error wrapper shared by every control ───── */

export interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  /** id of the control, for the label's htmlFor. */
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}

export function Field({ label, hint, error, required, htmlFor, className, children }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5 min-w-0', className)}>
      {label && (
        <label htmlFor={htmlFor} className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          {label}
          {required && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
        </label>
      )}
      {children}
      {error ? (
        <span role="alert" className="text-xs text-danger">{error}</span>
      ) : hint ? (
        <span className="text-xs text-text-tertiary">{hint}</span>
      ) : null}
    </div>
  );
}

/* ── Shared control look ───────────────────────────────────────────── */

export const CONTROL_CLASS =
  'w-full rounded-md bg-bg-input border border-border-primary text-text-primary text-sm placeholder:text-text-tertiary ' +
  'transition-[border-color,box-shadow] duration-150 hover:border-border-strong ' +
  'focus:outline-none focus:border-accent/70 focus:ring-2 focus:ring-accent/20 ' +
  'disabled:opacity-55 disabled:cursor-not-allowed';

const CONTROL_ERROR = '!border-danger/60 focus:!ring-danger/20';

type Size = 'sm' | 'md' | 'lg';
const HEIGHT: Record<Size, string> = { sm: 'h-8 px-2.5 text-xs', md: 'h-9 px-3', lg: 'h-11 px-3.5 text-md' };

/* ── Input ─────────────────────────────────────────────────────────── */

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  icon?: ReactNode;
  suffix?: ReactNode;
  size?: Size;
  /** Numeric field: tabular monospace digits. */
  numeric?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, icon, suffix, size = 'md', numeric, className, id, required, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    return (
      <Field label={label} hint={hint} error={error} required={required} htmlFor={inputId}>
        <div className="relative">
          {icon && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary [&>svg]:h-4 [&>svg]:w-4">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            required={required}
            aria-invalid={error ? true : undefined}
            className={cn(
              CONTROL_CLASS,
              HEIGHT[size],
              icon && 'pl-9',
              suffix && 'pr-10',
              numeric && 'font-mono tabular-nums',
              error && CONTROL_ERROR,
              className,
            )}
            {...props}
          />
          {suffix && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary text-xs flex items-center">
              {suffix}
            </span>
          )}
        </div>
      </Field>
    );
  },
);
Input.displayName = 'Input';

/* ── Select (native) ───────────────────────────────────────────────── */

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  size?: Size;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, hint, error, size = 'md', className, id, required, children, ...props }, ref) => {
    const autoId = useId();
    const selectId = id ?? autoId;
    return (
      <Field label={label} hint={hint} error={error} required={required} htmlFor={selectId}>
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            required={required}
            aria-invalid={error ? true : undefined}
            className={cn(CONTROL_CLASS, HEIGHT[size], 'appearance-none pr-9 cursor-pointer', error && CONTROL_ERROR, className)}
            {...props}
          >
            {children}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" aria-hidden />
        </div>
      </Field>
    );
  },
);
Select.displayName = 'Select';

/* ── Textarea ──────────────────────────────────────────────────────── */

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, className, id, required, rows = 4, ...props }, ref) => {
    const autoId = useId();
    const areaId = id ?? autoId;
    return (
      <Field label={label} hint={hint} error={error} required={required} htmlFor={areaId}>
        <textarea
          ref={ref}
          id={areaId}
          rows={rows}
          required={required}
          aria-invalid={error ? true : undefined}
          className={cn(CONTROL_CLASS, 'px-3 py-2 resize-y min-h-[80px]', error && CONTROL_ERROR, className)}
          {...props}
        />
      </Field>
    );
  },
);
Textarea.displayName = 'Textarea';

export default Input;
