'use client';

/**
 * Admin sign-in (PowerTradeFX Admin) — two-panel card matching the
 * trader auth page: dark hero on the left, white form on the right,
 * orange accent. Functional layer: email + password against the admin
 * cookie session; if the account has two-factor enabled the server
 * answers 403 `mfa_required` and the form switches to a second step
 * that collects a TOTP / backup code and re-submits the same
 * credentials with it. Redirect to /dashboard on success; the security
 * context (audit-logged, isolated JWT, IP-fingerprinted) is surfaced as
 * chips on the hero panel.
 */

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  Lock, Mail, Loader2, AlertCircle, Eye, EyeOff,
  ShieldCheck, KeyRound, Activity, ArrowLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuthStore } from '@/stores/authStore';
import { useAuthRehydrated } from '@/hooks/useAuthRehydrated';
import { ApiError } from '@/lib/api';

type Step = 'credentials' | 'mfa';

/** 6-digit TOTP or a backup code (alphanumeric, dashes allowed). */
const MFA_CODE_MAX_LEN = 16;
const sanitizeMfaCode = (raw: string) =>
  raw.replace(/[^A-Za-z0-9-]/g, '').slice(0, MFA_CODE_MAX_LEN);

/** 429 lockout copy — prefer the Retry-After window, fall back to the server text. */
function lockoutMessage(err: ApiError): string {
  const secs = err.retryAfter;
  if (typeof secs === 'number' && secs > 0) {
    const mins = Math.ceil(secs / 60);
    const when = secs < 60
      ? `${secs} second${secs === 1 ? '' : 's'}`
      : `${mins} minute${mins === 1 ? '' : 's'}`;
    return `Too many failed sign-in attempts — try again in ${when}.`;
  }
  return err.message || 'Too many failed sign-in attempts — try again later.';
}

