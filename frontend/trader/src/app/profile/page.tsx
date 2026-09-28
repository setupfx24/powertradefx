'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';
import { User, Shield, Bell, Monitor, ChevronRight , type LucideIcon } from 'lucide-react';
import { Badge, Button, Card, CardFooter, CardHeader, EmptyState, Input, PageHeader, StatCard, Tabs } from '@/components/ui';
import DashboardShell from '@/components/layout/DashboardShell';
import EmailVerificationCard from '@/components/profile/EmailVerificationCard';
import api from '@/lib/api/client';

interface Profile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  country: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  kyc_status: string;
  two_factor_enabled: boolean;
  // Onboarding flag from /profile (mirror /auth/me) — drives the
  // EmailVerificationCard's "verified" badge and the Change-Email
  // button. `is_wallet_placeholder` removed with the wallet-integration
  // purge: no SIWE flow means no @wallet.powertradefx.local placeholder
  // emails any more.
  email_verified?: boolean;
}

interface TradingAccount {
  id: string;
  account_number: string;
  account_type: string;
  balance: number;
  is_demo: boolean;
  status?: string;
  leverage?: number;
}

interface Session {
  id: string;
  ip_address: string;
  user_agent: string;
  device_info: string;
  created_at: string;
}

type TabId = 'profile' | 'security' | 'notifications' | 'sessions';

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'profile',       label: 'Profile',       icon: User },
  { id: 'security',      label: 'Security',       icon: Shield },
  { id: 'notifications', label: 'Notifications',  icon: Bell },
  { id: 'sessions',      label: 'Sessions',       icon: Monitor },
];

function fmt(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(n || 0);
}

/* 2FA card is hidden until the verify/enable flow is fixed end-to-end.
   State + handlers are left intact (referenced by the still-present
   JSX inside the `&& TWO_FA_ENABLED` gate below) so re-enabling is a
   one-line flip rather than a re-implementation. */
const TWO_FA_ENABLED = false;

