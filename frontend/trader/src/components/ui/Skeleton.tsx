import { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

/** Loading placeholder. Size it with width/height classes. */
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn(
        'rounded-md bg-bg-hover animate-shimmer',
        'bg-[linear-gradient(90deg,transparent_0%,var(--bg-active)_50%,transparent_100%)] bg-[length:200%_100%]',
        className,
      )}
      {...props}
    />
  );
}

/** N stacked text lines. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)} aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  );
}

export default Skeleton;