export default function AdminLoginPage() {
  const router = useRouter();
  const { login, isAuthenticated } = useAuthStore();
  const authRehydrated = useAuthRehydrated();

  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // White-label: on a tenant admin host (admin.<broker-domain>) the login
  // page carries the BROKER's identity, not the platform's. The /api/*
  // rewrite proxies this to the gateway's public by-domain lookup.
  const [brand, setBrand] = useState<{ name: string; logoUrl: string | null } | null>(null);
  useEffect(() => {
    const host = window.location.hostname.toLowerCase();
    const platformHosts = new Set(['admin.powertradefx.com', 'localhost', '127.0.0.1']);
    if (platformHosts.has(host)) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v1/branding/by-domain?host=${encodeURIComponent(host)}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled || !data?.is_white_label) return;
        const name = (data.brand_name || '').trim() || 'Broker';
        const logoUrl = data.logo_url || null;
        setBrand({ name, logoUrl });
        document.title = `${name} Admin`;
        if (logoUrl) {
          const icon = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
          if (icon) icon.href = logoUrl;
          const link = document.createElement('link');
          link.rel = 'icon';
          link.href = logoUrl;
          link.setAttribute('data-wl-icon', '1');
          document.head.appendChild(link);
        }
      } catch {
        /* platform branding stays */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!authRehydrated) return;
    if (isAuthenticated) router.replace('/dashboard');
  }, [authRehydrated, isAuthenticated, router]);

  const backToCredentials = () => {
    setStep('credentials');
    setTotpCode('');
    setError('');
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const normalisedEmail = email.trim().toLowerCase();
    try {
      if (step === 'mfa') {
        await login(normalisedEmail, password, totpCode.trim());
      } else {
        await login(normalisedEmail, password);
      }
      toast.success('Welcome back');
      router.push('/dashboard');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.code === 'mfa_required') {
          if (step === 'mfa') {
            // Re-submitted without a code (shouldn't happen — button is
            // disabled on empty input) — stay here and prompt.
            setError('Enter your authentication code to continue.');
          } else {
            setStep('mfa');
            setTotpCode('');
          }
        } else if (err.code === 'mfa_invalid') {
          setError(err.message || 'Invalid two-factor code');
          setTotpCode('');
        } else if (err.status === 429) {
          setError(lockoutMessage(err));
        } else if (err.status === 401 && !err.code) {
          // Wrong email or password. One neutral sentence, never the raw
          // HTTP status; the server keeps it identical for unknown emails.
          setError('Incorrect email or password. Please try again.');
        } else if (err.status >= 500 || err.status === 0) {
          setError('We could not sign you in right now. Please try again in a moment.');
        } else {
          // e.g. `mfa_enrolment_required`, inactive account: the server's
          // message is already written for the admin.
          setError(err.message || 'Sign-in failed. Please try again.');
        }
      } else {
        // fetch() itself failed: offline, DNS, blocked request.
        setError('Could not reach the server. Check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const isMfaStep = step === 'mfa';
  const submitDisabled = loading || (isMfaStep && totpCode.trim().length === 0);

  return (
    <div className="min-h-screen flex items-center justify-center overflow-hidden bg-[#FAFAFA] p-4">
      <div className="w-full relative max-w-5xl rounded-3xl overflow-hidden flex flex-col md:flex-row shadow-2xl ring-1 ring-black/5">
        {/* Decorative orange ball behind the left panel */}
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-t from-transparent to-black/60" />
          <div className="absolute -bottom-12 -left-8 w-60 h-60 bg-[#E94E1B] rounded-full opacity-90" />
          <div className="absolute -bottom-6 left-32 w-32 h-20 bg-white rounded-full opacity-90 blur-2xl" />
        </div>

        {/* Left dark hero panel */}
        <div className="bg-black text-white p-8 md:p-12 md:w-1/2 relative overflow-hidden z-10 flex flex-col justify-between min-h-[22rem] md:min-h-[38rem]">
          <span className="inline-flex items-center self-start relative z-10 bg-white/95 rounded-lg px-3 py-1.5">
            {brand ? (
              brand.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={brand.logoUrl}
                  alt={brand.name}
                  className="h-8 w-auto max-w-[180px] object-contain"
                />
              ) : (
                <span className="font-bold tracking-tight text-lg text-[#0A0A0A] select-none">
                  {brand.name}
                </span>
              )
            ) : (
              <Image
                src="/logo.png"
                alt="PowerTradeFX"
                width={200}
                height={44}
                priority
                className="h-8 w-auto"
              />
            )}
          </span>

          <div className="relative z-10">
            <h1 className="text-2xl md:text-3xl font-medium leading-tight tracking-tight">
              Operator console for the {brand ? brand.name : 'PowerTradeFX'} platform.
            </h1>
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80">
                <ShieldCheck size={13} /> Audit-logged
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80">
                <KeyRound size={13} /> Isolated admin JWT
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80">
                <Activity size={13} /> IP-fingerprinted
              </span>
            </div>
          </div>
        </div>

        {/* Right form panel */}
        <div className="p-8 md:p-12 md:w-1/2 flex flex-col justify-center bg-white text-[#0A0A0A] relative z-20">
          <div className="mb-8">
            <p className="text-sm uppercase tracking-wider text-[#E94E1B] font-semibold mb-3">
              Admin access
            </p>
            {isMfaStep ? (
              <>
                <h2 className="text-3xl font-medium mb-2 tracking-tight">Two-factor authentication</h2>
                <p className="text-[#5B5B5B]">
                  Enter the 6-digit code from your authenticator app, or one of your backup codes.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-3xl font-medium mb-2 tracking-tight">Operator console</h2>
                <p className="text-[#5B5B5B]">Authorised personnel only.</p>
              </>
            )}
          </div>

          <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
            {isMfaStep ? (
              <>
                <div>
                  <label htmlFor="mfa-email" className="block text-sm mb-2 text-[#0A0A0A]">Email</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A] pointer-events-none" />
                    <input
                      type="email"
                      id="mfa-email"
                      name="mfa_email"
                      readOnly
                      tabIndex={-1}
                      aria-readonly="true"
                      className="text-sm w-full py-2.5 pl-10 pr-3 border border-[#E5E5E5] rounded-lg bg-[#FAFAFA] text-[#5B5B5B] cursor-default focus:outline-none"
                      value={email.trim().toLowerCase()}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="totp-code" className="block text-sm mb-2 text-[#0A0A0A]">Authentication code</label>
                  <div className="relative">
                    <ShieldCheck size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A] pointer-events-none" />
                    <input
                      type="text"
                      id="totp-code"
                      name="totp_code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      autoFocus
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                      maxLength={MFA_CODE_MAX_LEN}
                      placeholder="123456"
                      aria-describedby="totp-hint"
                      className="text-sm w-full py-2.5 pl-10 pr-3 border border-[#E5E5E5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E94E1B]/20 focus:border-[#E94E1B] bg-white text-black transition-colors tracking-widest"
                      value={totpCode}
                      onChange={(e) => setTotpCode(sanitizeMfaCode(e.target.value))}
                    />
                  </div>
                  <p id="totp-hint" className="mt-2 text-xs text-[#9A9A9A]">
                    Backup codes are accepted here too.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label htmlFor="email" className="block text-sm mb-2 text-[#0A0A0A]">Email</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A] pointer-events-none" />
                    <input
                      type="email"
                      id="email"
                      name="email"
                      autoComplete="email"
                      placeholder={brand ? `admin@${window.location.hostname.replace(/^admin\./, "")}` : "admin@powertradefx.com"}
                      className="text-sm w-full py-2.5 pl-10 pr-3 border border-[#E5E5E5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E94E1B]/20 focus:border-[#E94E1B] bg-white text-black transition-colors"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm mb-2 text-[#0A0A0A]">Password</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A] pointer-events-none" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="password"
                      name="password"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="text-sm w-full py-2.5 pl-10 pr-10 border border-[#E5E5E5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E94E1B]/20 focus:border-[#E94E1B] bg-white text-black transition-colors"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9A9A9A] hover:text-[#0A0A0A] transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {error && (
              <div role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                <AlertCircle size={15} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitDisabled}
              className="w-full bg-[#E94E1B] hover:bg-[#C73E11] disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium py-2.5 px-4 rounded-lg transition-colors inline-flex items-center justify-center gap-2 mt-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {isMfaStep
                ? (loading ? 'Verifying…' : 'Verify and sign in')
                : (loading ? 'Signing in…' : 'Sign in')}
            </button>

            {isMfaStep ? (
              <button
                type="button"
                onClick={backToCredentials}
                disabled={loading}
                className="inline-flex items-center justify-center gap-1.5 self-center text-xs text-[#5B5B5B] hover:text-[#0A0A0A] disabled:opacity-60 disabled:cursor-not-allowed transition-colors mt-1"
              >
                <ArrowLeft size={13} /> Back to sign in
              </button>
            ) : (
              <p className="text-center text-xs text-[#9A9A9A] mt-1">
                All sign-in attempts are logged with IP and device fingerprint.
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
