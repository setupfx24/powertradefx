'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api/client';
import toast from 'react-hot-toast';
import DashboardShell from '@/components/layout/DashboardShell';
import {
  Badge, Button, Card, CardHeader, EmptyState, Modal, PageHeader, Select, Skeleton, StatCard,
  Table, THead, TBody, TR, TH, TD,
} from '@/components/ui';
import {
  Plug, Key, Copy, RefreshCw, Trash2,
  Clock, Zap, AlertTriangle, Check,
  Terminal, Radio, BookOpen, ShieldCheck,
} from 'lucide-react';

interface AccountWithKey {
  account_id: string;
  account_number: string;
  balance: number;
  equity: number;
  is_demo: boolean;
  currency: string;
  account_type: string;
  has_key: boolean;
  key_id: string | null;
  api_key: string | null;
  api_secret: string | null;
  label: string;
  trades_count: number;
  last_used_at: string | null;
  key_created_at: string | null;
}

interface GeneratedKey {
  api_key: string;
  api_secret: string;
  account_number: string;
}

function fmt(n: number) { return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function ago(d: string | null) {
  if (!d) return 'Never';
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
/** First characters of a key for tables — never the whole credential. */
function keyPrefix(k: string | null) {
  if (!k) return '—';
  return `${k.slice(0, 10)}…`;
}

/** Best-effort bot-facing WebSocket URL for the current host. The wss tick
 *  stream lives on the api. subdomain (the web proxy can't upgrade sockets);
 *  in local dev the bot connects to the gateway on :8000 directly. */
function deriveWsUrl(origin: string): string {
  if (!origin) return 'wss://api.<your-domain>/ws/algo/prices';
  try {
    const u = new URL(origin);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
      return `ws://${u.hostname}:8000/ws/algo/prices`;
    }
    const parts = u.hostname.split('.');
    const first = parts[0];
    if (first && ['trade', 'app', 'www'].includes(first)) parts.shift();
    const proto = u.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://api.${parts.join('.')}/ws/algo/prices`;
  } catch {
    return 'wss://api.<your-domain>/ws/algo/prices';
  }
}

const CODE_CLASS =
  'block w-full overflow-x-auto bg-bg-tertiary border border-border-primary rounded-lg font-mono text-xs text-text-primary';

/* ─── Local pieces ─────────────────────────────────────────────────────── */

/** Copy-to-clipboard icon button; shows a green check while `copied`. */
function CopyButton({ copied, onClick, label, size = 'md' }: { copied: boolean; onClick: () => void; label: string; size?: 'sm' | 'md' }) {
  return (
    <Button type="button" variant="secondary" size={size} iconOnly aria-label={label} onClick={onClick} className="shrink-0">
      {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
    </Button>
  );
}

/** One labelled credential / endpoint line with a copy action. */
function CodeLine({
  label, value, copied, onCopy, tone = 'default', muted, className,
}: {
  label: string;
  value: string;
  copied?: boolean;
  onCopy?: () => void;
  tone?: 'default' | 'danger';
  muted?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <span className={`block mb-1.5 text-xs font-semibold uppercase tracking-wide ${tone === 'danger' ? 'text-danger' : 'text-text-secondary'}`}>{label}</span>
      <div className="flex items-center gap-2">
        <code
          className={`${CODE_CLASS} flex-1 px-3 py-2.5 truncate select-all ${tone === 'danger' ? '!border-danger/25 !bg-danger/10 !text-danger' : ''} ${muted ? '!text-text-tertiary' : ''}`}
        >
          {value}
        </code>
        {onCopy && <CopyButton copied={!!copied} onClick={onCopy} label={`Copy ${label}`} />}
      </div>
    </div>
  );
}

const MASKED_SECRET = '••••••••••••••••••••••••••••••••';

export default function AlgoConnectorPage() {
  const [accounts, setAccounts] = useState<AccountWithKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [generatedKey, setGeneratedKey] = useState<GeneratedKey | null>(null);
  const [selectedAccId, setSelectedAccId] = useState<string>('');
  const [copied, setCopied] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ items: AccountWithKey[] }>('/algo/accounts');
      const items = res.items || [];
      setAccounts(items);
      const firstAcc = items[0];
      if (!selectedAccId && firstAcc) setSelectedAccId(firstAcc.account_id);
    } catch (e: any) { toast.error(e.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const selected = accounts.find(a => a.account_id === selectedAccId);
  const connectedKeys = accounts.filter(a => a.has_key);

  // Bot-facing base URLs shown in the quick-start card. REST is derived from the
  // current origin; the wss tick stream must hit the api. subdomain directly
  // (the Next proxy can't upgrade WebSockets).
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const restBase = origin ? `${origin}/api/algo` : '/api/algo';
  const wsBase = deriveWsUrl(origin);

  const generateKey = async (accountId: string) => {
    setActionLoading(accountId);
    try {
      const res = await api.post<GeneratedKey & { message: string }>('/algo/generate', { account_id: accountId });
      setGeneratedKey({ api_key: res.api_key, api_secret: res.api_secret, account_number: res.account_number });
      toast.success('API Key generated!');
      fetchData();
    } catch (e: any) { toast.error(e.message); }
    finally { setActionLoading(null); }
  };

  const revokeKey = async (keyId: string, accountNumber: string) => {
    if (!confirm(`Revoke API key for ${accountNumber}? Your algo bot will stop working for this account.`)) return;
    setActionLoading(keyId);
    try {
      await api.post('/algo/revoke', { key_id: keyId });
      toast.success('Key revoked');
      fetchData();
    } catch (e: any) { toast.error(e.message); }
    finally { setActionLoading(null); }
  };

  const copyText = (text: string, label?: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label || text);
    setTimeout(() => setCopied(null), 1500);
    toast.success('Copied to clipboard');
  };

  const generating = !!selected && actionLoading === selected.account_id;

  return (
    <DashboardShell>
      <div className="mx-auto w-full max-w-4xl space-y-4 md:space-y-5">

        <PageHeader
          eyebrow="Automation"
          title="Algo Connector"
          description="Generate API credentials for any trading account and connect your algorithmic trading bot."
          actions={
            <Button
              type="button"
              variant="primary"
              leftIcon={<Key size={16} />}
              loading={generating}
              disabled={!selected || loading}
              onClick={() => selected && generateKey(selected.account_id)}
            >
              {selected?.has_key ? 'Regenerate API key' : 'Generate API key'}
            </Button>
          }
        />

        {/* ─── KPIs ─── */}
        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard label="Trading accounts" value={accounts.length} icon={<Plug />} loading={loading} />
          <StatCard label="Connected bots" value={connectedKeys.length} icon={<Radio />} hint="accounts with an active key" loading={loading} />
        </div>

        {/* ─── Account Selector + credentials ─── */}
        <Card>
          <CardHeader
            title="Trading account"
            description="Choose an account to generate or manage API keys"
          />
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : accounts.length === 0 ? (
            <EmptyState
              compact
              icon={<Plug />}
              title="No trading accounts found"
              description="Create a trading account first, then come back to connect a bot."
            />
          ) : (
            <div className="space-y-4">
              <Select
                label="Account"
                value={selectedAccId}
                onChange={e => setSelectedAccId(e.target.value)}
              >
                {accounts.map(a => (
                  <option key={a.account_id} value={a.account_id}>
                    {a.account_number} — {a.account_type}{a.is_demo ? ' (Demo)' : ''} — ${fmt(a.balance)} {a.has_key ? ' ✓ Connected' : ''}
                  </option>
                ))}
              </Select>

              {selected && (
                selected.has_key ? (
                  <Card nested padding="sm" className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge variant="success" dot>Connected</Badge>
                      <div className="flex items-center gap-3 text-xs text-text-tertiary">
                        <span className="flex items-center gap-1.5"><Zap size={12} className="text-accent" /> {selected.trades_count} trades</span>
                        <span className="flex items-center gap-1.5"><Clock size={12} /> Last used: {ago(selected.last_used_at)}</span>
                      </div>
                    </div>
                    <CodeLine
                      label="API Key"
                      value={selected.api_key || ''}
                      copied={copied === 'key'}
                      onCopy={() => copyText(selected.api_key || '', 'key')}
                    />
                    <div>
                      <CodeLine label="API Secret" value={MASKED_SECRET} muted />
                      <p className="text-xs text-text-tertiary mt-1.5">
                        The secret is shown only once, when the key is generated. Lost it? Regenerate the key pair.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pt-3 border-t border-border-secondary">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        leftIcon={<RefreshCw size={12} />}
                        loading={actionLoading === selected.account_id}
                        onClick={() => generateKey(selected.account_id)}
                      >
                        Regenerate
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        leftIcon={<Trash2 size={12} />}
                        loading={actionLoading === selected.key_id!}
                        onClick={() => revokeKey(selected.key_id!, selected.account_number)}
                      >
                        Revoke
                      </Button>
                    </div>
                  </Card>
                ) : (
                  <EmptyState
                    compact
                    icon={<Key />}
                    title="No API key for this account"
                    description="Generate a key pair to let your bot trade on this account."
                    action={
                      <Button
                        type="button"
                        variant="secondary"
                        leftIcon={<Key size={14} />}
                        loading={actionLoading === selected.account_id}
                        onClick={() => generateKey(selected.account_id)}
                      >
                        Generate API key
                      </Button>
                    }
                  />
                )
              )}
            </div>
          )}
        </Card>

        {/* ─── API keys table ─── */}
        {connectedKeys.length > 0 && (
          <Card padding="none">
            <CardHeader
              title={`API keys (${connectedKeys.length})`}
              description="One key pair per trading account."
              className="px-4 pt-4 md:px-5 md:pt-5"
            />
            <Table dense>
              <THead>
                <TR>
                  <TH>Label</TH>
                  <TH>Key prefix</TH>
                  <TH>Created</TH>
                  <TH>Last used</TH>
                  <TH align="right">Trades</TH>
                  <TH>Status</TH>
                  <TH align="right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {connectedKeys.map(a => (
                  <TR key={a.account_id}>
                    <TD>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{a.label || a.account_number}</span>
                        <span className="text-xs text-text-tertiary">{a.account_number} · {a.account_type}</span>
                        {a.is_demo && <Badge variant="warning" size="sm">Demo</Badge>}
                      </div>
                    </TD>
                    <TD className="font-mono">{keyPrefix(a.api_key)}</TD>
                    <TD muted>{ago(a.key_created_at)}</TD>
                    <TD muted>{ago(a.last_used_at)}</TD>
                    <TD numeric>{a.trades_count}</TD>
                    <TD><Badge variant="success" size="sm" dot>Active</Badge></TD>
                    <TD align="right">
                      <div className="inline-flex items-center gap-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          iconOnly
                          aria-label={`Copy API key for ${a.account_number}`}
                          onClick={() => copyText(a.api_key || '', `list-key-${a.account_id}`)}
                        >
                          {copied === `list-key-${a.account_id}` ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                        </Button>
                        <Button
                          type="button"
                          variant="danger"
                          size="xs"
                          loading={actionLoading === a.key_id}
                          onClick={() => revokeKey(a.key_id!, a.account_number)}
                        >
                          Revoke
                        </Button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        )}

        {/* ─── Connect Your Bot (quick start) ─── */}
        <Card>
          <CardHeader
            title="Connect your bot"
            description="Paste the credentials above into your bot, then point it at these endpoints."
            actions={<Terminal size={16} className="text-text-tertiary" aria-hidden />}
          />
          <div className="space-y-4">
            {/* Steps */}
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                { n: 1, icon: Key, t: 'Generate a key', d: 'Pick an account above and generate its key + secret.' },
                { n: 2, icon: ShieldCheck, t: 'Add the headers', d: 'Send X-Api-Key and X-Api-Secret on every request.' },
                { n: 3, icon: Zap, t: 'Trade', d: 'POST /trade to BUY, SELL or CLOSE from your bot.' },
              ].map(s => (
                <Card key={s.n} nested padding="sm">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-accent text-text-on-accent text-xxs font-bold">{s.n}</span>
                    <s.icon size={13} className="text-accent" />
                    <span className="text-xs font-semibold text-text-primary">{s.t}</span>
                  </div>
                  <p className="text-xs leading-snug text-text-tertiary">{s.d}</p>
                </Card>
              ))}
            </div>

            {/* Endpoints */}
            <div className="space-y-3">
              {[
                { label: 'REST base', value: restBase, id: 'rest-base' },
                { label: 'Live prices (WebSocket)', value: wsBase, id: 'ws-base' },
              ].map(row => (
                <CodeLine
                  key={row.id}
                  label={row.label}
                  value={row.value}
                  copied={copied === row.id}
                  onCopy={() => copyText(row.value, row.id)}
                />
              ))}
            </div>

            {/* Request sample */}
            <div>
              <span className="block mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">Sample request</span>
              <pre className={`${CODE_CLASS} px-3 py-3 leading-relaxed`}>
                <span className="text-accent">curl</span> -X POST {restBase}/trade{' \\\n'}
                {'  '}-H <span className="text-success">&quot;X-Api-Key: &lt;api_key&gt;&quot;</span>{' \\\n'}
                {'  '}-H <span className="text-success">&quot;X-Api-Secret: &lt;api_secret&gt;&quot;</span>{' \\\n'}
                {'  '}-H <span className="text-success">&quot;Content-Type: application/json&quot;</span>{' \\\n'}
                {'  '}-d <span className="text-info">&apos;{'{'}&quot;symbol&quot;: &quot;EURUSD&quot;, &quot;side&quot;: &quot;BUY&quot;, &quot;lots&quot;: 0.10{'}'}&apos;</span>
              </pre>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/10 px-3 py-2">
              <BookOpen size={14} className="text-warning mt-0.5 shrink-0" />
              <p className="text-xs leading-snug text-text-secondary">
                The <span className="font-semibold">wss://</span> tick stream must use the <span className="font-mono">api.</span> subdomain directly — the web proxy can&apos;t upgrade WebSockets. See <span className="font-semibold">ALGO_API.md</span> for the full endpoint reference, cURL and Python examples.
              </p>
            </div>
          </div>
        </Card>

        {/* ─── Generated Secret Modal ─── */}
        <Modal open={!!generatedKey} onClose={() => setGeneratedKey(null)} title="Save your credentials" width="md">
          {generatedKey && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-warning/25 bg-warning/10 text-warning">
                  <AlertTriangle size={20} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-text-primary">Account {generatedKey.account_number}</p>
                  <p className="text-xs text-text-tertiary">Store these somewhere safe before closing.</p>
                </div>
              </div>

              <div className="rounded-lg border border-warning/25 bg-warning/10 px-3 py-2">
                <p className="text-xs text-warning font-medium">The API Secret will NOT be shown again. Copy and save it now.</p>
              </div>

              <div className="space-y-3">
                <CodeLine
                  label="API Key"
                  value={generatedKey.api_key}
                  copied={copied === 'modal-key'}
                  onCopy={() => copyText(generatedKey.api_key, 'modal-key')}
                  className="[&_code]:whitespace-normal [&_code]:break-all"
                />
                <CodeLine
                  label="API Secret"
                  tone="danger"
                  value={generatedKey.api_secret}
                  copied={copied === 'modal-secret'}
                  onCopy={() => copyText(generatedKey.api_secret, 'modal-secret')}
                  className="[&_code]:whitespace-normal [&_code]:break-all"
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  leftIcon={copied === 'modal-both' ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                  onClick={() => copyText(`API Key: ${generatedKey.api_key}\nAPI Secret: ${generatedKey.api_secret}`, 'modal-both')}
                >
                  {copied === 'modal-both' ? 'Copied!' : 'Copy Both'}
                </Button>
                <Button type="button" variant="primary" onClick={() => setGeneratedKey(null)}>
                  I&apos;ve Saved It
                </Button>
              </div>
            </div>
          )}
        </Modal>

      </div>
    </DashboardShell>
  );
}
