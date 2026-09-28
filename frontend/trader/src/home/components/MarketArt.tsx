'use client';

import type { ArtKind } from '../data';

/**
 * Inline SVG compositions for the home page cards. Decorative only — every
 * caller sets a heading beside the art, so the SVGs are aria-hidden.
 *
 * All colour comes from the marketing tokens (accent orange, ink, surfaces)
 * so the art follows the theme without a second asset set. Each drawing is
 * a 400×300 viewBox stretched to fill its slot; the caller decides the
 * aspect ratio with the wrapping box.
 */

const ACCENT = 'var(--mk-accent)';
const ACCENT_SOFT = 'var(--mk-accent-soft)';
const INK = 'var(--mk-ink)';
const INK_SOFT = 'var(--mk-ink-soft)';
const LINE = 'var(--mk-line)';
const SURFACE = 'var(--mk-surface)';
const SURFACE_2 = 'var(--mk-surface-2)';
const UP = 'var(--mk-up)';
const DOWN = 'var(--mk-down)';
const MUTED = 'var(--mk-text-faint)';

function Grid() {
  return (
    <g stroke={LINE} strokeWidth="1">
      {[60, 120, 180, 240].map((y) => (
        <line key={y} x1="0" y1={y} x2="400" y2={y} />
      ))}
    </g>
  );
}

/** Candlestick strip — forex. */
function Forex() {
  const candles = [
    { x: 40,  o: 190, c: 150, h: 140, l: 200 },
    { x: 75,  o: 150, c: 165, h: 140, l: 175 },
    { x: 110, o: 165, c: 120, h: 110, l: 172 },
    { x: 145, o: 120, c: 135, h: 112, l: 145 },
    { x: 180, o: 135, c: 95,  h: 88,  l: 142 },
    { x: 215, o: 95,  c: 115, h: 90,  l: 125 },
    { x: 250, o: 115, c: 80,  h: 70,  l: 120 },
    { x: 285, o: 80,  c: 100, h: 74,  l: 108 },
    { x: 320, o: 100, c: 62,  h: 55,  l: 106 },
    { x: 355, o: 62,  c: 78,  h: 56,  l: 84 },
  ];
  return (
    <>
      <Grid />
      {candles.map(({ x, o, c, h, l }) => {
        const up = c < o;
        const top = Math.min(o, c);
        const height = Math.max(Math.abs(o - c), 3);
        return (
          <g key={x}>
            <line x1={x} y1={h} x2={x} y2={l} stroke={up ? UP : DOWN} strokeWidth="2" />
            <rect x={x - 8} y={top} width="16" height={height} rx="2" fill={up ? UP : DOWN} />
          </g>
        );
      })}
      <rect x="20" y="20" width="96" height="28" rx="14" fill={INK} />
      <text x="68" y="39" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff" fontFamily="var(--mk-font)">EUR/USD</text>
      <rect x="290" y="20" width="90" height="28" rx="14" fill={ACCENT_SOFT} />
      <text x="335" y="39" textAnchor="middle" fontSize="13" fontWeight="700" fill={ACCENT} fontFamily="var(--mk-font)">1.0842</text>
    </>
  );
}

/** Stacked bullion bars — gold and metals. */
function Metals() {
  const bar = (x: number, y: number, fill: string, stroke: string) => (
    <g key={`${x}-${y}`}>
      <polygon points={`${x},${y + 44} ${x + 18},${y} ${x + 102},${y} ${x + 120},${y + 44}`} fill={fill} stroke={stroke} strokeWidth="2" strokeLinejoin="round" />
      <line x1={x + 30} y1={y + 12} x2={x + 92} y2={y + 12} stroke={stroke} strokeWidth="2" opacity="0.5" />
    </g>
  );
  return (
    <>
      <ellipse cx="200" cy="248" rx="150" ry="16" fill={SURFACE_2} />
      {bar(70, 190, ACCENT, ACCENT)}
      {bar(210, 190, ACCENT, ACCENT)}
      {bar(140, 140, ACCENT_SOFT, ACCENT)}
      {bar(140, 90, SURFACE, INK_SOFT)}
      <rect x="20" y="20" width="76" height="28" rx="14" fill={INK} />
      <text x="58" y="39" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff" fontFamily="var(--mk-font)">XAUUSD</text>
      <text x="380" y="40" textAnchor="end" fontSize="13" fontWeight="700" fill={MUTED} fontFamily="var(--mk-font)">XAG · XPT · XPD</text>
    </>
  );
}

