'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { Info, Calculator, RotateCcw, Search, ChevronDown, X } from 'lucide-react';
import { useTradingStore, type InstrumentInfo } from '@/stores/tradingStore';
import { Button, Card, Field, Input, Select, Tabs } from '@/components/ui';

type CalcTab = 'margin' | 'pnl' | 'lotsize' | 'swap';

const TABS: { id: CalcTab; label: string }[] = [
  { id: 'margin', label: 'Margin' },
  { id: 'pnl', label: 'P&L' },
  { id: 'lotsize', label: 'Lot Size' },
  { id: 'swap', label: 'Swap' },
];

/* ─── Compact field row ─── */
function Row({
  label,
  tip,
  children,
}: {
  label: string;
  tip?: string;
  children: React.ReactNode;
}) {
  return (
    <Field
      label={
        <span className="inline-flex items-center gap-1">
          {label}
          {tip && (
            <span className="cursor-help" title={tip}>
              <Info size={11} className="text-text-tertiary" aria-hidden />
            </span>
          )}
        </span>
      }
    >
      {children}
    </Field>
  );
}

function CompactSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <Select size="sm" value={value} onChange={(e) => onChange(e.target.value)}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </Select>
  );
}

function CompactInput({
  value,
  onChange,
  placeholder,
  suffix,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  suffix?: string;
}) {
  return (
    <Input
      type="number"
      size="sm"
      numeric
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      suffix={suffix}
      className="font-bold"
    />
  );
}

/** Read-only value shown in the same slot as an input (balance, leverage). */
function ReadOnlyValue({ children, tone }: { children: React.ReactNode; tone?: 'accent' }) {
  return (
    <div
      className={clsx(
        'h-8 flex items-center rounded-md px-2.5 text-xs font-mono font-bold tabular-nums bg-bg-tertiary border border-border-primary',
        tone === 'accent' ? 'text-accent' : 'text-text-primary',
      )}
    >
      {children}
    </div>
  );
}

