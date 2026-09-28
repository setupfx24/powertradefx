import { HTMLAttributes, ReactNode, forwardRef } from 'react';
import { cn } from '@/lib/utils';

type Padding = 'none' | 'sm' | 'md' | 'lg';

const PADDING: Record<Padding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4 md:p-5',
  lg: 'p-5 md:p-6',
};

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: Padding;
  /** Hover lift + pointer for clickable cards. */
  interactive?: boolean;
  /** Nested surface (one step darker), for cards inside cards. */
  nested?: boolean;
}

/** The one surface for content blocks: card background, hairline border, 10px radius. */
export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ padding = 'md', interactive, nested, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-lg border border-border-primary',
        nested ? 'bg-card-nested' : 'bg-card',
        interactive && 'cursor-pointer transition-[border-color,transform,box-shadow] duration-150 hover:border-border-strong hover:shadow-md',
        PADDING[padding],
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = 'Card';

export interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  description?: ReactNode;
  /** Small uppercase label above the title. */
  eyebrow?: ReactNode;
  actions?: ReactNode;
}

export function CardHeader({ title, description, eyebrow, actions, className, children, ...props }: CardHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-3 mb-4', className)} {...props}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xxs font-bold uppercase tracking-[0.12em] text-text-tertiary mb-1">{eyebrow}</p>
        )}
        {title && <h3 className="text-md font-semibold text-text-primary leading-tight truncate">{title}</h3>}
        {description && <p className="text-sm text-text-secondary mt-1">{description}</p>}
        {children}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('min-w-0', className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mt-4 pt-4 border-t border-border-secondary flex items-center justify-end gap-2', className)}
      {...props}
    />
  );
}

export default Card;