export default function ProfilePage() {
  const [tab, setTab] = useState<TabId>('profile');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [accounts, setAccounts] = useState<TradingAccount[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Profile form
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postal, setPostal] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password form
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  // Sessions
  const [terminatingSession, setTerminatingSession] = useState<string | null>(null);

  // 2FA setup
  const [showTwoFaSetup, setShowTwoFaSetup] = useState(false);
  const [twoFaUri, setTwoFaUri] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [settingUp2Fa, setSettingUp2Fa] = useState(false);
  const [verifying2Fa, setVerifying2Fa] = useState(false);

  // Notification preferences (namespaced key; one-time migration from the
  // legacy un-namespaced 'notifPrefs' key).
  const NOTIF_PREFS_KEY = 'sc.notifPrefs';
  const [notifPrefs, setNotifPrefs] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      let raw = localStorage.getItem(NOTIF_PREFS_KEY);
      if (raw === null) {
        const legacy = localStorage.getItem('notifPrefs');
        if (legacy !== null) {
          localStorage.setItem(NOTIF_PREFS_KEY, legacy);
          localStorage.removeItem('notifPrefs');
          raw = legacy;
        }
      }
      return JSON.parse(raw || '{}');
    }
    catch { return {}; }
  });

  const toggleNotifPref = (key: string) => {
    setNotifPrefs((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(updated));
      return updated;
    });
  };

  const handleSetup2Fa = async () => {
    try {
      setSettingUp2Fa(true);
      const res = await api.post<{ otp_uri: string }>('/auth/2fa/setup');
      setTwoFaUri(res.otp_uri);
      setShowTwoFaSetup(true);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to initiate 2FA setup');
    } finally { setSettingUp2Fa(false); }
  };

  const handleVerify2Fa = async () => {
    if (!twoFaCode.trim()) { toast.error('Please enter the verification code'); return; }
    try {
      setVerifying2Fa(true);
      await api.post('/auth/2fa/verify', { code: twoFaCode });
      toast.success('2FA enabled successfully!');
      setShowTwoFaSetup(false); setTwoFaCode(''); setTwoFaUri('');
      fetchProfile();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Invalid verification code');
    } finally { setVerifying2Fa(false); }
  };

  const handleDisable2Fa = async () => {
    try {
      setSettingUp2Fa(true);
      await api.delete('/auth/2fa');
      toast.success('2FA disabled');
      fetchProfile();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to disable 2FA');
    } finally { setSettingUp2Fa(false); }
  };

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true); setError(null);
      const data = await api.get<Profile>('/profile');
      setProfile(data);
      setFirstName(data.first_name ?? '');
      setLastName(data.last_name ?? '');
      setPhone(data.phone ?? '');
      setCountry(data.country ?? '');
      setAddress((data.address ?? '').trim());
      setCity((data.city ?? '').trim());
      setState((data.state ?? '').trim());
      setPostal((data.postal_code ?? '').trim());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
    } finally { setLoading(false); }
  }, []);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await api.get<{ accounts?: TradingAccount[]; items?: TradingAccount[] }>('/accounts');
      setAccounts(res.accounts ?? res.items ?? []);
    } catch { /* non-critical */ }
  }, []);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await api.get<{ sessions: Session[] }>('/profile/sessions');
      setSessions(res.sessions ?? []);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { fetchProfile(); fetchAccounts(); }, [fetchProfile, fetchAccounts]);
  useEffect(() => { if (tab === 'sessions') fetchSessions(); }, [tab, fetchSessions]);

  const handleSaveProfile = async () => {
    try {
      setSavingProfile(true);
      await api.put('/profile', {
        first_name: firstName, last_name: lastName,
        phone, country, address, city, state, postal_code: postal,
      });
      toast.success('Profile updated successfully!');
      fetchProfile();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to update profile');
    } finally { setSavingProfile(false); }
  };

  const handleChangePassword = async () => {
    if (!currentPass || !newPass) { toast.error('Please fill in all password fields'); return; }
    if (newPass !== confirmPass) { toast.error('New passwords do not match'); return; }
    try {
      setChangingPassword(true);
      await api.put('/profile/password', { current_password: currentPass, new_password: newPass });
      toast.success('Password changed successfully!');
      setCurrentPass(''); setNewPass(''); setConfirmPass('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to change password');
    } finally { setChangingPassword(false); }
  };

  const handleTerminateSession = async (sessionId: string) => {
    try {
      setTerminatingSession(sessionId);
      await api.delete(`/profile/sessions/${sessionId}`);
      toast.success('Session terminated');
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to terminate session');
    } finally { setTerminatingSession(null); }
  };


  const initials =
    `${(profile?.first_name?.[0] ?? '').toUpperCase()}${(profile?.last_name?.[0] ?? '').toUpperCase()}` || 'U';
  const username = profile?.email ? profile.email.split('@')[0] : '';

  const totalBalance = accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0);
  const kycVerified = profile?.kyc_status === 'verified';
  const emailVerified = Boolean(profile?.email_verified);

  return (
    <DashboardShell>
      {/* No mainClassName / inner scroll wrappers — they used to turn
          <main> into a narrow flex column where DashboardShell's
          1600px wrapper collapsed to content width, making the
          Settings page render as a ~700px centred card on wide
          monitors. The default shell layout (mx-auto max-w-[1600px]
          + native main scroll) gives full width across the page. */}
      <div className="space-y-4 md:space-y-5 animate-fade-in">
        <PageHeader
          title="Settings"
          description="Profile, security, notifications, and active sessions — aligned with PowerTradeFX."
        >
          {!loading && !error && (
            <Tabs
              variant="underline"
              aria-label="Settings sections"
              tabs={TABS.map((t) => ({ id: t.id, label: t.label, icon: <t.icon /> }))}
              active={tab}
              onChange={(id) => setTab(id as TabId)}
            />
          )}
        </PageHeader>

        {loading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy>
            {TABS.map((t) => (
              <StatCard key={t.id} label={t.label} value="" loading />
            ))}
          </div>
        )}
        {!loading && error && (
          <Card>
            <EmptyState
              compact
              title="Could not load settings"
              description={<span className="text-danger">{error}</span>}
              action={
                <Button variant="outline" size="sm" onClick={fetchProfile}>
                  Retry
                </Button>
              }
            />
          </Card>
        )}

        {!loading && !error && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Trading accounts" value={accounts.length} icon={<Monitor />} />
              <StatCard label="Total balance" value={fmt(totalBalance)} icon={<User />} hint="Across all accounts" />
              <StatCard
                label="KYC"
                value={kycVerified ? 'Verified' : 'Pending'}
                icon={<Shield />}
                delta={
                  <Badge variant={kycVerified ? 'success' : 'warning'} size="sm">
                    {profile?.kyc_status ?? 'not started'}
                  </Badge>
                }
              />
              <StatCard
                label="Email"
                value={emailVerified ? 'Verified' : 'Unverified'}
                icon={<Bell />}
                delta={
                  <Badge variant={emailVerified ? 'success' : 'warning'} size="sm">
                    {emailVerified ? 'verified' : 'needs verification'}
                  </Badge>
                }
              />
            </div>

            <div key={tab} className="animate-fade-in min-h-[200px]">
              {/* ── Profile tab ── */}
              {tab === 'profile' && (
                <div className="w-full space-y-4 md:space-y-5">
                  <Card>
                    <CardHeader title="Profile Information" />

                    {/* Avatar row */}
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-16 h-16 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center text-xl font-bold text-accent">
                        {initials}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{profile?.first_name} {profile?.last_name}</p>
                        <p className="text-xs text-text-tertiary">{profile?.email}</p>
                        <p className={cn('text-xxs mt-0.5 font-semibold uppercase tracking-wide', kycVerified ? 'text-success' : 'text-warning')}>
                          {kycVerified ? 'Verified Account' : `KYC: ${profile?.kyc_status ?? 'not started'}`}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Username (read-only) */}
                      <Input label="Username" type="text" value={`@${username}`} disabled readOnly />

                      {/* Name row */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input label="First Name" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                        <Input label="Last Name" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                      </div>

                      {/* Email + Phone */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input label="Email" type="email" defaultValue={profile?.email ?? ''} disabled />
                        <Input label="Phone Number" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                      </div>

                      {/* Street address */}
                      <Input
                        label="Street Address"
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="House number, street"
                      />

                      {/* City + State */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input label="City" type="text" value={city} onChange={(e) => setCity(e.target.value)} />
                        <Input label="State / Province" type="text" value={state} onChange={(e) => setState(e.target.value)} />
                      </div>

                      {/* Postal */}
                      <Input label="Postal / Zip Code" type="text" value={postal} onChange={(e) => setPostal(e.target.value)} placeholder="" />

                      <CardFooter>
                        <Button variant="primary" onClick={handleSaveProfile} loading={savingProfile}>
                          Save Changes
                        </Button>
                      </CardFooter>
                    </div>
                  </Card>

                  {/* Trading Accounts section */}
                  {accounts.length > 0 && (
                    <Card padding="none" className="overflow-hidden">
                      <CardHeader title="Trading Accounts" className="px-4 md:px-5 pt-4 md:pt-5 mb-0 pb-3 border-b border-border-primary" />
                      <ul className="divide-y divide-border-secondary">
                        {accounts.map((acc) => (
                          <li key={acc.id} className="px-4 md:px-5 py-3.5 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-md bg-bg-tertiary border border-border-primary flex items-center justify-center text-xs font-bold text-text-tertiary shrink-0">
                                {acc.is_demo ? 'D' : 'L'}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-text-primary truncate font-mono tabular-nums">{acc.account_number}</p>
                                <p className="text-xs text-text-tertiary">
                                  {acc.is_demo ? 'Demo Account' : 'Live Account'}
                                  {acc.leverage ? ` • 1:${acc.leverage}` : ''}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <p className="text-sm font-semibold text-text-primary font-mono tabular-nums">{fmt(acc.balance)}</p>
                                <p className="text-xxs text-text-tertiary">Balance</p>
                              </div>
                              <Badge variant={(acc.status ?? 'active') === 'active' ? 'success' : 'neutral'} size="sm">
                                {acc.status ?? 'active'}
                              </Badge>
                              <ChevronRight size={14} className="text-text-tertiary" aria-hidden />
                            </div>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  )}
                </div>
              )}

              {/* ── Security tab ── */}
              {tab === 'security' && (
                <div className="max-w-lg mx-auto space-y-4 md:space-y-5">
                  <Card>
                    <CardHeader title="Change Password" />
                    <div className="space-y-3">
                      <Input label="Current Password" type="password" value={currentPass} onChange={(e) => setCurrentPass(e.target.value)} />
                      <Input label="New Password" type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
                      <Input label="Confirm New Password" type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} />
                      <Button variant="primary" onClick={handleChangePassword} loading={changingPassword}>
                        Update Password
                      </Button>
                    </div>
                  </Card>

                  {TWO_FA_ENABLED && (
                    <Card>
                      <CardHeader title="Two-Factor Authentication" description="Add an extra layer of security to your account." />

                      {showTwoFaSetup ? (
                        <div className="space-y-4">
                          <Card nested padding="sm">
                            <p className="text-xs text-text-secondary mb-2">Scan this URI in your authenticator app:</p>
                            <div className="font-mono text-xs text-text-primary break-all bg-card rounded-md p-3 border border-border-primary select-all">{twoFaUri}</div>
                          </Card>
                          <Input
                            label="Verification Code"
                            type="text"
                            value={twoFaCode}
                            onChange={(e) => setTwoFaCode(e.target.value)}
                            placeholder="Enter 6-digit code"
                            maxLength={6}
                            numeric
                          />
                          <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => { setShowTwoFaSetup(false); setTwoFaCode(''); setTwoFaUri(''); }}>Cancel</Button>
                            <Button variant="primary" size="sm" onClick={handleVerify2Fa} loading={verifying2Fa}>Verify & Enable</Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <span className="text-sm text-text-primary">{profile?.two_factor_enabled ? '2FA is enabled' : '2FA is disabled'}</span>
                          <Button
                            variant={profile?.two_factor_enabled ? 'danger' : 'primary'}
                            size="sm"
                            onClick={profile?.two_factor_enabled ? handleDisable2Fa : handleSetup2Fa}
                            loading={settingUp2Fa}
                          >
                            {profile?.two_factor_enabled ? 'Disable 2FA' : 'Enable 2FA'}
                          </Button>
                        </div>
                      )}
                    </Card>
                  )}

                  <EmailVerificationCard
                    email={profile?.email || ''}
                    isVerified={Boolean(profile?.email_verified)}
                    // No wallet flow any more, so no placeholder emails to
                    // distinguish — every account is a real-email account.
                    isPlaceholder={false}
                    onChanged={() => void fetchProfile()}
                  />
                </div>
              )}

              {/* ── Notifications tab ── */}
              {tab === 'notifications' && (
                <div className="max-w-lg mx-auto">
                  <Card padding="none" className="overflow-hidden">
                    <CardHeader title="Notification preferences" className="px-4 md:px-5 pt-4 md:pt-5 mb-0 pb-3 border-b border-border-primary" />
                    <ul className="divide-y divide-border-secondary">
                      {NOTIF_OPTIONS.map((n) => (
                        <li key={n.key} className="px-4 md:px-5 py-3 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm text-text-primary">{n.label}</div>
                            <div className="text-xs text-text-tertiary mt-0.5">{n.desc}</div>
                          </div>
                          <Toggle
                            on={!!notifPrefs[n.key]}
                            onToggle={() => toggleNotifPref(n.key)}
                            label={n.label}
                          />
                        </li>
                      ))}
                    </ul>
                  </Card>
                </div>
              )}

              {/* ── Sessions tab ── */}
              {tab === 'sessions' && (
                <Card>
                  <CardHeader title="Active Sessions" />
                  {sessions.length === 0 ? (
                    <EmptyState compact icon={<Monitor />} title="No active sessions" />
                  ) : (
                    <div className="space-y-3">
                      {sessions.map((s) => (
                        <Card key={s.id} nested padding="sm" className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-text-primary">{s.device_info || s.user_agent || 'Unknown Device'}</div>
                            <div className="text-xs text-text-tertiary mt-0.5">
                              IP: <span className="font-mono tabular-nums">{s.ip_address}</span> • {new Date(s.created_at).toLocaleString()}
                            </div>
                          </div>
                          <Button variant="danger" size="sm" onClick={() => handleTerminateSession(s.id)} loading={terminatingSession === s.id}>
                            Terminate
                          </Button>
                        </Card>
                      ))}
                    </div>
                  )}
                </Card>
              )}
            </div>
          </>
        )}
      </div>
    </DashboardShell>
  );
}

const NOTIF_OPTIONS = [
  { label: 'Trade Executed',   desc: 'When a trade is placed or closed',          key: 'trade_executed' },
  { label: 'Deposit Approved', desc: 'When a deposit is processed',               key: 'deposit_approved' },
  { label: 'Margin Warning',   desc: 'When margin level drops below threshold',   key: 'margin_warning' },
  { label: 'Price Alerts',     desc: 'Custom price level notifications',          key: 'price_alerts' },
  { label: 'Copy Trading',     desc: 'When a copied trader opens a position',     key: 'copy_trading' },
  { label: 'Newsletter',       desc: 'Weekly market analysis and updates',        key: 'newsletter' },
];

/** Local switch — there is no Toggle primitive in components/ui yet. Token utilities only. */
function Toggle({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full border transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45',
        on ? 'bg-accent border-accent' : 'bg-bg-tertiary border-border-strong',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute top-0.5 h-4 w-4 rounded-full shadow-sm transition-[left] duration-150',
          on ? 'left-[18px] bg-text-on-accent' : 'left-0.5 bg-text-secondary',
        )}
      />
    </button>
  );
}