/** Rising area chart with volume bars — indices and energy. */
function Indices() {
  const line = 'M20,220 L60,200 L100,208 L140,170 L180,178 L220,130 L260,142 L300,96 L340,104 L380,60';
  return (
    <>
      <defs>
        <linearGradient id="mk-art-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.28" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0" />
        </linearGradient>
      </defs>
      <Grid />
      {[20, 60, 100, 140, 180, 220, 260, 300, 340].map((x, i) => (
        <rect key={x} x={x + 8} y={280 - (14 + ((i * 7) % 20))} width="24" height={14 + ((i * 7) % 20)} rx="2" fill={SURFACE_2} />
      ))}
      <path d={`${line} L380,280 L20,280 Z`} fill="url(#mk-art-area)" />
      <path d={line} fill="none" stroke={ACCENT} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="380" cy="60" r="6" fill={ACCENT} />
      <circle cx="380" cy="60" r="12" fill={ACCENT} opacity="0.2" />
      <rect x="20" y="20" width="70" height="28" rx="14" fill={INK} />
      <text x="55" y="39" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff" fontFamily="var(--mk-font)">US30</text>
      <rect x="100" y="20" width="70" height="28" rx="14" fill={SURFACE_2} />
      <text x="135" y="39" textAnchor="middle" fontSize="13" fontWeight="700" fill={INK} fontFamily="var(--mk-font)">USOIL</text>
    </>
  );
}

/** Hex nodes on a ledger chain — crypto. */
function Crypto() {
  const hex = (cx: number, cy: number, r: number) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    }).join(' ');
  return (
    <>
      <g stroke={LINE} strokeWidth="2">
        <line x1="80" y1="150" x2="200" y2="150" />
        <line x1="200" y1="150" x2="320" y2="150" />
        <line x1="200" y1="150" x2="140" y2="60" />
        <line x1="200" y1="150" x2="260" y2="240" />
      </g>
      <polygon points={hex(80, 150, 30)} fill={SURFACE} stroke={INK_SOFT} strokeWidth="2" />
      <polygon points={hex(320, 150, 30)} fill={SURFACE} stroke={INK_SOFT} strokeWidth="2" />
      <polygon points={hex(140, 60, 24)} fill={SURFACE_2} stroke={LINE} strokeWidth="2" />
      <polygon points={hex(260, 240, 24)} fill={SURFACE_2} stroke={LINE} strokeWidth="2" />
      <polygon points={hex(200, 150, 52)} fill={ACCENT} />
      <text x="200" y="163" textAnchor="middle" fontSize="34" fontWeight="800" fill="#fff" fontFamily="var(--mk-font)">B</text>
      <text x="80" y="155" textAnchor="middle" fontSize="12" fontWeight="700" fill={INK} fontFamily="var(--mk-font)">ETH</text>
      <text x="320" y="155" textAnchor="middle" fontSize="12" fontWeight="700" fill={INK} fontFamily="var(--mk-font)">SOL</text>
      <text x="140" y="64" textAnchor="middle" fontSize="11" fontWeight="700" fill={MUTED} fontFamily="var(--mk-font)">LTC</text>
      <text x="260" y="244" textAnchor="middle" fontSize="11" fontWeight="700" fill={MUTED} fontFamily="var(--mk-font)">XRP</text>
      <rect x="290" y="20" width="90" height="28" rx="14" fill={ACCENT_SOFT} />
      <text x="335" y="39" textAnchor="middle" fontSize="13" fontWeight="700" fill={ACCENT} fontFamily="var(--mk-font)">24/7</text>
    </>
  );
}

/** Master account mirrored to three followers — copy trading. */
function Copy() {
  const spark = 'M0,30 L12,22 L24,26 L36,14 L48,18 L60,6 L72,10 L84,2';
  const followers = [
    { x: 230, y: 60 },
    { x: 230, y: 150 },
    { x: 230, y: 240 },
  ];
  return (
    <>
      <g stroke={ACCENT} strokeWidth="2" strokeDasharray="6 6" fill="none">
        {followers.map(({ x, y }) => (
          <path key={y} d={`M150,150 C190,150 190,${y} ${x},${y}`} />
        ))}
      </g>
      <rect x="30" y="100" width="120" height="100" rx="14" fill={INK} />
      <text x="48" y="128" fontSize="11" fontWeight="700" fill="#fff" opacity="0.7" fontFamily="var(--mk-font)">MASTER</text>
      <text x="48" y="150" fontSize="18" fontWeight="800" fill="#fff" fontFamily="var(--mk-font)">+24.6%</text>
      <g transform="translate(48,160)" stroke={ACCENT} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={spark} />
      </g>
      {followers.map(({ x, y }) => (
        <g key={y}>
          <rect x={x} y={y - 30} width="140" height="60" rx="12" fill={SURFACE} stroke={LINE} strokeWidth="2" />
          <circle cx={x + 26} cy={y} r="12" fill={ACCENT_SOFT} />
          <circle cx={x + 26} cy={y - 4} r="4" fill={ACCENT} />
          <path d={`M${x + 17},${y + 8} a9,9 0 0 1 18,0`} fill={ACCENT} />
          <rect x={x + 48} y={y - 12} width="60" height="8" rx="4" fill={SURFACE_2} />
          <rect x={x + 48} y={y + 4} width="40" height="8" rx="4" fill={UP} opacity="0.6" />
        </g>
      ))}
    </>
  );
}

