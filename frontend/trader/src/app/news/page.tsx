'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardShell from '@/components/layout/DashboardShell';
import { Calendar, ChevronLeft, Radio } from 'lucide-react';
import { Button, Card, PageHeader, Select, Skeleton, Tabs } from '@/components/ui';

const TradingViewNewsTimeline = dynamic(
  () => import('@/components/charts/TradingViewNewsTimeline'),
  {
    ssr: false,
    loading: () => <WidgetLoading className="min-h-[480px]" />,
  },
);

const TradingViewEventsCalendar = dynamic(
  () => import('@/components/charts/TradingViewEventsCalendar'),
  {
    ssr: false,
    loading: () => <WidgetLoading className="min-h-[520px]" />,
  },
);

/** Loading placeholder that keeps the widget's footprint while the embed boots. */
function WidgetLoading({ className }: { className?: string }) {
  return (
    <div className={`p-4 bg-bg-secondary ${className ?? ''}`} aria-busy>
      <Skeleton className="h-full min-h-[280px] w-full" />
    </div>
  );
}

const LIVE_SYMBOL_OPTIONS = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD', 'ETHUSD', 'US500'] as const;

type NewsMainTab = 'calendar' | 'live';

const NEWS_TABS: { id: NewsMainTab; label: string; icon: React.ReactNode }[] = [
  { id: 'calendar', label: 'Calendar', icon: <Calendar /> },
  { id: 'live', label: 'Live News', icon: <Radio /> },
];

export default function EconomicNewsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mainTab, setMainTab] = useState<NewsMainTab>('calendar');
  const [liveSymbol, setLiveSymbol] = useState<string>('EURUSD');

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t === 'live') setMainTab('live');
    if (t === 'calendar') setMainTab('calendar');
  }, [searchParams]);

  const setMainTabAndUrl = useCallback(
    (tab: NewsMainTab) => {
      setMainTab(tab);
      router.replace(tab === 'live' ? '/news?tab=live' : '/news', { scroll: false });
    },
    [router],
  );

  return (
    <DashboardShell>
      <PageHeader
        title="Economic News"
        description="Live calendar & headlines via TradingView"
        actions={
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<ChevronLeft className="h-4 w-4" aria-hidden />}
            onClick={() => router.back()}
          >
            Back
          </Button>
        }
      >
        <Tabs
          variant="underline"
          aria-label="News sections"
          tabs={NEWS_TABS}
          active={mainTab}
          onChange={(id) => setMainTabAndUrl(id as NewsMainTab)}
        />
      </PageHeader>

      <Card key={mainTab} padding="none" className="overflow-hidden animate-fade-in">
        {mainTab === 'live' ? (
          <>
            <div className="flex flex-col gap-3 border-b border-border-primary px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-wrap items-baseline gap-2">
                <span className="font-mono text-lg font-semibold tracking-tight text-text-primary">{liveSymbol}</span>
                <span className="text-sm text-text-secondary">Top Stories</span>
              </div>
              <div className="flex shrink-0 items-center gap-2 text-xs text-text-secondary">
                <span className="whitespace-nowrap text-text-tertiary">Symbol</span>
                <div className="w-36">
                  <Select
                    size="sm"
                    aria-label="Symbol"
                    value={liveSymbol}
                    onChange={(e) => setLiveSymbol(e.target.value)}
                    className="font-mono"
                  >
                    {LIVE_SYMBOL_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>
            <div className="h-[min(72vh,820px)] min-h-[520px] bg-bg-secondary">
              <TradingViewNewsTimeline
                symbolOverride={liveSymbol}
                hideChrome
                useDarkEmbed={false}
                className="h-full min-h-[520px]"
              />
            </div>
            <div className="border-t border-border-primary px-4 py-2.5">
              <p className="text-center text-xs leading-relaxed text-text-secondary">
                Live headlines via{' '}
                <a
                  href="https://www.tradingview.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-accent hover:underline"
                >
                  TradingView
                </a>
                . Not investment advice.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="border-b border-border-primary px-4 py-3">
              <p className="text-xs leading-relaxed text-text-secondary">
                Live economic events from TradingView. Use the widget&apos;s built-in filters to pick
                timezone, importance, and date range.
              </p>
            </div>
            <div className="h-[min(78vh,900px)] min-h-[560px] bg-bg-secondary">
              <TradingViewEventsCalendar className="h-full min-h-[560px]" />
            </div>
            <div className="border-t border-border-primary px-4 py-2.5">
              <p className="text-center text-xs leading-relaxed text-text-secondary">
                Calendar data via{' '}
                <a
                  href="https://www.tradingview.com/economic-calendar/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-accent hover:underline"
                >
                  TradingView
                </a>
                . Not investment advice.{' '}
                <Link href="/wallet" className="text-text-tertiary hover:text-accent">
                  Deposit / Withdraw
                </Link>
              </p>
            </div>
          </>
        )}
      </Card>
    </DashboardShell>
  );
}
