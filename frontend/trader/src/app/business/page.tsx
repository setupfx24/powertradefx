'use client';

import { useState, useEffect, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import {
  Users,
  Briefcase,
  Network,
  Share2,
  DollarSign,
  TrendingUp,
  Award,
  CheckCircle2,
  Copy,
  ChevronRight,
  Hourglass,
} from 'lucide-react';
import DashboardShell from '@/components/layout/DashboardShell';
import DemoLockGate from '@/components/demo/DemoLockGate';
import { useAuthStore } from '@/stores/authStore';
import { getErrorMessage } from '@/lib/errors';
import api from '@/lib/api/client';
import { cn } from '@/lib/utils';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  PageHeader,
  Skeleton,
  StatCard,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Tabs,
} from '@/components/ui';


type TabId = 'ib' | 'sub-broker' | 'network';

const TABS: { id: TabId; label: string; icon: typeof Users }[] = [
  { id: 'ib', label: 'IB Program', icon: Users },
  { id: 'sub-broker', label: 'Sub-Broker', icon: Briefcase },
  { id: 'network', label: 'My Network', icon: Network },
];

function fmt(n: number) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string) {
  try { return new Date(d).toLocaleDateString(); } catch { return d; }
}

function TabSkeleton() {
  return (
    <div className="space-y-4 md:space-y-5" aria-busy="true" aria-label="Loading">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <StatCard key={i} label={<Skeleton className="h-3 w-16" />} value="" loading />
        ))}
      </div>
      <Card className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-9 w-full" />
      </Card>
    </div>
  );
}

function BenefitItem({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-left">
      <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-success/15 text-success">
        <CheckCircle2 size={13} strokeWidth={2.6} />
      </span>
      <span className="text-sm leading-relaxed text-text-secondary">{children}</span>
    </li>
  );
}