/* ─── Compact searchable instrument picker ─── */
function CompactInstrumentPicker({
  value,
  onChange,
  instruments,
}: {
  value: string;
  onChange: (v: string) => void;
  instruments: InstrumentInfo[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const filtered = instruments.filter((i) =>
    i.symbol.toLowerCase().includes(search.toLowerCase()) ||
    i.display_name.toLowerCase().includes(search.toLowerCase()) ||
    i.segment.toLowerCase().includes(search.toLowerCase())
  );

  const current = instruments.find((i) => i.symbol === value);

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="secondary"
        size="sm"
        fullWidth
        onClick={() => { setOpen(!open); setSearch(''); }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="!justify-between font-medium"
        rightIcon={<ChevronDown size={12} className={clsx('text-text-tertiary shrink-0 transition-transform', open && 'rotate-180')} aria-hidden />}
      >
        <span className="truncate">{current?.symbol || 'Select Instrument'}</span>
      </Button>
      {open && (
        <div className="absolute top-full left-0 z-50 w-full mt-1 rounded-lg overflow-hidden shadow-lg bg-card border border-border-primary">
          <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border-primary bg-bg-secondary">
            <div className="flex-1 min-w-0">
              <Input
                ref={inputRef}
                type="text"
                size="sm"
                icon={<Search size={12} aria-hidden />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                aria-label="Search instruments"
              />
            </div>
            {search && (
              <Button variant="ghost" size="xs" iconOnly onClick={() => setSearch('')} aria-label="Clear search">
                <X size={11} aria-hidden />
              </Button>
            )}
          </div>
          <div className="max-h-[180px] overflow-y-auto" role="listbox">
            {filtered.length > 0 ? filtered.map((inst) => (
              <button
                key={inst.symbol}
                type="button"
                role="option"
                aria-selected={inst.symbol === value}
                onClick={() => { onChange(inst.symbol); setOpen(false); setSearch(''); }}
                className={clsx(
                  'w-full flex items-center justify-between px-2 py-1.5 text-left transition-colors hover:bg-bg-hover',
                  inst.symbol === value ? 'text-accent' : 'text-text-secondary',
                )}
              >
                <span className="text-xs font-semibold font-mono">{inst.symbol}</span>
                <span className="text-xxs text-text-tertiary">{inst.segment}</span>
              </button>
            )) : (
              <div className="px-2 py-3 text-center text-xxs text-text-tertiary">No results</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RiskCalculator() {
  // Narrow selectors: needs live `prices` for the calc inputs but no longer
  // re-renders on unrelated store slices (positions, orders, ...).
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const prices = useTradingStore((s) => s.prices);
  const instruments = useTradingStore((s) => s.instruments);
  const activeAccount = useTradingStore((s) => s.activeAccount);
  const accounts = useTradingStore((s) => s.accounts);

  const [tab, setTab] = useState<CalcTab>('margin');
  const [selectedAccountId, setSelectedAccountId] = useState(activeAccount?.id ?? '');
  const [symbol, setSymbol] = useState(selectedSymbol || 'EURUSD');

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) || activeAccount;
  const instrumentInfo = instruments.find((i: InstrumentInfo) => i.symbol === symbol);
  const tick = prices[symbol];
  const digits = instrumentInfo?.digits ?? 5;
  const pipSize = instrumentInfo?.pip_size ?? 0.0001;
  const contractSize = instrumentInfo?.contract_size ?? 100000;
  const balance = selectedAccount?.balance ?? 10000;
  const accountLeverage = selectedAccount?.leverage ?? 100;
  const [side, setSide] = useState('buy');
  const [lots, setLots] = useState('0.01');
  const [entryPrice, setEntryPrice] = useState('');
  const [exitPrice, setExitPrice] = useState('');
  const [riskPercent, setRiskPercent] = useState('1');
  const [stopLoss, setStopLoss] = useState('');
  const [daysHeld, setDaysHeld] = useState('1');

  const livePrice = tick ? (side === 'buy' ? tick.ask : tick.bid) : 0;

  // ── Margin ──
  const marginResult = useMemo(() => {
    const ep = parseFloat(entryPrice) || livePrice;
    const lev = accountLeverage;
    const lot = parseFloat(lots) || 0;
    if (!ep || !lot) return null;
    return { margin: (lot * contractSize * ep) / lev, ep, lot, lev };
  }, [entryPrice, accountLeverage, lots, livePrice, contractSize]);

  // ── P&L ──
  const pnlResult = useMemo(() => {
    const ep = parseFloat(entryPrice);
    const xp = parseFloat(exitPrice);
    const lot = parseFloat(lots) || 0;
    if (!ep || !xp || !lot) return null;
    const pips = side === 'buy' ? (xp - ep) / pipSize : (ep - xp) / pipSize;
    const pipVal = (pipSize / ep) * contractSize;
    return { pnl: lot * pips * pipVal, pips, pipVal };
  }, [entryPrice, exitPrice, lots, side, pipSize, contractSize]);

  // ── Lot Size ──
  const lotResult = useMemo(() => {
    const ep = parseFloat(entryPrice) || livePrice;
    const sl = parseFloat(stopLoss);
    const rp = parseFloat(riskPercent);
    if (!ep || !sl || !rp || ep <= 0 || sl <= 0) return null;
    const riskAmt = balance * (rp / 100);
    const slPips = Math.abs(ep - sl) / pipSize;
    if (slPips <= 0) return null;
    const pipVal = (pipSize / ep) * contractSize;
    return { lotSize: Math.max(0.01, parseFloat((riskAmt / (slPips * pipVal)).toFixed(2))), riskAmt, slPips, pipVal };
  }, [entryPrice, stopLoss, riskPercent, balance, livePrice, pipSize, contractSize]);

  // ── Swap ──
  const swapResult = useMemo(() => {
    const lot = parseFloat(lots) || 0;
    const days = parseInt(daysHeld) || 1;
    if (!lot) return null;
    const dailySwap = lot * 0.5 * ((pipSize / (tick?.bid || 1)) * contractSize);
    return { dailySwap, totalSwap: dailySwap * days, days };
  }, [lots, daysHeld, tick, pipSize, contractSize]);

  // Current result
  const resultLabel =
    tab === 'margin' ? 'Required Margin' :
    tab === 'pnl' ? (pnlResult && pnlResult.pnl >= 0 ? 'Profit' : 'Loss') :
    tab === 'lotsize' ? 'Lot Size' : 'Est. Swap';

  const resultValue =
    tab === 'margin' ? (marginResult ? `$${marginResult.margin.toFixed(2)}` : '$0.00') :
    tab === 'pnl' ? (pnlResult ? `${pnlResult.pnl >= 0 ? '+' : '-'}$${Math.abs(pnlResult.pnl).toFixed(2)}` : '$0.00') :
    tab === 'lotsize' ? (lotResult ? lotResult.lotSize.toFixed(2) : '0.00') :
    (swapResult ? `$${swapResult.totalSwap.toFixed(2)}` : '$0.00');

  // P/L result is signed (success / danger); every other result is a neutral figure.
  const resultTone =
    tab === 'pnl' && pnlResult
      ? (pnlResult.pnl >= 0 ? 'text-success' : 'text-danger')
      : 'text-text-primary';

  const resultDetails: { l: string; v: string }[] =
    tab === 'margin' && marginResult ? [
      { l: 'Lots', v: marginResult.lot.toFixed(2) },
      { l: 'Leverage', v: `1:${marginResult.lev}` },
      { l: 'Price', v: marginResult.ep.toFixed(digits) },
    ] :
    tab === 'pnl' && pnlResult ? [
      { l: 'Pips', v: pnlResult.pips.toFixed(1) },
      { l: 'Pip Value', v: `$${pnlResult.pipVal.toFixed(4)}` },
    ] :
    tab === 'lotsize' && lotResult ? [
      { l: 'Risk', v: `$${lotResult.riskAmt.toFixed(2)}` },
      { l: 'SL Pips', v: lotResult.slPips.toFixed(1) },
    ] :
    tab === 'swap' && swapResult ? [
      { l: 'Daily', v: `$${swapResult.dailySwap.toFixed(4)}` },
      { l: 'Days', v: String(swapResult.days) },
    ] : [];

  const handleReset = () => {
    setEntryPrice('');
    setExitPrice('');
    setLots('0.01');
    setStopLoss('');
    setRiskPercent('1');
    setDaysHeld('1');
  };

  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden bg-bg-base">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-2.5 py-2 border-b border-border-primary bg-bg-secondary">
        <div className="flex items-center gap-2">
          <Calculator size={14} className="text-accent" aria-hidden />
          <span className="text-xs font-bold text-text-primary">Risk Calculator</span>
        </div>
        <Button variant="ghost" size="xs" iconOnly onClick={handleReset} title="Reset" aria-label="Reset calculator">
          <RotateCcw size={12} aria-hidden />
        </Button>
      </div>

      <div className="h-px w-full shrink-0 bg-accent" aria-hidden />

      {/* Tabs */}
      <div className="shrink-0 px-1.5 py-1.5 border-b border-border-primary bg-bg-secondary">
        <Tabs
          variant="pills"
          size="sm"
          fullWidth
          aria-label="Calculator"
          tabs={TABS}
          active={tab}
          onChange={(id) => setTab(id as CalcTab)}
        />
      </div>

      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain scrollbar-none">
        <div className="px-2.5 py-2.5 space-y-2.5">

          {/* Account */}
          <Row label="Account" tip="Select your trading account">
            <CompactSelect
              value={selectedAccountId}
              onChange={setSelectedAccountId}
              options={accounts.map((a) => ({ value: a.id, label: `${a.account_number} — $${a.balance.toFixed(2)}${a.is_demo ? ' (D)' : ''}` }))}
              placeholder="Select Account"
            />
          </Row>

          {/* Direction (margin uses it for live price, P&L for calc) */}
          {(tab === 'margin' || tab === 'pnl') && (
            <Row label="Direction" tip="Buy or Sell">
              <CompactSelect
                value={side}
                onChange={setSide}
                options={[{ value: 'buy', label: 'Buy' }, { value: 'sell', label: 'Sell' }]}
              />
            </Row>
          )}

          {/* Lot Size: Balance */}
          {tab === 'lotsize' && (
            <Row label="Account Balance" tip="Your balance">
              <ReadOnlyValue tone="accent">${balance.toFixed(2)}</ReadOnlyValue>
            </Row>
          )}

          {/* Instrument with search */}
          <Row label="Instrument" tip="Search instruments">
            <CompactInstrumentPicker value={symbol} onChange={setSymbol} instruments={instruments} />
          </Row>

          {/* Entry Price */}
          <Row label="Entry Price" tip="Enter your entry price">
            <CompactInput
              value={entryPrice}
              onChange={setEntryPrice}
              placeholder="Enter Entry Price"
            />
          </Row>

          {/* Exit Price — only for P&L */}
          {tab === 'pnl' && (
            <Row label="Exit Price" tip="Enter your exit / TP price">
              <CompactInput
                value={exitPrice}
                onChange={setExitPrice}
                placeholder="Enter Exit Price"
              />
            </Row>
          )}

          {/* Margin-specific */}
          {tab === 'margin' && (
            <>
              <Row label="Leverage" tip="Account leverage">
                <ReadOnlyValue>1:{accountLeverage}</ReadOnlyValue>
              </Row>
              <Row label="Lot Size" tip="Position size">
                <CompactInput value={lots} onChange={setLots} placeholder="Enter Size" />
              </Row>
            </>
          )}

          {/* P&L-specific */}
          {tab === 'pnl' && (
            <>
              <Row label="Lot Size" tip="Position size">
                <CompactInput value={lots} onChange={setLots} placeholder="Enter Size" />
              </Row>
            </>
          )}

          {/* Lot Size-specific */}
          {tab === 'lotsize' && (
            <>
              <Row label="Risk %" tip="% of balance to risk">
                <CompactInput value={riskPercent} onChange={setRiskPercent} placeholder="1" suffix="%" />
              </Row>
              <Row label="Stop Loss Price" tip="SL level">
                <CompactInput value={stopLoss} onChange={setStopLoss} placeholder="Enter SL price" />
              </Row>
            </>
          )}

          {/* Swap-specific */}
          {tab === 'swap' && (
            <>
              <Row label="Lot Size" tip="Position size">
                <CompactInput value={lots} onChange={setLots} placeholder="Enter Size" />
              </Row>
              <Row label="Days Held" tip="Days position open">
                <CompactInput value={daysHeld} onChange={setDaysHeld} placeholder="1" suffix="days" />
              </Row>
            </>
          )}

          {/* Calculate button */}
          <Button
            variant="primary"
            size="sm"
            fullWidth
            onClick={() => {
              if (!entryPrice && livePrice > 0) setEntryPrice(livePrice.toFixed(digits));
            }}
          >
            Calculate
          </Button>

          {/* ─── Result panel ─── */}
          <Card nested padding="lg" className="flex flex-col items-center justify-center">
            <span className="text-xs font-semibold text-text-secondary mb-1">{resultLabel}</span>
            <span className={clsx('text-2xl font-bold font-mono tabular-nums', resultTone)}>{resultValue}</span>
            {resultDetails.length > 0 && (
              <div className="mt-3 w-full space-y-1">
                {resultDetails.map((d) => (
                  <div key={d.l} className="flex items-center justify-between text-xxs">
                    <span className="text-text-tertiary">{d.l}</span>
                    <span className="font-mono font-semibold text-text-secondary tabular-nums">{d.v}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <p className="text-xxs text-text-tertiary text-center leading-relaxed pb-1">
            Approximate values. May vary by market conditions.
          </p>
        </div>
      </div>
    </div>
  );
}
