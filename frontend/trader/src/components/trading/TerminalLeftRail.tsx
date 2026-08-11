'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  Search,
  LayoutTemplate,
  Newspaper,
  MessageCircle,
  Settings,
  Calculator,
  UserRound,
} from 'lucide-react';
import { clsx } from 'clsx';

/** Kept for API back-compat (callers pass activeSpace / onSpaceChange) —
 *  the Spaces section itself has been removed from the rail. */
export type TerminalSpaceId = 'balanced' | 'chart' | 'trading';

interface TerminalLeftRailProps {
  /** No longer driven by the rail; left in the type so parent calls compile. */
  activeSpace?: TerminalSpaceId;
  onSpaceChange?: (id: TerminalSpaceId) => void;
  terminalMarketsOpen: boolean;
  onToggleMarkets: () => void;
  bottomPanelCollapsed: boolean;
  onToggleBottomPanel: () => void;
  onFocusSymbolSearch: () => void;
  chartExpanded: boolean;
  terminalNewsOpen: boolean;
  /** Right rail: symbol list + quotes */
  onPanelsSelectMarkets: () => void;
  /** Right rail: buy / sell order panel */
  onPanelsSelectOrder: () => void;
  /** Chart focus mode (expanded chart area; use with terminal page handler) */
  onExpandFullChart: () => void;
  /** Right rail: TradingView live news timeline */
  onPanelsSelectNews: () => void;
  /** Right rail: Risk calculator */
  terminalCalcOpen?: boolean;
  onPanelsSelectCalc?: () => void;
}

function RailBtn({
  active,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  title: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className={clsx(
        'w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0',
        active
          ? 'bg-accent/10 text-accent'
          : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover',
      )}
    >
      {children}
    </button>
  );
}

// The rail is intentionally minimal: Search (opens the instrument search),
// the Panels / order view, Live news, and the Risk calculator — plus Support
// and Settings pinned to the bottom. The old Add-symbol, Markets, Chart-focus,
// positions-strip and connection-status buttons were removed.
export default function TerminalLeftRail({
  terminalMarketsOpen,
  onFocusSymbolSearch,
  chartExpanded,
  terminalNewsOpen,
  onPanelsSelectOrder,
  onPanelsSelectNews,
  terminalCalcOpen,
  onPanelsSelectCalc,
}: TerminalLeftRailProps) {
  const panelsActive =
    !terminalMarketsOpen && !chartExpanded && !terminalNewsOpen && !terminalCalcOpen;

  return (
    <aside
      className="shrink-0 w-16 flex flex-col items-center border-r border-border-primary bg-bg-secondary z-[5]"
      aria-label="Terminal toolbar"
    >
      <div className="flex flex-col items-center gap-1.5 pt-4 pb-3 border-b border-border-primary w-full">
        <Link
          href="/accounts"
          title="Accounts"
          className="w-10 h-10 rounded-xl bg-accent/10 shadow-lg shadow-accent/20 flex items-center justify-center hover:bg-accent/20 transition-all mb-2"
        >
          <Image src="/marketing/powertradefx_fevicon.png" alt="PowerTradeFX" width={28} height={28} className="w-7 h-7 object-contain rounded-lg" />
        </Link>
        {/* Search — opens the Markets panel with the instrument search focused. */}
        <RailBtn title="Search symbols" onClick={onFocusSymbolSearch}>
          <Search size={19} strokeWidth={1.75} />
        </RailBtn>
      </div>

      <div className="flex-1 flex flex-col items-center overflow-y-auto overflow-x-hidden min-h-0 py-3 gap-2">
        <RailBtn
          title="Panels — buy / sell order panel"
          active={panelsActive}
          onClick={onPanelsSelectOrder}
        >
          <LayoutTemplate size={19} strokeWidth={1.75} />
        </RailBtn>
        <RailBtn
          title="Live news — TradingView timeline"
          active={terminalNewsOpen && !chartExpanded}
          onClick={onPanelsSelectNews}
        >
          <Newspaper size={19} strokeWidth={1.75} />
        </RailBtn>
        {onPanelsSelectCalc && (
          <RailBtn
            title="Risk Calculator"
            active={!!terminalCalcOpen && !chartExpanded && !terminalNewsOpen}
            onClick={onPanelsSelectCalc}
          >
            <Calculator size={19} strokeWidth={1.75} />
          </RailBtn>
        )}
        <div className="h-px w-8 bg-border-primary my-1" />
        <Link
          href="/support"
          title="Support chat"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all"
        >
          <MessageCircle size={19} strokeWidth={1.75} />
        </Link>
        <Link
          href="/profile"
          title="Settings"
          className="w-10 h-10 rounded-xl flex items-center justify-center text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all"
        >
          <Settings size={19} strokeWidth={1.75} />
        </Link>
      </div>

      <div className="pb-[max(1rem,env(safe-area-inset-bottom,0px))] pt-2">
        <Link
          href="/profile"
          title="Your profile"
          className="w-10 h-10 rounded-full border-2 border-border-primary hover:border-accent transition-all flex items-center justify-center text-text-secondary hover:text-accent"
        >
          <UserRound size={19} strokeWidth={1.75} />
        </Link>
      </div>
    </aside>
  );
}