export default function BusinessPage() {
  const isDemo = useAuthStore((s) => s.user?.is_demo);
  const [tab, setTab] = useState<TabId>('ib');

  if (isDemo) {
    return (
      <DashboardShell>
        <DemoLockGate
          feature="Affiliates & IB rewards"
          description="IB commissions, sub-broker partnerships and network payouts require a real trading account. Register a live account to start earning."
        >
          <></>
        </DemoLockGate>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-4 md:space-y-5">
        <PageHeader
          eyebrow="Partner Programs"
          title="Grow with PowerTradeFX"
          description="Refer traders, build a team, or partner as a sub-broker. Earn revenue share on every trade your network places."
        >
          <Tabs
            variant="underline"
            aria-label="Partner programs"
            active={tab}
            onChange={(id) => setTab(id as TabId)}
            tabs={TABS.map((t) => {
              const Icon = t.icon;
              return { id: t.id, label: t.label, icon: <Icon strokeWidth={2.2} /> };
            })}
          />
        </PageHeader>

        <div key={tab} className="animate-fade-in">
          {tab === 'ib' && <IBTab />}
          {tab === 'sub-broker' && <SubBrokerTab />}
          {tab === 'network' && <NetworkTab />}
        </div>
      </div>
    </DashboardShell>
  );
}


function IBTab() {
  const [status, setStatus] = useState<any>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [referrals, setReferrals] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await api.get<any>('/business/status');
        setStatus(s);
        if (s.is_ib) {
          const [d, r, c] = await Promise.all([
            api.get<any>('/business/ib/dashboard'),
            api.get<any>('/business/ib/referrals'),
            api.get<any>('/business/ib/commissions'),
          ]);
          setDashboard(d);
          setReferrals(r.items || []);
          setCommissions(c.items || []);
        }
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const handleApply = async () => {
    setApplying(true);
    try {
      await api.post('/business/apply', {});
      toast.success('IB application submitted!');
      const s = await api.get<any>('/business/status');
      setStatus(s);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Failed'));
    } finally {
      setApplying(false);
    }
  };

  if (loading) return <TabSkeleton />;

  if (!status?.is_ib && status?.application_status === 'pending') {
    return (
      <PendingCard message="Your IB application is under review by the admin team." />
    );
  }

  if (!status?.is_ib) {
    return (
      <CtaCard
        eyebrow="IB Program"
        title="Become an Introducing Broker"
        subtitle="Refer traders to PowerTradeFX and earn a lifetime share of their trading commissions — up to 5 levels deep."
        benefits={[
          'Lifetime commission on every trade your referrals place',
          'Multi-level network — earn from sub-referrals too',
          'Personalised referral link and dashboard',
          'Weekly automated payouts to your trading wallet',
        ]}
        cta={applying ? 'Submitting…' : 'Apply Now'}
        onClick={handleApply}
        disabled={applying}
      />
    );
  }

  return (
    <div className="space-y-4 md:space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Earned" value={`$${fmt(dashboard?.total_earned || 0)}`} icon={<DollarSign />} />
        <StatCard label="Pending Payout" value={`$${fmt(dashboard?.pending_payout || 0)}`} icon={<TrendingUp />} />
        <StatCard label="Referrals" value={String(dashboard?.total_referrals || 0)} icon={<Users />} />
        <StatCard label="Level" value={`L${dashboard?.level || 1}`} icon={<Award />} />
      </div>

      {dashboard?.referral_link && (
        <Card>
          <CardHeader
            title="Your Referral Link"
            description={
              <>
                Code: <span className="font-mono font-semibold text-accent">{dashboard.referral_code}</span>
              </>
            }
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <div className="min-w-0 flex-1">
              <Input
                aria-label="Referral link"
                type="text"
                readOnly
                value={dashboard.referral_link}
                icon={<Share2 />}
                className="font-mono text-xs"
              />
            </div>
            <Button
              variant="secondary"
              leftIcon={<Copy className="h-4 w-4" />}
              onClick={() => { navigator.clipboard.writeText(dashboard.referral_link); toast.success('Copied!'); }}
            >
              Copy
            </Button>
          </div>
        </Card>
      )}

      {referrals.length > 0 && (
        <DataTable
          title="My Referrals"
          headers={['User', 'Joined', 'Balance']}
          rows={referrals.map((r: any) => [
            (
              <div key={`u-${r.id}`}>
                <p className="font-medium text-text-primary">{r.referred_user?.name}</p>
                <p className="text-xxs text-text-tertiary">{r.referred_user?.email}</p>
              </div>
            ),
            <span key={`d-${r.id}`} className="text-text-tertiary">{r.referred_user?.joined_at ? fmtDate(r.referred_user.joined_at) : '—'}</span>,
            <span key={`b-${r.id}`} className="font-mono tabular-nums text-text-primary">${fmt(r.total_deposit || 0)}</span>,
          ])}
          align={['left', 'left', 'right']}
        />
      )}

      {commissions.length > 0 && (
        <DataTable
          title="Commission History"
          headers={['From', 'Type', 'Level', 'Amount', 'Status']}
          rows={commissions.map((c: any) => [
            <span key={`s-${c.id}`} className="text-text-primary">{c.source_user?.name}</span>,
            <span key={`t-${c.id}`} className="capitalize text-text-tertiary">{c.commission_type?.replace('_', ' ')}</span>,
            <span key={`l-${c.id}`} className="text-text-tertiary">L{c.mlm_level}</span>,
            <span key={`a-${c.id}`} className="font-mono tabular-nums text-success">${fmt(c.amount || 0)}</span>,
            (
              <Badge key={`st-${c.id}`} size="sm" dot variant={c.status === 'paid' ? 'success' : 'warning'}>
                {c.status}
              </Badge>
            ),
          ])}
          align={['left', 'left', 'left', 'right', 'right']}
        />
      )}
    </div>
  );
}


function SubBrokerTab() {
  const [status, setStatus] = useState<any>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const s = await api.get<any>('/business/status');
        setStatus(s);
        if (s.is_ib) {
          try {
            const d = await api.get<any>('/business/sub-broker/dashboard');
            setDashboard(d);
          } catch {}
        }
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const handleApply = async () => {
    setApplying(true);
    try {
      await api.post('/business/apply-sub-broker', { company_name: companyName || undefined });
      toast.success('Sub-broker application submitted!');
      const s = await api.get<any>('/business/status');
      setStatus(s);
    } catch (e: unknown) {
      toast.error(getErrorMessage(e, 'Failed'));
    } finally {
      setApplying(false);
    }
  };

  if (loading) return <TabSkeleton />;

  if (status?.application_status === 'pending') {
    return <PendingCard message="Your sub-broker application is under review." />;
  }

  if (dashboard) {
    return (
      <div className="space-y-4 md:space-y-5">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Clients" value={String(dashboard.direct_clients || 0)} icon={<Users />} />
          <StatCard label="Total Earned" value={`$${fmt(dashboard.total_earned || 0)}`} icon={<DollarSign />} />
          <StatCard label="Pending" value={`$${fmt(dashboard.pending_payout || 0)}`} icon={<TrendingUp />} />
          <StatCard label="Commission" value={`$${fmt(dashboard.total_commission || 0)}`} icon={<Award />} />
        </div>

        <Card>
          <CardHeader title="Your Referral Code" />
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-md border border-border-primary bg-bg-tertiary px-4 py-2 font-mono text-lg font-bold tabular-nums text-accent">
              {dashboard.referral_code}
            </span>
            <Button
              variant="secondary"
              leftIcon={<Copy className="h-4 w-4" />}
              onClick={() => { navigator.clipboard.writeText(dashboard.referral_code); toast.success('Copied!'); }}
            >
              Copy
            </Button>
          </div>
        </Card>

        {dashboard.clients?.length > 0 && (
          <DataTable
            title="Your Clients"
            headers={['Client', 'Status', 'Balance', 'Joined']}
            rows={dashboard.clients.map((c: any) => [
              (
                <div key={`c-${c.user_id}`}>
                  <p className="font-medium text-text-primary">{c.name}</p>
                  <p className="text-xxs text-text-tertiary">{c.email}</p>
                </div>
              ),
              (
                <Badge key={`s-${c.user_id}`} size="sm" dot variant={c.status === 'active' ? 'success' : 'neutral'}>
                  {c.status}
                </Badge>
              ),
              <span key={`b-${c.user_id}`} className="font-mono tabular-nums text-text-primary">${fmt(c.total_balance || 0)}</span>,
              <span key={`d-${c.user_id}`} className="text-text-tertiary">{c.joined_at ? fmtDate(c.joined_at) : '—'}</span>,
            ])}
            align={['left', 'left', 'right', 'left']}
          />
        )}
      </div>
    );
  }

  return (
    <CtaCard
      eyebrow="Sub-Broker"
      title="Become a Sub-Broker"
      subtitle="Partner with us as a sub-broker. Get your own referral code, manage clients and earn revenue share on all their trading activity."
      benefits={[
        'Direct revenue share on every client trade',
        'Dedicated client management dashboard',
        'Custom referral code for your business',
        'Priority partner support and reporting',
      ]}
      cta={applying ? 'Submitting…' : 'Apply as Sub-Broker'}
      onClick={handleApply}
      disabled={applying}
      extra={(
        <Input
          label="Company Name (optional)"
          type="text"
          value={companyName}
          onChange={e => setCompanyName(e.target.value)}
          placeholder="Your company name"
        />
      )}
    />
  );
}


function NetworkTab() {
  const [tree, setTree] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<any>('/business/ib/tree');
        setTree(res);
      } catch {}
      setLoading(false);
    })();
  }, []);

  if (loading) return <TabSkeleton />;

  if (!tree) {
    return (
      <Card className="border-dashed">
        <EmptyState
          icon={<Network />}
          title="No network yet"
          description="You need to be an approved IB to see your network."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4 md:space-y-5">
      <Card>
        <CardHeader
          title="Your MLM Network"
          actions={<span className="text-xs text-text-tertiary">{tree.total_nodes || 0} members</span>}
        />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <span className="text-text-tertiary">
            Your Code: <span className="font-mono font-bold text-accent">{tree.root?.referral_code}</span>
          </span>
          <span className="text-text-tertiary">
            Level: <span className="font-bold text-text-primary">L{tree.root?.level}</span>
          </span>
          <span className="text-text-tertiary">
            Total Earned: <span className="font-mono font-bold tabular-nums text-success">${fmt(tree.root?.total_earned || 0)}</span>
          </span>
        </div>
      </Card>

      {tree.tree?.length > 0 ? (
        <Card>
          <CardHeader title="Downline Tree" />
          <div className="space-y-0.5">
            {tree.tree.map((node: any) => <TreeNode key={node.id} node={node} depth={0} />)}
          </div>
        </Card>
      ) : (
        <Card className="border-dashed">
          <EmptyState
            compact
            title="No downline members yet"
            description="Share your referral link to grow your network."
          />
        </Card>
      )}
    </div>
  );
}


