'use client';

/**
 * Live price widgets for the landing page. Polls the public
 * /api/v1/instruments/prices/all endpoint (same-origin proxy) every 5s;
 * falls back to static seed prices when the gateway is unreachable so
 * the page never looks broken.
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLandingLang } from './i18n';

type Tick = { symbol: string; bid: number; ask: number };

const SEED: Tick[] = [
  { symbol: 'EURUSD', bid: 1.0842, ask: 1.0843 },
  { symbol: 'GBPUSD', bid: 1.2661, ask: 1.2662 },
  { symbol: 'USDJPY', bid: 155.32, ask: 155.33 },
  { symbol: 'XAUUSD', bid: 2412.5, ask: 2412.9 },
  { symbol: 'BTCUSD', bid: 64850, ask: 64860 },
  { symbol: 'ETHUSD', bid: 1913.4, ask: 1913.9 },
  { symbol: 'US500', bid: 5490.2, ask: 5490.7 },
  { symbol: 'USOIL', bid: 77.2, ask: 77.25 },
];

const NAMES: Record<string, string> = {
  EURUSD: 'Euro / US Dollar', GBPUSD: 'Pound / US Dollar', USDJPY: 'US Dollar / Yen',
  XAUUSD: 'Gold', XAGUSD: 'Silver', BTCUSD: 'Bitcoin', ETHUSD: 'Ethereum',
  SOLUSD: 'Solana', US500: 'S&P 500', US30: 'Dow Jones 30', NAS100: 'Nasdaq 100',
  USOIL: 'Crude Oil (WTI)', GER40: 'DAX 40', UK100: 'FTSE 100',
};

function fmt(n: number) {
  if (n >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (n >= 100) return n.toFixed(3);
  return n.toFixed(5);
}

export function usePrices(): { ticks: Tick[]; flash: Record<string, 1 | -1> } {
  const [ticks, setTicks] = useState<Tick[]>(SEED);
  const [flash, setFlash] = useState<Record<string, 1 | -1>>({});
  const prev = useRef<Record<string, number>>({});
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch('/api/v1/instruments/prices/all', { cache: 'no-store' });
        if (!r.ok) return;
        const data: Tick[] = await r.json();
        if (!alive || !Array.isArray(data) || data.length === 0) return;
        const fl: Record<string, 1 | -1> = {};
        for (const t of data) {
          const p = prev.current[t.symbol];
          if (p !== undefined && t.bid !== p) fl[t.symbol] = t.bid > p ? 1 : -1;
          prev.current[t.symbol] = t.bid;
        }
        setTicks(data);
        setFlash(fl);
      } catch { /* keep seeds */ }
    };
    load();
    const id = setInterval(load, 5000);
    return () => { alive = false; clearInterval(id); };
  }, []);
  return { ticks, flash };
}

export function MarketsTable() {
  const { t } = useLandingLang();
  const { ticks, flash } = usePrices();
  const order = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD', 'ETHUSD', 'US500', 'NAS100', 'USOIL'];
  const rows = order
    .map((s) => ticks.find((x) => x.symbol === s))
    .filter((x): x is Tick => Boolean(x));
  return (
    <div className="rounded-2xl lx-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-[0.14em] text-gray-500 border-b border-white/5">
            <th className="px-5 py-3.5 font-semibold">{t('mkt.symbol')}</th>
            <th className="px-5 py-3.5 font-semibold text-right">{t('mkt.bid')}</th>
            <th className="px-5 py-3.5 font-semibold text-right hidden sm:table-cell">{t('mkt.ask')}</th>
            <th className="px-5 py-3.5 font-semibold text-right hidden md:table-cell">{t('mkt.spread')}</th>
            <th className="px-5 py-3.5" />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.symbol} className="border-b border-white/5 last:border-0 hover:bg-white/[0.03] transition-colors">
              <td className="px-5 py-3.5">
                <span className="font-semibold text-white">{r.symbol}</span>
                <span className="hidden sm:inline text-gray-500 ml-2 text-xs">{NAMES[r.symbol] ?? ''}</span>
              </td>
              <td className={`px-5 py-3.5 text-right font-mono tabular-nums transition-colors ${
                flash[r.symbol] === 1 ? 'text-emerald-400' : flash[r.symbol] === -1 ? 'text-red-400' : 'text-gray-200'
              }`}>
                {fmt(r.bid)}
              </td>
              <td className="px-5 py-3.5 text-right font-mono tabular-nums text-gray-400 hidden sm:table-cell">
                {fmt(r.ask)}
              </td>
              <td className="px-5 py-3.5 text-right font-mono tabular-nums text-gray-500 hidden md:table-cell">
                {(r.ask - r.bid) <= 0 ? '0.0' : (r.ask - r.bid).toFixed(r.bid >= 100 ? 2 : 5)}
              </td>
              <td className="px-5 py-3.5 text-right">
                <Link
                  href="/auth/register"
                  className="text-xs font-semibold text-accent hover:text-accent-light transition-colors"
                >
                  {t('mkt.trade')} →
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
