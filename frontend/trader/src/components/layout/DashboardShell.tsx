'use client';

/**
 * DashboardShell — THE single shell for every logged-in app page.
 *
 * Row 1 (58px, sticky): brand · center nav with 2px accent underline on
 * the active link · account pill · ⌘K search · UTC clock · bell with
 * dot · Deposit CTA · avatar.
 *
 * All colors come from the `.desk` token block in globals.css — no hex
 * here. Fonts: Archivo (UI) + IBM Plex Mono (numerals) via next/font.
 *
 * The shell also owns the shared desk data: accounts (5s poll) and
 * prices (~950ms poll with per-symbol flash direction + history), plus
 * feed latency — exposed through useDesk() so pages never duplicate
 * pollers or render their own chrome.
 */

import {
  createContext, useCallback, useContext, useEffect, useRef, useState,
  type MutableRefObject, type ReactNode,
} from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Archivo, IBM_Plex_Mono } from 'next/font/google';
import { Bell, ChevronDown, LogOut, Moon, MoreHorizontal, Search, Sun } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import api from '@/lib/api/client';
import { useAuthStore } from '@/stores/authStore';
import DashboardFooter from './DashboardFooter';
import FeatureTour from '@/components/onboarding/FeatureTour';

const fontUi = Archivo({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--f-ui' });
const fontNum = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--f-num' });

/* ── shared desk state ─────────────────────────────────────────────── */
export interface DeskAccount {
  id: string; account_number: string; balance: number; credit?: number;
  equity: number; free_margin: number; margin_used?: number; margin_level?: number;
  leverage: number; is_demo: boolean;
}
export interface DeskTick { symbol: string; bid: number; ask: number }
export interface DeskFlash { dir: 1 | -1; seq: number }

interface DeskState {
  accounts: DeskAccount[];
  account: DeskAccount | null;
  selectAccount: (id: string) => void;
  refreshAccounts: () => Promise<void>;
  ticks: Record<string, DeskTick>;
  flash: Record<string, DeskFlash>;
  hist: MutableRefObject<Record<string, number[]>>;
  latencyMs: number;
}

const DeskCtx = createContext<DeskState | null>(null);
export function useDesk(): DeskState {
  const ctx = useContext(DeskCtx);
  if (!ctx) throw new Error('useDesk must be used inside DashboardShell');
  return ctx;
}

const NAV = [
  { label: 'Overview', href: '/dashboard' },
  { label: 'Accounts', href: '/accounts' },
  { label: 'Funds', href: '/wallet' },
  { label: 'Social', href: '/social' },
  { label: 'Affiliates', href: '/business' },
];
const MORE = [
  { label: 'Portfolio', href: '/portfolio' },
  { label: 'News', href: '/news' },
  { label: 'PAMM', href: '/pamm' },
  { label: 'KYC', href: '/kyc' },
  { label: 'Algo Connector', href: '/algo-connector' },
  { label: 'Risk Calculator', href: '/risk-calculator' },
  { label: 'Support', href: '/support' },
  { label: 'Settings', href: '/profile' },
];

function useOutside(close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fn = (e: Event) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    document.addEventListener('mousedown', fn);
    document.addEventListener('touchstart', fn);
    return () => { document.removeEventListener('mousedown', fn); document.removeEventListener('touchstart', fn); };
  }, [close]);
  return ref;
}