function TreeNode({ node, depth }: { node: any; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children?.length > 0;

  return (
    <div style={{ marginLeft: depth * 18 }}>
      <Button
        variant="ghost"
        size="sm"
        fullWidth
        className="!justify-start gap-2 px-2 font-normal"
        aria-expanded={hasChildren ? expanded : undefined}
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren ? (
          <ChevronRight
            size={13}
            className={cn('shrink-0 text-text-tertiary transition-transform', expanded && 'rotate-90')}
          />
        ) : (
          <span className="w-[13px] shrink-0 text-center text-text-tertiary">•</span>
        )}
        <span className="truncate font-medium text-text-primary">{node.name || node.email}</span>
        <Badge size="sm" variant="accent" className="font-mono">L{node.depth}</Badge>
        <span className="ml-auto font-mono tabular-nums text-text-tertiary">${fmt(node.total_earned || 0)}</span>
        {!node.is_active && (
          <Badge size="sm" variant="danger">inactive</Badge>
        )}
      </Button>
      {expanded && hasChildren && node.children.map((child: any) => (
        <TreeNode key={child.id} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}


/* ----------------------------------------------------------------------------
   Shared sub-components
   ------------------------------------------------------------------------ */

function PendingCard({ message }: { message: string }) {
  return (
    <Card className="mx-auto max-w-lg">
      <EmptyState
        compact
        icon={<Hourglass />}
        title={
          <span className="flex flex-col items-center gap-2">
            <Badge variant="warning" dot>Application pending</Badge>
            <span>Application Pending</span>
          </span>
        }
        description={message}
      />
    </Card>
  );
}

function CtaCard({
  eyebrow,
  title,
  subtitle,
  benefits,
  cta,
  onClick,
  disabled,
  extra,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  benefits: string[];
  cta: string;
  onClick: () => void;
  disabled?: boolean;
  extra?: ReactNode;
}) {
  return (
    <Card padding="none" className="mx-auto max-w-2xl overflow-hidden">
      <div className="px-6 pb-6 pt-8 text-center sm:px-8">
        <Badge variant="accent">{eyebrow}</Badge>
        <h3 className="mt-3 text-xl font-semibold tracking-tight text-text-primary md:text-2xl">{title}</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-text-secondary">{subtitle}</p>
      </div>
      <div className="border-t border-border-secondary px-6 py-6 sm:px-8">
        <ul className="mx-auto max-w-md space-y-2.5">
          {benefits.map((b) => <BenefitItem key={b}>{b}</BenefitItem>)}
        </ul>
        {extra && <div className="mx-auto mt-5 max-w-md text-left">{extra}</div>}
        <div className="mt-6 flex justify-center">
          <Button variant="primary" size="lg" className="min-w-[200px]" onClick={onClick} disabled={disabled}>
            {cta}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function DataTable({
  title,
  headers,
  rows,
  align,
}: {
  title: string;
  headers: string[];
  rows: ReactNode[][];
  align: Array<'left' | 'right'>;
}) {
  return (
    <Card padding="none">
      <CardHeader title={title} className="mb-0 border-b border-border-secondary px-4 py-3 md:px-5" />
      <Table dense>
        <THead>
          <TR>
            {headers.map((h, i) => (
              <TH key={h} align={align[i] ?? 'left'}>{h}</TH>
            ))}
          </TR>
        </THead>
        <TBody>
          {rows.map((cells, ri) => (
            <TR key={ri} className="hover:bg-bg-hover">
              {cells.map((cell, ci) => (
                <TD key={ci} align={align[ci] ?? 'left'}>{cell}</TD>
              ))}
            </TR>
          ))}
        </TBody>
      </Table>
    </Card>
  );
}
