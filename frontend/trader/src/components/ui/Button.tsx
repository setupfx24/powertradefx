'use client';

import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ButtonVariant =
  | 'primary'   // brand orange — the one CTA per view
  | 'secondary' // raised neutral — default action
  | 'outline'   // bordered neutral
  | 'ghost'     // text only, hover surface
  | 'danger'    // destructive
  | 'buy'       // green fill (trade side)
  | 'sell'      // red fill (trade side)
  | 'link';     // inline text link

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  /** Square button holding a single icon. Provide `aria-label`. */
  iconOnly?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const BASE =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap select-none font-semibold rounded-md border border-transparent ' +
  'transition-[background-color,border-color,color,box-shadow,transform] duration-150 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base ' +
  'active:translate-y-px disabled:pointer-events-none disabled:opacity-50';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-text-on-accent hover:bg-accent-hover shadow-sm',
  secondary: 'bg-bg-tertiary text-text-primary border-border-primary hover:bg-bg-hover hover:border-border-strong',
  outline: 'bg-transparent text-text-primary border-border-strong hover:bg-bg-hover',
  ghost: 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-hover',
  danger: 'bg-danger/10 text-danger border-danger/25 hover:bg-danger/20',
  buy: 'bg-buy text-text-inverse hover:bg-buy-light shadow-sm',
  sell: 'bg-sell text-text-on-accent hover:bg-sell-light shadow-sm',
  link: 'bg-transparent text-accent hover:text-accent-hover underline-offset-4 hover:underline !h-auto !px-0',
};

const SIZES: Record<ButtonSize, string> = {
  xs: 'h-7 px-2.5 text-xs',
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
  lg: 'h-11 px-5 text-md',
};

const ICON_ONLY: Record<ButtonSize, string> = {
  xs: 'h-7 w-7 !px-0',
  sm: 'h-8 w-8 !px-0',
  md: 'h-9 w-9 !px-0',
  lg: 'h-11 w-11 !px-0',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      fullWidth,
      loading,
      iconOnly,
      leftIcon,
      rightIcon,
      className,
      children,
      disabled,
      type = 'button',
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(BASE, VARIANTS[variant], iconOnly ? ICON_ONLY[size] : SIZES[size], fullWidth && 'w-full', className)}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  ),
);
Button.displayName = 'Button';

export default Button;