/** Multi-level referral tree — IB programme. */
function Network() {
  const l2 = [110, 200, 290];
  const l3 = [70, 130, 170, 230, 270, 330];
  return (
    <>
      <g stroke={LINE} strokeWidth="2">
        {l2.map((x) => <line key={`a${x}`} x1="200" y1="60" x2={x} y2="150" />)}
        {l3.map((x, i) => <line key={`b${x}`} x1={l2[Math.floor(i / 2)]} y1="150" x2={x} y2="240" />)}
      </g>
      <circle cx="200" cy="60" r="30" fill={ACCENT} />
      <text x="200" y="66" textAnchor="middle" fontSize="15" fontWeight="800" fill="#fff" fontFamily="var(--mk-font)">YOU</text>
      {l2.map((x) => (
        <g key={x}>
          <circle cx={x} cy="150" r="20" fill={INK} />
          <circle cx={x} cy="145" r="6" fill="#fff" />
          <path d={`M${x - 10},${162} a10,10 0 0 1 20,0`} fill="#fff" />
        </g>
      ))}
      {l3.map((x) => (
        <g key={x}>
          <circle cx={x} cy="240" r="14" fill={SURFACE} stroke={INK_SOFT} strokeWidth="2" />
          <circle cx={x} cy="236" r="4" fill={INK_SOFT} />
          <path d={`M${x - 7},${248} a7,7 0 0 1 14,0`} fill={INK_SOFT} />
        </g>
      ))}
      <rect x="292" y="20" width="88" height="28" rx="14" fill={ACCENT_SOFT} />
      <text x="336" y="39" textAnchor="middle" fontSize="12" fontWeight="700" fill={ACCENT} fontFamily="var(--mk-font)">PER LOT</text>
    </>
  );
}

/** Order ticket with a chart behind it — for traders. */
function Trader() {
  const line = 'M20,200 L60,180 L100,190 L140,150 L180,160 L220,110 L260,124 L300,86 L340,96 L380,54';
  return (
    <>
      <Grid />
      <path d={line} fill="none" stroke={INK_SOFT} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.7" />
      <rect x="220" y="70" width="160" height="200" rx="16" fill={SURFACE} stroke={LINE} strokeWidth="2" />
      <text x="240" y="98" fontSize="12" fontWeight="700" fill={MUTED} fontFamily="var(--mk-font)">XAUUSD</text>
      <text x="240" y="122" fontSize="18" fontWeight="800" fill={INK} fontFamily="var(--mk-font)">2318.50</text>
      <rect x="240" y="138" width="120" height="10" rx="5" fill={SURFACE_2} />
      <rect x="240" y="156" width="80" height="10" rx="5" fill={SURFACE_2} />
      <rect x="240" y="180" width="56" height="30" rx="8" fill={UP} />
      <text x="268" y="200" textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff" fontFamily="var(--mk-font)">BUY</text>
      <rect x="304" y="180" width="56" height="30" rx="8" fill={DOWN} />
      <text x="332" y="200" textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff" fontFamily="var(--mk-font)">SELL</text>
      <rect x="240" y="222" width="120" height="30" rx="8" fill={ACCENT} />
      <text x="300" y="242" textAnchor="middle" fontSize="12" fontWeight="800" fill="#fff" fontFamily="var(--mk-font)">SL / TP SET</text>
      <rect x="20" y="20" width="80" height="28" rx="14" fill={INK} />
      <text x="60" y="39" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff" fontFamily="var(--mk-font)">0.01 lot</text>
    </>
  );
}

/** Referral link card over an earnings bar chart — for partners. */
function Partner() {
  const bars = [40, 62, 54, 90, 84, 120, 108, 150];
  return (
    <>
      <Grid />
      {bars.map((h, i) => (
        <rect key={i} x={30 + i * 44} y={270 - h} width="28" height={h} rx="6" fill={i === bars.length - 1 ? ACCENT : SURFACE_2} />
      ))}
      <rect x="40" y="36" width="320" height="64" rx="14" fill={INK} />
      <circle cx="72" cy="68" r="14" fill={ACCENT} />
      <path d="M66,68 l4,4 l8,-8" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <text x="98" y="60" fontSize="11" fontWeight="700" fill="#fff" opacity="0.7" fontFamily="var(--mk-font)">YOUR REFERRAL LINK</text>
      <text x="98" y="82" fontSize="14" fontWeight="700" fill="#fff" fontFamily="var(--mk-font)">powertradefx.com/s/your-code</text>
      <rect x="292" y="120" width="88" height="28" rx="14" fill={ACCENT_SOFT} />
      <text x="336" y="139" textAnchor="middle" fontSize="12" fontWeight="700" fill={ACCENT} fontFamily="var(--mk-font)">EARNINGS</text>
    </>
  );
}

const ART: Record<ArtKind, () => React.ReactElement> = {
  forex: Forex,
  metals: Metals,
  indices: Indices,
  crypto: Crypto,
  copy: Copy,
  network: Network,
  trader: Trader,
  partner: Partner,
};

export function MarketArt({ kind, className }: { kind: ArtKind; className?: string }) {
  const Art = ART[kind];
  return (
    <svg
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
      focusable="false"
      className={className}
      style={{ display: 'block', width: '100%', height: '100%', background: 'var(--mk-bg-raised)' }}
    >
      <Art />
    </svg>
  );
}
