'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Eye, EyeOff, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api/client';
import { scorePassword } from '@/lib/passwordStrength';
import { DotMatrixBackdrop } from '@/components/ui/dot-matrix-backdrop';
import '@/components/landing/landing-fx.css';

type Mode = 'login' | 'signup';
type SignupStep = 'credentials' | 'otp';

interface FullScreenSignupProps {
  /** 'signup' renders the create-account form, 'login' renders the sign-in
   *  form against the same chrome. Defaults to 'signup'. */
  mode?: Mode;
}

const COPY: Record<Mode, {
  hero: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  cta: string;
  switchPrompt: string;
  switchLink: string;
  switchHref: string;
}> = {
  signup: {
    hero: 'A precision-engineered trading platform for serious investors.',
    eyebrow: 'Welcome to PowerTradeFX',
    title: 'Create your account',
    subtitle: 'Trade FX, indices, metals and crypto with bank-grade execution.',
    cta: 'Create account',
    switchPrompt: 'Already have an account?',
    switchLink: 'Sign in',
    switchHref: '/auth/login',
  },
  login: {
    hero: 'A precision-engineered trading platform for serious investors.',
    eyebrow: 'Welcome back',
    title: 'Sign in to PowerTradeFX',
    subtitle: 'Access your portfolio, positions and watchlists.',
    cta: 'Sign in',
    switchPrompt: "Don't have an account yet?",
    switchLink: 'Create one',
    switchHref: '/auth/register',
  },
};

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export const FullScreenSignup = ({ mode = 'signup' }: FullScreenSignupProps) => {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const demoLogin = useAuthStore((s) => s.demoLogin);
  const refreshUser = useAuthStore((s) => s.refreshUser);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<SignupStep>('credentials');
  // IB referral code from the signup link (?ref=CODE). Captured on mount so
  // it survives the credentials → OTP step transition, then sent to
  // /auth/register/start where the backend stages it and attributes the
  // referral on verify. Without this the IB never gets credited.
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const copy = COPY[mode];

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      const ref = q.get('ref');
      if (ref && ref.trim()) setReferralCode(ref.trim());
      // ?email= is set by the marketing footer's sign-up field, which is a
      // plain GET form onto this page. Only ever pre-fills the input — the
      // usual validation and OTP flow still run.
      const prefill = q.get('email');
      if (prefill && prefill.trim()) setEmail(prefill.trim());
    } catch {
      /* no query string / SSR guard — ignore */
    }
  }, []);

  const submitCredentials = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // In-flight guard: a double-click fires two submit events before React
    // re-renders the disabled button — without this the OTP email went out
    // twice on registration.
    if (submitting) return;
    const next: Record<string, string> = {};

    if (!isValidEmail(email)) next.email = 'Please enter a valid email address.';

    if (mode === 'signup') {
      const strength = scorePassword(password);
      if (!strength.ok) next.password = strength.issues[0] ?? 'Choose a stronger password.';
      if (confirmPassword !== password) next.confirmPassword = 'Passwords do not match.';
    } else if (password.length === 0) {
      next.password = 'Enter your password.';
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    try {
      setSubmitting(true);
      const normalizedEmail = email.trim().toLowerCase();
      if (mode === 'login') {
        await login(normalizedEmail, password);
        router.push('/dashboard');
        return;
      }

      // signup: stage the registration in Redis and send an OTP. The
      // `users` row + auth cookies are NOT created here — that happens
      // only after the OTP is verified in submitOtp(). If the user
      // typo'd their email, they can hit the X / "Use a different
      // email" button and the pending entry expires harmlessly.
      await api.post('/auth/register/start', {
        email: normalizedEmail,
        password,
        first_name: 'New',
        last_name: 'Trader',
        ...(referralCode ? { referral_code: referralCode } : {}),
      });
      toast.success('Verification code sent. Check your email.');
      setStep('otp');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const submitOtp = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return; // double-click guard
    const code = otp.replace(/\D/g, '');
    if (code.length !== 6) {
      setErrors({ otp: 'Enter the 6-digit code.' });
      return;
    }
    setErrors({});
    try {
      setSubmitting(true);
      // This is now the ONLY step that actually creates the user row
      // and issues auth cookies. The response sets the cookies via
      // Set-Cookie; refreshUser() then hydrates the trader store.
      await api.post('/auth/register/verify', {
        email: email.trim().toLowerCase(),
        otp: code,
      });
      await refreshUser();
      toast.success('Email verified. Welcome to PowerTradeFX.');
      router.push('/dashboard');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid or expired code.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  /** Back out of the OTP step. Tells the server to drop the pending
   *  registration so the address is freed immediately (otherwise it
   *  Redis-TTLs out in 10 minutes), then returns to the credentials
   *  form so the user can fix a typo. Errors are swallowed — the
   *  Redis key will expire even if the cancel call fails. */
  const cancelPendingRegistration = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (normalizedEmail) {
      try {
        await api.post('/auth/register/cancel', { email: normalizedEmail });
      } catch {
        /* ignore — TTL will handle it */
      }
    }
    setOtp('');
    setErrors({});
    setStep('credentials');
  };

  const handleDemo = async () => {
    try {
      setSubmitting(true);
      await demoLogin();
      toast.success('Demo account ready. Welcome to PowerTradeFX.');
      router.push('/dashboard');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not start a demo session.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const resendOtp = async () => {
    if (submitting) return; // double-click guard
    try {
      setSubmitting(true);
      await api.post('/auth/register/resend', { email: email.trim().toLowerCase() });
      toast.success('Code resent.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not send code.';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    /* lx-auth swaps the accent tokens from the app's blue to gold for
       this card and everything under it — see landing-fx.css. */
    /* min-h-[100dvh] over min-h-screen: `screen` is 100vh, which on mobile
       is the URL-bar-hidden height, so the card sat taller than the visible
       area and the footer legal line fell below the fold. */
    <div className="lx-auth min-h-screen min-h-[100dvh] relative overflow-hidden flex flex-col bg-black">
      {/* Backdrop — dot matrix sweeping out from the centre, then a vignette
          so the card does not fight the grid for attention. */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
        <DotMatrixBackdrop className="absolute inset-0 h-full w-full" />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at center, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0) 70%)',
          }}
        />
      </div>

      {/* Top bar */}
      <header className="relative z-10 h-16 flex items-center justify-between px-5 sm:px-8">
        {/* The lockup already carries the name, so it replaces the old tile +
            type pair rather than joining it. Sized by height; `w-auto` keeps
            the ~6.5:1 ratio and stops next/image warning about a modified
            dimension. The link's accessible name comes from aria-label, so
            the image itself is decorative.

            `sizes` is required for the same reason as the marketing bar:
            without it next/image ships a 1920px variant for a ~180px box. */}
        <Link href="/" aria-label="PowerTradeFX home" className="inline-flex items-center">
          <Image
            src="/portal/logo.png"
            alt=""
            width={1536}
            height={236}
            sizes="200px"
            priority
            className="h-6 w-auto select-none sm:h-7"
          />
        </Link>
        {/* The mode switch lives here, to the side, on every breakpoint —
            only the prompt text drops away on narrow screens. */}
        <div className="flex items-center gap-3 text-sm text-gray-400">
          <span className="hidden sm:inline">{copy.switchPrompt}</span>
          <Link
            href={copy.switchHref}
            className="font-semibold text-white border border-white/15 hover:border-accent/60 rounded-xl px-4 py-2 transition-colors"
          >
            {copy.switchLink}
          </Link>
        </div>
      </header>

      {/* Centre stage */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="relative rounded-xl border border-[#222] bg-[#121212] p-7 shadow-[0_10px_40px_rgba(0,0,0,0.8)] sm:p-9">
            {step === 'credentials' && (
              <>
                <div className="mb-7">
                  <p className="text-xs uppercase tracking-[0.2em] text-accent font-semibold mb-2">
                    {copy.eyebrow}
                  </p>
                  <h1 className="font-display text-2xl sm:text-[1.7rem] font-bold text-white tracking-tight mb-1.5">
                    {copy.title}
                  </h1>
                  <p className="text-sm text-gray-400">{copy.subtitle}</p>
                </div>

                <form className="flex flex-col gap-4" onSubmit={submitCredentials} noValidate>
                  <Field
                    id="email"
                    label="Email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={setEmail}
                    error={errors.email}
                  />

                  <Field
                    id="password"
                    label={mode === 'signup' ? 'Create password' : 'Password'}
                    type="password"
                    revealable
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    placeholder={mode === 'signup' ? 'At least 8 characters' : 'Enter your password'}
                    value={password}
                    onChange={setPassword}
                    error={errors.password}
                    rightSlot={
                      mode === 'login' ? (
                        <Link
                          href="/auth/reset-password"
                          className="text-xs text-gray-500 hover:text-accent transition-colors"
                        >
                          Forgot password?
                        </Link>
                      ) : null
                    }
                  />

                  {mode === 'signup' && <PasswordStrengthMeter password={password} />}

                  {mode === 'signup' && (
                    <Field
                      id="confirm-password"
                      label="Confirm password"
                      type="password"
                      revealable
                      autoComplete="new-password"
                      placeholder="Re-type your password"
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      error={errors.confirmPassword}
                    />
                  )}

                  {/* Same reason as the fields above — see Field(). Only the
                      two buttons in THIS branch need it: the OTP step's
                      buttons never exist at hydration time, because `step`
                      always starts at 'credentials'. */}
                  <button
                    type="submit"
                    disabled={submitting}
                    className="lx-cta w-full disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl transition hover:brightness-110 inline-flex items-center justify-center gap-2 mt-1.5"
                    suppressHydrationWarning
                  >
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {submitting ? 'Please wait…' : copy.cta}
                  </button>

                  <div className="flex items-center gap-3 my-0.5">
                    <span className="flex-1 h-px bg-white/10" aria-hidden />
                    <span className="text-[11px] uppercase tracking-wider text-gray-500">or</span>
                    <span className="flex-1 h-px bg-white/10" aria-hidden />
                  </div>

                  <button
                    type="button"
                    onClick={handleDemo}
                    disabled={submitting}
                    className="w-full disabled:opacity-60 disabled:cursor-not-allowed border border-white/15 hover:border-accent/60 text-gray-200 hover:text-white font-semibold py-3 px-4 rounded-xl transition-colors inline-flex items-center justify-center gap-2"
                    suppressHydrationWarning
                  >
                    Try free $10,000 demo
                  </button>
                </form>
              </>
            )}

            {step === 'otp' && (
              <>
                {/* Prominent close — lets the user back out of the OTP step if
                    they typo'd their email. Wired to cancel the pending
                    registration server-side so the address is freed
                    immediately. */}
                <button
                  type="button"
                  onClick={cancelPendingRegistration}
                  aria-label="Close verification — use a different email"
                  className="absolute top-4 right-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="mb-7">
                  <p className="text-xs uppercase tracking-[0.2em] text-accent font-semibold mb-2">
                    Verify your email
                  </p>
                  <h1 className="font-display text-2xl font-bold text-white tracking-tight mb-1.5">
                    Enter the code
                  </h1>
                  <p className="text-sm text-gray-400">
                    We sent a 6-digit code to <span className="font-medium text-white">{email}</span>.
                  </p>
                </div>

                <form className="flex flex-col gap-4" onSubmit={submitOtp} noValidate>
                  <div>
                    <input
                      type="text"
                      id="otp"
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="••••••"
                      className={`lx-field lx-field--otp focus:outline-none transition-colors ${
                        errors.otp ? 'lx-field--error' : ''
                      }`}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      aria-invalid={!!errors.otp}
                      aria-describedby={errors.otp ? 'otp-error' : undefined}
                    />
                    {errors.otp && (
                      <p id="otp-error" className="text-red-400 text-xs mt-1.5">{errors.otp}</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="lx-cta w-full disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl transition hover:brightness-110 inline-flex items-center justify-center gap-2 mt-1"
                  >
                    {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    {submitting ? 'Verifying…' : 'Verify and continue'}
                  </button>

                  <div className="flex items-center justify-between text-sm">
                    <button
                      type="button"
                      onClick={cancelPendingRegistration}
                      className="text-gray-500 hover:text-white transition-colors"
                    >
                      ← Use a different email
                    </button>
                    <button
                      type="button"
                      onClick={resendOtp}
                      className="text-white font-semibold hover:text-accent transition-colors"
                    >
                      Resend code
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>

          <p className="text-center text-xs text-gray-500 mt-6 leading-relaxed">
            By continuing you agree to our{' '}
            <Link href="/terms" className="text-gray-300 hover:text-accent underline underline-offset-2">Terms</Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-gray-300 hover:text-accent underline underline-offset-2">Privacy Policy</Link>.
            Trading involves significant risk.
          </p>
        </div>
      </main>
    </div>
  );
};

export default FullScreenSignup;

/* ────────────────────────────────────────────────────────────────────── */

interface FieldProps {
  id: string;
  label: string;
  type: string;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  placeholder?: string;
  value: string;
  onChange: (next: string) => void;
  error?: string;
  rightSlot?: React.ReactNode;
  maxLength?: number;
  /** Password fields: render an eye toggle that reveals/hides the value. */
  revealable?: boolean;
}

function Field({
  id, label, type, autoComplete, inputMode, placeholder,
  value, onChange, error, rightSlot, maxLength, revealable,
}: FieldProps) {
  const [revealed, setRevealed] = useState(false);
  const effectiveType = revealable && revealed ? 'text' : type;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label htmlFor={id} className="block text-sm font-medium text-gray-300">
          {label}
        </label>
        {rightSlot}
      </div>
      {/* suppressHydrationWarning on the field and its reveal toggle: a
          password manager is exactly the kind of extension that stamps an
          `fdprocessedid` attribute onto inputs and buttons before React
          hydrates, and a sign-in form is the first thing it goes for. Both
          elements render from props and from `revealed`, whose initial value
          matches on both sides, so nothing genuine is being masked. */}
      <div className="relative">
        <input
          type={effectiveType}
          id={id}
          autoComplete={autoComplete}
          inputMode={inputMode}
          maxLength={maxLength}
          placeholder={placeholder}
          className={`lx-field focus:outline-none transition-colors ${
            revealable ? 'lx-field--pr' : ''
          } ${error ? 'lx-field--error' : ''}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          suppressHydrationWarning
        />
        {revealable && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            tabIndex={-1}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-200 transition-colors"
            suppressHydrationWarning
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="text-red-400 text-xs mt-1.5">
          {error}
        </p>
      )}
    </div>
  );
}

/* Live strength meter for the signup password: 4-segment bar coloured by
   score, the score label, and the specific unmet requirements. */
function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const s = scorePassword(password);
  const segColors = ['#EF4444', '#EF4444', '#F59E0B', '#84CC16', '#22C55E'];
  const color = segColors[s.score];
  return (
    <div className="-mt-2" aria-live="polite">
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4].map((seg) => (
          <span
            key={seg}
            className="h-1 flex-1 rounded-full transition-colors"
            style={{ backgroundColor: s.score >= seg ? color : 'rgba(255,255,255,0.12)' }}
          />
        ))}
        <span className="text-xs ml-1 shrink-0" style={{ color: s.score >= 2 ? color : '#EF4444' }}>
          {s.label}
        </span>
      </div>
      {s.issues.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {s.issues.map((issue) => (
            <li key={issue} className="text-xs text-gray-500 flex items-start gap-1.5">
              <span className="text-red-400 leading-4">•</span>
              {issue}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
