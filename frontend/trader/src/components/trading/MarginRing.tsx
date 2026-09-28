'use client';

// Compact circular progress ring for the trader's Margin Level. Plain
// SVG, no chart library. The percentage is what the broker normally
// shows — equity / margin_used × 100. Above 200% = healthy (success),
// 100-200% = warning, < 100% = danger (near stop-out).
//
// Visual fill scales to a "safety ceiling" of 500% — anything at or
// above that shows a fully-closed ring (so a healthy 1000% account
// reads as "full / safe" rather than "60% of some arbitrary 1000% cap").
// Colour still encodes the absolute state (danger / warning / success).

import { memo } from 'react';
import { clsx } from 'clsx';

interface Props {
  /** Live margin level percentage (e.g. 1076.21 for 1076.21%). */
  marginLevel: number;
  /** Pixel size of the square SVG; default tuned for the positions header strip. */
  size?: number;
  className?: string;
}

/** Status token classes for the arc (stroke) and the value (text). */
function toneFor(pct: number): { stroke: string; text: string } {
  if (!Number.isFinite(pct) || pct <= 0) return { stroke: 'stroke-text-tertiary', text: 'text-text-tertiary' };
  if (pct < 100) return { stroke: 'stroke-danger', text: 'text-danger' };     // sub-100% → near stop-out
  if (pct < 200) return { stroke: 'stroke-warning', text: 'text-warning' };   // 100-200% → squeeze warning
  return { stroke: 'stroke-success', text: 'text-success' };                  // > 200% → healthy
}

function MarginRingInner({ marginLevel, size = 64, className }: Props) {
  const stroke = Math.max(4, Math.round(size * 0.11));
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  // Fill saturates at 500% — anything ≥ 500% reads as a full ring (safe).
  // Below 500% the arc shrinks linearly, so the visual fill correlates
  // with the colour band: danger < 100% (~20% arc), warning 100–200%
  // (20–40% arc), success ≥ 200% (40%+ arc, full at 500%).
  const fill = Math.max(0, Math.min(1, (marginLevel || 0) / 500));
  const dashOffset = circumference * (1 - fill);
  const tone = toneFor(marginLevel);

  const labelPct = Number.isFinite(marginLevel) ? marginLevel : 0;
  const labelText = labelPct >= 1000
    ? `${(labelPct / 1000).toFixed(1)}k%`
    : `${labelPct.toFixed(0)}%`;

  // Shrink the value font so long labels (e.g. "13.5k%") never overflow the
  // ring's inner diameter. Inner width ≈ size - 2*stroke; mono glyphs are
  // ~0.62em wide, so cap the font at what fits the label's char count.
  const innerWidth = size - 2 * stroke;
  const valueFont = Math.max(
    9,
    Math.min(
      Math.round(size * 0.22),
      Math.floor((innerWidth * 0.92) / (labelText.length * 0.62)),
    ),
  );

  return (
    <div
      className={clsx('relative flex items-center justify-center', className)}
      style={{ width: size, height: size }}
      title={`Margin Level: ${labelPct.toFixed(2)}%`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          className="stroke-border-primary"
          strokeWidth={stroke}
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          className={clsx('transition-[stroke-dashoffset,stroke] duration-500 ease-out', tone.stroke)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-0.5">
        <span
          className="uppercase tracking-wider text-text-tertiary leading-none font-semibold"
          style={{ fontSize: Math.max(7, Math.round(size * 0.13)) }}
        >
          Margin
        </span>
        <span
          className={clsx('font-extrabold font-mono tabular-nums leading-none mt-0.5', tone.text)}
          style={{ fontSize: valueFont }}
        >
          {labelText}
        </span>
      </div>
    </div>
  );
}

export default memo(MarginRingInner);