export default function DashboardShell({
  children,
  className,
  mainClassName,
}: {
  children: ReactNode;
  className?: string;
  mainClassName?: string;
}) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const theme = useUIStore((s) => s.theme);
  const toggleTheme = useUIStore((s) => s.toggleTheme);

  /* accounts */
  const [accounts, setAccounts] = useState<DeskAccount[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const refreshAccounts = useCallback(async () => {
    try {
      const raw = await api.get<{ items: DeskAccount[] } | DeskAccount[]>('/accounts');
      const list = Array.isArray(raw) ? raw : (raw as { items: DeskAccount[] }).items || [];
      setAccounts(list);
      setActiveId((cur) => cur ?? list[0]?.id ?? null);
    } catch { /* transient */ }
  }, []);
  useEffect(() => {
    void refreshAccounts();
    const id = setInterval(() => { if (!document.hidden) void refreshAccounts(); }, 5000);
    return () => clearInterval(id);
  }, [refreshAccounts]);
  const account = accounts.find((a) => a.id === activeId) ?? accounts[0] ?? null;

  /* prices (~950ms) + latency */
  const [ticks, setTicks] = useState<Record<string, DeskTick>>({});
  const [flash, setFlash] = useState<Record<string, DeskFlash>>({});
  const [latencyMs, setLatencyMs] = useState(0);
  const hist = useRef<Record<string, number[]>>({});
  const prev = useRef<Record<string, number>>({});
  const seq = useRef(0);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const t0 = performance.now();
      try {
        const data = await api.get<DeskTick[]>('/instruments/prices/all');
        if (!alive || !Array.isArray(data)) return;
        setLatencyMs(Math.round(performance.now() - t0));
        const map: Record<string, DeskTick> = {};
        const fl: Record<string, DeskFlash> = {};
        seq.current += 1;
        for (const t of data) {
          if (!t?.symbol) continue;
          map[t.symbol] = t;
          const p = prev.current[t.symbol];
          if (p !== undefined && t.bid !== p) fl[t.symbol] = { dir: t.bid > p ? 1 : -1, seq: seq.current };
          prev.current[t.symbol] = t.bid;
          const h = (hist.current[t.symbol] ||= []);
          h.push(t.bid);
          if (h.length > 40) h.shift();
        }
        setTicks(map);
        setFlash((old) => ({ ...old, ...fl }));
      } catch { /* keep last */ }
    };
    load();
    const id = setInterval(() => { if (!document.hidden) void load(); }, 950);
    return () => { alive = false; clearInterval(id); };
  }, []);

  /* dropdowns + ⌘K */
  const [pillOpen, setPillOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const pillRef = useOutside(useCallback(() => setPillOpen(false), []));
  const moreRef = useOutside(useCallback(() => setMoreOpen(false), []));
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  /* UTC clock */
  const [clock, setClock] = useState('');
  useEffect(() => {
    const f = () => setClock(new Date().toISOString().slice(11, 19) + ' UTC');
    f();
    const id = setInterval(f, 1000);
    return () => clearInterval(id);
  }, []);

  const initials = (user?.email ?? 'AX').slice(0, 2).toUpperCase();
  const desk: DeskState = { accounts, account, selectAccount: setActiveId, refreshAccounts, ticks, flash, hist, latencyMs };

  const fmt = (n: number) =>
    n >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : n >= 100 ? n.toFixed(3) : n.toFixed(5);

  return (
    <DeskCtx.Provider value={desk}>
      <div className={cn('desk', fontUi.variable, fontNum.variable, className)}>
        {/* ── Row 1: navbar ─────────────────────────────────────────── */}
        <nav className="dk-nav">
          {/* The lockup already CONTAINS the wordmark, so it replaces both
              the mark and the type — rendering the old <span> beside it
              would print the brand name twice. Sized by height in CSS
              (.dk-brand-logo); `sizes` stops next/image shipping a 1536px
              variant for a ~150px box. Same treatment as PortalNav. */}
          <Link href="/dashboard" className="dk-brand" aria-label="PowerTradeFX home">
            <Image
              className="dk-brand-logo"
              src="/portal/logo.png"
              alt="PowerTradeFX"
              width={1536}
              height={236}
              sizes="170px"
              priority
            />
          </Link>

          <div className="dk-links">
            {NAV.map(({ label, href }) => {
              const on = href === '/dashboard' ? pathname === href : pathname?.startsWith(href);
              return (
                <Link key={href} href={href} className={cn('dk-link', on && 'is-on')}>{label}</Link>
              );
            })}
            <div className="dk-more" ref={moreRef}>
              <button
                type="button"
                className={cn('dk-link', MORE.some((m) => pathname?.startsWith(m.href)) && 'is-on')}
                style={{ background: 'none', border: 0, cursor: 'pointer', height: '100%' }}
                onClick={() => setMoreOpen((o) => !o)}
                aria-haspopup="menu" aria-expanded={moreOpen}
              >
                More <MoreHorizontal size={14} style={{ marginLeft: 5 }} />
              </button>
              {moreOpen && (
                <ul className="dk-more-menu" role="menu">
                  {MORE.map((m) => (
                    <li key={m.href} role="none">
                      <Link role="menuitem" href={m.href} onClick={() => setMoreOpen(false)}>{m.label}</Link>
                    </li>
                  ))}
                  <li role="none">
                    <a role="menuitem" href="#" onClick={(e) => { e.preventDefault(); void logout(); }}>
                      <LogOut size={12} style={{ display: 'inline', marginRight: 6 }} />Sign out
                    </a>
                  </li>
                </ul>
              )}
            </div>
          </div>

          <div className="dk-right">
            <div className="dk-pill" ref={pillRef}>
              <button type="button" onClick={() => setPillOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={pillOpen}>
                <span className="dk-tag">{account ? (account.is_demo ? 'DEMO' : 'LIVE') : '—'}</span>
                <span className="num">{account?.account_number ?? 'No account'}</span>
                <ChevronDown size={13} />
              </button>
              {pillOpen && (
                <ul className="dk-pill-menu" role="listbox">
                  {accounts.map((a) => (
                    <li key={a.id} role="option" aria-selected={a.id === account?.id}>
                      <button type="button" onClick={() => { setActiveId(a.id); setPillOpen(false); }}>
                        <span className="dk-tag">{a.is_demo ? 'DEMO' : 'LIVE'}</span>
                        <span className="num">{a.account_number}</span>
                        <span className="num dk-dim">
                          {(Number(a.equity) || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="dk-search">
              <Search size={13} />
              <input ref={searchRef} placeholder="Search…" aria-label="Search" />
              <kbd>⌘K</kbd>
            </div>

            <span className="dk-clock num">{clock}</span>

            <button
              type="button"
              className="dk-bell"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            <Link href="/profile" className="dk-bell" aria-label="Notifications">
              <Bell size={15} />
              <i aria-hidden="true" />
            </Link>

            <Link href="/wallet" className="dk-cta">Deposit</Link>

            <Link href="/profile" className="dk-avatar" aria-label="Profile">{initials}</Link>
          </div>
        </nav>

        {/* ── content ───────────────────────────────────────────────── */}
        <main key={pathname} className={cn('dk-wrap', mainClassName)}>
          {children}
        </main>
        <DashboardFooter />
        <FeatureTour />
      </div>
    </DeskCtx.Provider>
  );
}
