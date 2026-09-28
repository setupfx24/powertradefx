'use client';

import { useState, useMemo, useRef, useEffect, type ReactNode } from 'react';
import { Info, Calculator, Search, ChevronDown, X } from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import { useTradingStore, type InstrumentInfo, type TradingAccount } from '@/stores/tradingStore';
import api from '@/lib/api/client';
import { cn } from '@/lib/utils';
import {
  Badge, Button, Card, CardHeader, Input, PageHeader, Segmented, Select, StatCard, Tabs,
} from '@/components/ui';

type CalcTab = 'margin' | 'pnl' | 'lotsize' | 'swap';
type Side = 'buy' | 'sell';

const TABS: { id: CalcTab; label: string }[] = [
  { id: 'margin', label: 'Margin Calculator' },
  { id: 'pnl', label: 'Profit/Loss Calculator' },
  { id: 'lotsize', label: 'Lot Size Calculator' },
  { id: 'swap', label: 'Swap Calculator' },
];

/* ─── Searchable instrument picker ─── */
function InstrumentPicker({
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
        type="button"
        variant="outline"
        fullWidth
        onClick={() => { setOpen(!open); setSearch(''); }}
        className="justify-between font-medium"
        rightIcon={<ChevronDown size={14} className={cn('text-text-tertiary shrink-0 transition-transform', open && 'rotate-180')} />}
      >
        <span className="truncate">{current ? `${current.symbol} — ${current.display_name}` : 'Select Instrument'}</span>
      </Button>
      {open && (
        <div className="absolute top-full left-0 z-50 w-full mt-1 rounded-lg border border-border-primary bg-card shadow-lg overflow-hidden animate-fade-in">
          <div className="p-2 border-b border-border-primary">
            <Input
              ref={inputRef}
              type="text"
              size="sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search instrument..."
              icon={<Search />}
              suffix={search ? (
                <Button type="button" variant="ghost" size="xs" iconOnly aria-label="Clear search" onClick={() => setSearch('')}>
                  <X size={13} />
                </Button>
              ) : undefined}
            />
          </div>
          <div className="max-h-[240px] overflow-y-auto">
            {filtered.length > 0 ? filtered.map((inst) => {
              const on = inst.symbol === value;
              return (
                <Button
                  key={inst.symbol}
                  type="button"
                  variant="ghost"
                  fullWidth
                  onClick={() => { onChange(inst.symbol); setOpen(false); setSearch(''); }}
                  className={cn('h-auto justify-between rounded-none px-3 py-2 font-normal', on && 'bg-accent/10 text-accent hover:bg-accent/15 hover:text-accent')}
                >
                  <span className="flex flex-col items-start text-left">
                    <span className="text-base font-semibold">{inst.symbol}</span>
                    <span className="text-xxs text-text-tertiary">{inst.display_name}</span>
                  </span>
                  <Badge variant="neutral" size="sm" tone="outline">{inst.segment}</Badge>
                </Button>
              );
            }) : (
              <div className="px-3 py-4 text-center text-xs text-text-tertiary">No instruments found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Tooltip icon ─── */
function Tip({ text }: { text: string }) {
  return (
    <span className="relative group cursor-help ml-1 inline-flex align-middle" title={text}>
      <Info size={13} className="text-text-tertiary group-hover:text-accent transition-colors" />
    </span>
  );
}

/** Label + optional tooltip, for the primitives' `label` slot. */
function FieldLabel({ text, tip }: { text: string; tip?: string }) {
  return (
    <span className="inline-flex items-center">
      {text}
      {tip && <Tip text={tip} />}
    </span>
  );
}

/* ─── Result panel: one hero StatCard + a grid of detail StatCards ─── */
function ResultPanel({
  label,
  value,
  tone,
  details,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'danger';
  details?: { l: string; v: string }[];
}) {
  const valueNode: ReactNode = (
    <span className={cn('text-2xl', tone === 'success' && 'text-success', tone === 'danger' && 'text-danger')}>{value}</span>
  );
  return (
    <div className="w-full space-y-4">
      <StatCard label={label} value={valueNode} />
      {details && details.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {details.map((d) => (
            <StatCard key={d.l} label={d.l} value={<span className="text-md">{d.v}</span>} />
          ))}
        </div>
      )}
    </div>
  );
}

function mapApiAccount(a: Record<string, unknown>): TradingAccount {
  const g = a.account_group as Record<string, unknown> | null | undefined;
  return {
    id: String(a.id),
    account_number: String(a.account_number ?? ''),
    balance: Number(a.balance) || 0,
    credit: Number(a.credit) || 0,
    equity: Number(a.equity ?? a.balance) || 0,
    margin_used: Number(a.margin_used) || 0,
    free_margin: Number(a.free_margin ?? a.balance) || 0,
    margin_level: Number(a.margin_level) || 0,
    leverage: Number(a.leverage) || 100,
    currency: String(a.currency ?? 'USD'),
    is_demo: Boolean(a.is_demo),
    account_group: g
      ? {
          id: String(g.id),
          name: String(g.name ?? 'Account'),
          spread_markup: Number(g.spread_markup) || 0,
          commission_per_lot: Number(g.commission_per_lot) || 0,
          minimum_deposit: Number(g.minimum_deposit) || 0,
          swap_free: Boolean(g.swap_free),
          leverage_default: Number(g.leverage_default) || 100,
        }
      : null,
  };
}

/* ═══════════════════════════════════════════════════ */
export default function RiskCalculatorPage() {
  // Narrow selectors: only re-render on the slices this page actually reads
  // (action references are stable in zustand, so selecting them is free).
  const selectedSymbol = useTradingStore((s) => s.selectedSymbol);
  const prices = useTradingStore((s) => s.prices);
  const instruments = useTradingStore((s) => s.instruments);
  const activeAccount = useTradingStore((s) => s.activeAccount);
  const accounts = useTradingStore((s) => s.accounts);
  const setInstruments = useTradingStore((s) => s.setInstruments);
  const setAccounts = useTradingStore((s) => s.setAccounts);

  // Fetch instruments + accounts if not already loaded
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (instruments.length === 0) {
          const res = await api.get<unknown>('/instruments/').catch(() => []);
          if (cancelled) return;
          const list = Array.isArray(res) ? res : ((res as { items?: unknown[] })?.items ?? []);
          if (list.length > 0) {
            setInstruments(
              list.map((i: Record<string, unknown>) => ({
                symbol: String(i.symbol),
                display_name: String(i.display_name || i.symbol),
                segment: String((i.segment as { name?: string })?.name || i.segment || ''),
                digits: Number(i.digits ?? 5),
                pip_size: Number(i.pip_size ?? 0.0001),
                min_lot: Number(i.min_lot ?? 0.01),
                max_lot: Number(i.max_lot ?? 100),
                lot_step: Number(i.lot_step ?? 0.01),
                contract_size: Number(i.contract_size ?? 100000),
              })),
            );
          }
        }
        if (accounts.length === 0) {
          const res = await api.get<unknown>('/accounts').catch(() => ({ items: [] }));
          if (cancelled) return;
          const list = Array.isArray(res) ? res : ((res as { items?: unknown[] })?.items ?? []);
          setAccounts((list as Record<string, unknown>[]).map(mapApiAccount));
        }
      } catch (err) {
        console.error('Risk calculator data load failed:', err);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const [tab, setTab] = useState<CalcTab>('margin');

  // ── Shared state ──
  const [selectedAccountId, setSelectedAccountId] = useState(activeAccount?.id ?? '');
  const [symbol, setSymbol] = useState(selectedSymbol || 'EURUSD');
  const [side, setSide] = useState<Side>('buy');
  const [lots, setLots] = useState('0.01');
  const [entryPrice, setEntryPrice] = useState('');
  const [exitPrice, setExitPrice] = useState('');
  const [riskPercent, setRiskPercent] = useState('1');
  const [stopLoss, setStopLoss] = useState('');
  const [daysHeld, setDaysHeld] = useState('1');

  const instrumentInfo = instruments.find((i: InstrumentInfo) => i.symbol === symbol);
  const tick = prices[symbol];
  const digits = instrumentInfo?.digits ?? 5;
  const pipSize = instrumentInfo?.pip_size ?? 0.0001;
  const contractSize = instrumentInfo?.contract_size ?? 100000;
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) || activeAccount;
  const balance = selectedAccount?.balance ?? 10000;
  const accountLeverage = selectedAccount?.leverage ?? 100;

  const accountOpts = accounts.map((a) => ({
    value: a.id,
    label: `${a.account_number} — $${a.balance.toFixed(2)} ${a.is_demo ? '(Demo)' : ''}`,
  }));

  // ── Margin calc ──
  const marginResult = useMemo(() => {
    const ep = parseFloat(entryPrice) || (tick ? (side === 'buy' ? tick.ask : tick.bid) : 0);
    const lev = accountLeverage;
    const lot = parseFloat(lots) || 0;
    if (!ep || !lot) return null;
    const margin = (lot * contractSize * ep) / lev;
    return { margin, ep, lot, lev };
  }, [entryPrice, accountLeverage, lots, side, tick, contractSize]);

  // ── P&L calc ──
  const pnlResult = useMemo(() => {
    const ep = parseFloat(entryPrice);
    const xp = parseFloat(exitPrice);
    const lot = parseFloat(lots) || 0;
    if (!ep || !xp || !lot) return null;
    const pips = side === 'buy' ? (xp - ep) / pipSize : (ep - xp) / pipSize;
    const pipVal = (pipSize / ep) * contractSize;
    const pnl = lot * pips * pipVal;
    return { pnl, pips, pipVal };
  }, [entryPrice, exitPrice, lots, side, pipSize, contractSize]);

  // ── Lot size calc ──
  const lotResult = useMemo(() => {
    const ep = parseFloat(entryPrice) || (tick ? (side === 'buy' ? tick.ask : tick.bid) : 0);
    const sl = parseFloat(stopLoss);
    const rp = parseFloat(riskPercent);
    if (!ep || !sl || !rp || ep <= 0 || sl <= 0) return null;
    const riskAmt = balance * (rp / 100);
    const slPips = Math.abs(ep - sl) / pipSize;
    if (slPips <= 0) return null;
    const pipVal = (pipSize / ep) * contractSize;
    const lotSize = riskAmt / (slPips * pipVal);
    return { lotSize: Math.max(0.01, parseFloat(lotSize.toFixed(2))), riskAmt, slPips, pipVal };
  }, [entryPrice, stopLoss, riskPercent, balance, side, tick, pipSize, contractSize]);

  // ── Swap calc (simplified estimate) ──
  const swapResult = useMemo(() => {
    const lot = parseFloat(lots) || 0;
    const days = parseInt(daysHeld) || 1;
    if (!lot) return null;
    // Simplified: typical swap ~0.5-2 pips/day for most pairs
    const swapPerLotPerDay = 0.5;
    const dailySwap = lot * swapPerLotPerDay * ((pipSize / (tick?.bid || 1)) * contractSize);
    const totalSwap = dailySwap * days;
    return { dailySwap, totalSwap, days };
  }, [lots, daysHeld, tick, pipSize, contractSize]);

  const handleCalculate = () => {
    // Auto-fill entry from live if empty
    if (!entryPrice && tick) {
      setEntryPrice((side === 'buy' ? tick.ask : tick.bid).toFixed(digits));
    }
  };

  const activeLabel = TABS.find((t) => t.id === tab)?.label ?? '';

  return (
    <DashboardShell>
      <div className="w-full space-y-4 md:space-y-5">
        <PageHeader
          eyebrow="Tools"
          title="Risk Management"
          description="Calculate margin, profit/loss, lot size, and swap before placing a trade"
        >
          <Tabs
            variant="underline"
            aria-label="Calculator"
            tabs={TABS}
            active={tab}
            onChange={(id) => setTab(id as CalcTab)}
            className="overflow-x-auto"
          />
        </PageHeader>

        {/* ── Calculator card ── */}
        <Card padding="none" className="overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-5">

            {/* LEFT — Form fields */}
            <div className="lg:col-span-3 p-4 md:p-5 space-y-4 border-b lg:border-b-0 lg:border-r border-border-primary">
              <CardHeader title={activeLabel} description="Inputs" className="mb-0" />

              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  label={<FieldLabel text="Account" tip="Select your trading account" />}
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                >
                  <option value="">Select Account</option>
                  {accountOpts.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>

                {(tab === 'margin' || tab === 'pnl') && (
                  <div className="flex flex-col gap-1.5 min-w-0">
                    <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                      <FieldLabel text="Direction" tip="Buy or Sell" />
                    </span>
                    <Segmented<Side>
                      aria-label="Direction"
                      size="md"
                      fullWidth
                      value={side}
                      onChange={setSide}
                      options={[
                        { value: 'buy', label: 'Buy', tone: 'buy' },
                        { value: 'sell', label: 'Sell', tone: 'sell' },
                      ]}
                    />
                  </div>
                )}

                {tab === 'lotsize' && (
                  <Input
                    label={<FieldLabel text="Account Balance" tip="Your trading account balance" />}
                    value={`$${balance.toFixed(2)}`}
                    readOnly
                    numeric
                    className="font-semibold text-accent"
                  />
                )}

                <div className="flex flex-col gap-1.5 min-w-0 sm:col-span-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    <FieldLabel text="Instrument" tip="Search and select a trading instrument" />
                  </span>
                  <InstrumentPicker value={symbol} onChange={setSymbol} instruments={instruments} />
                </div>

                <Input
                  type="number"
                  numeric
                  label={<FieldLabel text="Entry Price" tip="Enter your entry price" />}
                  value={entryPrice}
                  onChange={(e) => setEntryPrice(e.target.value)}
                  placeholder="Enter Entry Price"
                />

                {tab === 'pnl' && (
                  <Input
                    type="number"
                    numeric
                    label={<FieldLabel text="Exit Price" tip="Enter your exit / take profit price" />}
                    value={exitPrice}
                    onChange={(e) => setExitPrice(e.target.value)}
                    placeholder="Enter Exit Price"
                  />
                )}

                {tab === 'margin' && (
                  <>
                    <Input
                      label={<FieldLabel text="Leverage" tip="Account leverage ratio" />}
                      value={`1:${accountLeverage}`}
                      readOnly
                      numeric
                      className="font-semibold"
                    />
                    <Input
                      type="number"
                      numeric
                      label={<FieldLabel text="Lot Size" tip="Position size in lots" />}
                      value={lots}
                      onChange={(e) => setLots(e.target.value)}
                      placeholder="Enter Size"
                      suffix="lots"
                    />
                  </>
                )}

                {tab === 'pnl' && (
                  <Input
                    type="number"
                    numeric
                    label={<FieldLabel text="Lot Size" tip="Position size in lots" />}
                    value={lots}
                    onChange={(e) => setLots(e.target.value)}
                    placeholder="Enter Size"
                    suffix="lots"
                  />
                )}

                {tab === 'lotsize' && (
                  <>
                    <Input
                      type="number"
                      numeric
                      label={<FieldLabel text="Risk %" tip="Percentage of balance to risk" />}
                      value={riskPercent}
                      onChange={(e) => setRiskPercent(e.target.value)}
                      placeholder="1"
                      suffix="%"
                    />
                    <Input
                      type="number"
                      numeric
                      label={<FieldLabel text="Stop Loss Price" tip="Your stop loss level" />}
                      value={stopLoss}
                      onChange={(e) => setStopLoss(e.target.value)}
                      placeholder="Enter SL price"
                    />
                  </>
                )}

                {tab === 'swap' && (
                  <>
                    <Input
                      type="number"
                      numeric
                      label={<FieldLabel text="Lot Size" tip="Position size in lots" />}
                      value={lots}
                      onChange={(e) => setLots(e.target.value)}
                      placeholder="Enter Size"
                      suffix="lots"
                    />
                    <Input
                      type="number"
                      numeric
                      label={<FieldLabel text="Days Held" tip="Number of days position is open" />}
                      value={daysHeld}
                      onChange={(e) => setDaysHeld(e.target.value)}
                      placeholder="1"
                      suffix="days"
                    />
                  </>
                )}
              </div>

              {/* Calculate button */}
              <div className="pt-2">
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  onClick={handleCalculate}
                  leftIcon={<Calculator size={16} />}
                  className="w-full sm:w-auto"
                >
                  Calculate
                </Button>
              </div>
            </div>

            {/* RIGHT — Result */}
            <div className="lg:col-span-2 flex items-stretch bg-card-nested">
              <div className="flex-1 flex items-center justify-center p-4 md:p-5">
                {tab === 'margin' && marginResult && (
                  <ResultPanel
                    label="Required Margin"
                    value={`$${marginResult.margin.toFixed(2)}`}
                    details={[
                      { l: 'Lots', v: marginResult.lot.toFixed(2) },
                      { l: 'Leverage', v: `1:${marginResult.lev}` },
                      { l: 'Price', v: marginResult.ep.toFixed(digits) },
                      { l: 'Contract Size', v: contractSize.toLocaleString() },
                    ]}
                  />
                )}
                {tab === 'pnl' && pnlResult && (
                  <ResultPanel
                    label={pnlResult.pnl >= 0 ? 'Profit' : 'Loss'}
                    tone={pnlResult.pnl >= 0 ? 'success' : 'danger'}
                    value={`${pnlResult.pnl >= 0 ? '+' : '-'}$${Math.abs(pnlResult.pnl).toFixed(2)}`}
                    details={[
                      { l: 'Pips', v: pnlResult.pips.toFixed(1) },
                      { l: 'Pip Value', v: `$${pnlResult.pipVal.toFixed(4)}` },
                      { l: 'Direction', v: side.toUpperCase() },
                    ]}
                  />
                )}
                {tab === 'lotsize' && lotResult && (
                  <ResultPanel
                    label="Recommended Lot Size"
                    value={lotResult.lotSize.toFixed(2)}
                    details={[
                      { l: 'Risk Amount', v: `$${lotResult.riskAmt.toFixed(2)}` },
                      { l: 'SL Distance', v: `${lotResult.slPips.toFixed(1)} pips` },
                      { l: 'Pip Value/Lot', v: `$${lotResult.pipVal.toFixed(4)}` },
                    ]}
                  />
                )}
                {tab === 'swap' && swapResult && (
                  <ResultPanel
                    label="Estimated Swap"
                    value={`$${swapResult.totalSwap.toFixed(2)}`}
                    details={[
                      { l: 'Daily Swap', v: `$${swapResult.dailySwap.toFixed(4)}` },
                      { l: 'Days', v: String(swapResult.days) },
                      { l: 'Lots', v: lots },
                    ]}
                  />
                )}
                {!marginResult && tab === 'margin' && <ResultPanel label="Result" value="$0.00" />}
                {!pnlResult && tab === 'pnl' && <ResultPanel label="Result" value="$0.00" />}
                {!lotResult && tab === 'lotsize' && <ResultPanel label="Result" value="0.00" />}
                {!swapResult && tab === 'swap' && <ResultPanel label="Result" value="$0.00" />}
              </div>
            </div>
          </div>
        </Card>

        {/* Disclaimer */}
        <p className="text-xs text-text-tertiary text-center leading-relaxed">
          Results are approximate. Actual values may vary based on market conditions, currency pair, and account currency.
        </p>
      </div>
    </DashboardShell>
  );
}
