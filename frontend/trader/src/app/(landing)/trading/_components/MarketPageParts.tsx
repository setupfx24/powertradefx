'use client';

/**
 * Pieces shared by the four Trading → market pages (forex, metals &
 * energy, indices, crypto). Kept next to the pages rather than in
 * src/marketing/components because nothing outside /trading uses them.
 */
import Image from 'next/image';
import { BRAND_NAME } from '@/lib/brand';

export type InstrumentRow = {
  symbol: string;
  name: string;
  hours: string;
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: 'var(--mk-text-label)',
  letterSpacing: 'var(--mk-tracking-label)',
  textTransform: 'uppercase',
};

/** Four quick facts under the hero. */
export function StatStrip({ stats }: { stats: { label: string; value: string }[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
      {stats.map((s) => (
        <div key={s.label} className="mk-card text-center">
          <div
            className="font-extrabold"
            style={{ fontSize: 'var(--mk-text-h3)', color: 'var(--mk-accent)', lineHeight: 1.15 }}
          >
            {s.value}
          </div>
          <div className="mt-2" style={{ ...LABEL_STYLE, color: 'var(--mk-text-faint)' }}>
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The instrument table. Leverage and lot size are platform-wide facts;
 * spreads are variable and shown live on the watchlist, so the table
 * carries no spread figures.
 */
export function InstrumentTable({ rows }: { rows: InstrumentRow[] }) {
  const cell: React.CSSProperties = { fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text-muted)' };
  const mono: React.CSSProperties = { ...cell, fontFamily: 'var(--mk-font-mono)' };
  return (
    <div className="overflow-x-auto">
      <div
        className="min-w-[640px] overflow-hidden"
        style={{ border: '1px solid var(--mk-line)', borderRadius: 'var(--mk-radius-lg)' }}
      >
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {['Symbol', 'Instrument', 'Max leverage', 'Min lot', 'Trading hours'].map((h, i) => (
                <th
                  key={h}
                  className={i < 2 ? 'text-left px-5 py-4' : 'text-right px-5 py-4'}
                  style={{
                    ...LABEL_STYLE,
                    background: 'var(--mk-surface-2)',
                    color: 'var(--mk-accent)',
                    fontWeight: 700,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.symbol} style={{ borderTop: '1px solid var(--mk-line)', background: 'var(--mk-surface)' }}>
                <td className="px-5 py-4 font-semibold" style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text)', fontFamily: 'var(--mk-font-mono)' }}>{r.symbol}</td>
                <td className="px-5 py-4" style={cell}>{r.name}</td>
                <td className="px-5 py-4 text-right" style={mono}>1:500</td>
                <td className="px-5 py-4 text-right" style={mono}>0.01</td>
                <td className="px-5 py-4 text-right" style={cell}>{r.hours}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 mk-meta">
        Spreads are variable and shown live on the watchlist and order ticket before you confirm.
        Maximum leverage depends on your account group (default 1:100, up to 1:500). Lot sizes start at 0.01.
      </p>
    </div>
  );
}

/**
 * Inline candlestick composition in brand colours. Deterministic data so
 * the drawing is identical on server and client. `ticket` is the label
 * shown on the small order card in the corner.
 */
export function MarketIllustration({ symbol, side = 'Buy', ticket }: { symbol: string; side?: 'Buy' | 'Sell'; ticket: string }) {
  // [open, close, low, high] on a 0–100 scale; 16 candles across.
  const candles: [number, number, number, number][] = [
    [38, 46, 34, 49], [46, 42, 39, 50], [42, 52, 40, 55], [52, 49, 45, 56],
    [49, 58, 47, 61], [58, 54, 51, 62], [54, 63, 52, 66], [63, 60, 57, 68],
    [60, 55, 50, 62], [55, 61, 53, 64], [61, 70, 59, 73], [70, 66, 63, 74],
    [66, 74, 64, 78], [74, 71, 68, 80], [71, 79, 69, 83], [79, 84, 76, 88],
  ];
  const W = 640;
  const H = 360;
  const padX = 28;
  const padTop = 36;
  const padBottom = 44;
  const plotH = H - padTop - padBottom;
  const step = (W - padX * 2) / candles.length;
  const y = (v: number) => padTop + plotH - (v / 100) * plotH;
  const body = Math.max(6, step * 0.44);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Stylised ${symbol} price chart with an order ticket`}
      className="w-full h-auto"
      style={{ borderRadius: 'var(--mk-radius-lg)', display: 'block' }}
    >
      <rect x="0" y="0" width={W} height={H} fill="var(--mk-surface-2)" />
      {/* grid */}
      {[0, 25, 50, 75, 100].map((g) => (
        <line key={g} x1={padX} x2={W - padX} y1={y(g)} y2={y(g)} stroke="var(--mk-line)" strokeWidth="1" />
      ))}
      {/* symbol header */}
      <text x={padX} y={22} fill="var(--mk-text)" fontSize="14" fontWeight="700" fontFamily="var(--mk-font-mono)">{symbol}</text>
      <text x={padX + 92} y={22} fill="var(--mk-text-faint)" fontSize="11" fontFamily="var(--mk-font-mono)">H1</text>
      {/* candles */}
      {candles.map(([o, c, lo, hi], i) => {
        const cx = padX + step * i + step / 2;
        const up = c >= o;
        const top = y(Math.max(o, c));
        const bottom = y(Math.min(o, c));
        const fill = up ? 'var(--mk-accent)' : 'var(--mk-ink)';
        return (
          <g key={i}>
            <line x1={cx} x2={cx} y1={y(hi)} y2={y(lo)} stroke={fill} strokeWidth="1.5" />
            <rect x={cx - body / 2} y={top} width={body} height={Math.max(2, bottom - top)} fill={fill} rx="1.5" />
          </g>
        );
      })}
      {/* take-profit / stop-loss lines */}
      <line x1={padX} x2={W - padX} y1={y(92)} y2={y(92)} stroke="var(--mk-accent)" strokeWidth="1" strokeDasharray="5 4" />
      <text x={W - padX} y={y(92) - 5} textAnchor="end" fill="var(--mk-accent)" fontSize="10" fontFamily="var(--mk-font-mono)">TP</text>
      <line x1={padX} x2={W - padX} y1={y(30)} y2={y(30)} stroke="var(--mk-text-faint)" strokeWidth="1" strokeDasharray="5 4" />
      <text x={W - padX} y={y(30) - 5} textAnchor="end" fill="var(--mk-text-faint)" fontSize="10" fontFamily="var(--mk-font-mono)">SL</text>
      {/* order ticket card */}
      <g transform={`translate(${padX} ${H - padBottom + 6})`}>
        <rect x="0" y="0" width="300" height="30" rx="8" fill="var(--mk-bg)" stroke="var(--mk-line)" />
        <rect x="8" y="7" width="44" height="16" rx="4" fill={side === 'Buy' ? 'var(--mk-accent)' : 'var(--mk-ink)'} />
        <text x="30" y="19" textAnchor="middle" fill="#ffffff" fontSize="10" fontWeight="700" fontFamily="var(--mk-font-mono)">{side.toUpperCase()}</text>
        <text x="62" y="19" fill="var(--mk-text)" fontSize="11" fontFamily="var(--mk-font-mono)">{ticket}</text>
      </g>
    </svg>
  );
}

/** Real product shot of the web terminal, with a caption. */
export function TerminalShot({ alt }: { alt: string }) {
  return (
    <figure className="mx-auto max-w-5xl">
      <div className="overflow-hidden" style={{ borderRadius: 'var(--mk-radius-lg)', border: '1px solid var(--mk-line)' }}>
        <Image
          src="/marketing/screens/terminal.png"
          alt={alt}
          width={1600}
          height={1000}
          sizes="(max-width: 1024px) 100vw, 1024px"
          className="block h-auto w-full"
        />
      </div>
      <figcaption className="mk-meta mt-3 text-center">
        The {BRAND_NAME} web terminal: TradingView-powered charts, live watchlist, order ticket and account panel.
      </figcaption>
    </figure>
  );
}

/** The risk line every marketing page carries. */
export function RiskNote() {
  return (
    <div className="mk-container" style={{ paddingTop: 'var(--mk-space-6)', paddingBottom: 'var(--mk-space-8)' }}>
      <p className="mk-meta mx-auto max-w-3xl text-center">
        Trading leveraged products such as forex and CFDs carries a high level of risk and may not be suitable
        for all investors. You could lose more than your initial deposit.
      </p>
    </div>
  );
}
