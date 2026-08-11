'use client';

import { useCallback, useRef, useState } from 'react';
import { clsx } from 'clsx';

/** `vertical` = drag left/right, `col-resize` (splits columns). `horizontal` = drag up/down, `row-resize`. */
export type PanelResizeAxis = 'vertical' | 'horizontal';

export interface PanelResizeHandleProps {
  axis: PanelResizeAxis;
  /** Movement from pointer-down (px), same as previous terminal handles. */
  onDrag: (totalDelta: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  /** Grab zone thickness (px). Keeps cursor scoped to this node; chart sits below in z-order. */
  hitSize?: number;
  className?: string;
}

/**
 * Split-pane resize: centered hairline, wider hit target, z-index above chart canvas.
 * Cursor/col-resize applies only while pointer is over this element; body cursor during drag only.
 */
export default function PanelResizeHandle({
  axis,
  onDrag,
  onDragStart,
  onDragEnd,
  hitSize = 8,
  className,
}: PanelResizeHandleProps) {
  const [hover, setHover] = useState(false);
  const [dragging, setDragging] = useState(false);
  const startCoord = useRef(0);
  const dragActive = useRef(false);

  const isVertical = axis === 'vertical';
  const cursor = isVertical ? 'col-resize' : 'row-resize';

  const endDrag = useCallback(() => {
    if (!dragActive.current) return;
    dragActive.current = false;
    setDragging(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    (document.body.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = '';
    onDragEnd?.();
  }, [onDragEnd]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const el = e.currentTarget;
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      startCoord.current = isVertical ? e.clientX : e.clientY;
      dragActive.current = true;
      setDragging(true);
      onDragStart?.();

      document.body.style.cursor = cursor;
      document.body.style.userSelect = 'none';
      (document.body.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = 'none';

      const onMove = (ev: PointerEvent) => {
        if (!dragActive.current) return;
        ev.preventDefault();
        const cur = isVertical ? ev.clientX : ev.clientY;
        onDrag(cur - startCoord.current);
      };

      const finish = () => {
        try {
          el.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        window.removeEventListener('blur', onBlur);
        endDrag();
      };

      const onUp = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        finish();
      };

      const onBlur = () => {
        finish();
      };

      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
      window.addEventListener('blur', onBlur);
    },
    [cursor, endDrag, isVertical, onDrag, onDragStart],
  );

  const lineClass = clsx(
    'pointer-events-none rounded-full transition-[width,height,background-color] duration-150',
    isVertical ? 'absolute top-0 bottom-0 left-1/2 -translate-x-1/2' : 'absolute left-0 right-0 top-1/2 -translate-y-1/2',
    dragging
      ? clsx('bg-accent', isVertical ? 'w-[3px]' : 'h-[3px]')
      : hover
        ? clsx('bg-accent/60', isVertical ? 'w-[2px]' : 'h-[2px]')
        : clsx('bg-border-primary', isVertical ? 'w-[2px]' : 'h-[2px]'),
  );

  // Grip dots — three small dots in the centre to signal "drag me".
  // Visible always so users find the handle without hover hunting.
  const dotClass = clsx(
    'pointer-events-none rounded-full transition-colors duration-150',
    dragging ? 'bg-accent' : hover ? 'bg-accent/60' : 'bg-border-secondary',
    'w-[3px] h-[3px]',
  );

  return (
    <>
      <div
        role="separator"
        aria-orientation={isVertical ? 'vertical' : 'horizontal'}
        aria-label={isVertical ? 'Resize panel width' : 'Resize panel height'}
        onPointerDown={onPointerDown}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => {
          if (!dragActive.current) setHover(false);
        }}
        style={isVertical ? { width: hitSize } : { height: hitSize }}
        className={clsx(
          'shrink-0 relative z-[35] touch-none select-none bg-transparent group',
          isVertical ? 'cursor-col-resize' : 'cursor-row-resize',
          className,
        )}
      >
        <span className={lineClass} aria-hidden />
        <span
          aria-hidden
          className={clsx(
            'pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-[3px]',
            isVertical ? 'flex-col' : 'flex-row',
          )}
        >
          <span className={dotClass} />
          <span className={dotClass} />
          <span className={dotClass} />
        </span>
      </div>
      {/* While dragging, lay an invisible full-viewport overlay so the
          TradingView iframe (and any other embed) can't capture
          pointermove events away from our listener. */}
      {dragging && (
        <div
          aria-hidden
          className="fixed inset-0 z-[60]"
          style={{ cursor }}
        />
      )}
    </>
  );
}
