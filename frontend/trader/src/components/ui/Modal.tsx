'use client';

import { useEffect, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl';
  className?: string;
  /** Override header row (title + close). */
  headerClassName?: string;
  /** Override body wrapper around children. */
  bodyClassName?: string;
}

const WIDTHS: Record<NonNullable<ModalProps['width']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
};

/** Centered dialog: overlay + card sheet. Closes on Escape / overlay click. */
export default function Modal({
  open,
  onClose,
  title,
  children,
  width = 'md',
  className,
  headerClassName,
  bodyClassName,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent background scroll while modal is open.
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = prev;
      };
    }
  }, [open, handleKeyDown]);

  if (!open || !mounted) return null;

  // Portal into document.body so an ancestor with `transform`/`will-change`/`filter`
  // doesn't steal `position: fixed` (CSS containing-block rule). This keeps the
  // modal centered in the viewport regardless of page scroll position.
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-bg-overlay" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full max-h-[90vh] overflow-y-auto bg-card border border-border-primary rounded-sheet shadow-lg animate-fade-in',
          WIDTHS[width],
          className,
        )}
      >
        {title && (
          <div
            className={cn(
              'flex items-center justify-between gap-3 px-4 py-3 border-b border-border-primary sticky top-0 bg-card z-10',
              headerClassName,
            )}
          >
            <h3 className="text-md font-semibold text-text-primary truncate">{title}</h3>
            <Button variant="ghost" size="sm" iconOnly aria-label="Close dialog" onClick={onClose}>
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        )}
        <div className={cn('p-4', bodyClassName)}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
