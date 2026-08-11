'use client';

import { useState, useEffect, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api/client';
import { scorePassword } from '@/lib/passwordStrength';
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
      const ref = new URLSearchParams(window.location.search).get('ref');
      if (ref && ref.trim()) setReferralCode(ref.trim());
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
    <div className="min-h-screen relative overflow-hidden flex flex-col lx-canvas">
      {/* Backdrop — blueprint grid + glow orbs, same language as the landing */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              'linear-gradient(rgb(var(--accent-rgb) / 0.06) 1px, transparent 1px),' +
              'linear-gradient(90deg, rgb(var(--accent-rgb) / 0.06) 1px, transparent 1px)',
            backgroundSize: '44px 44px',
            maskImage: 'radial-gradient(ellipse 80% 60% at 50% 40%, black 30%, transparent 75%)',
          }}
        />
        <div className="absolute -top-24 right-[12%] w-80 h-80 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute bottom-[-6rem] left-[8%] w-72 h-72 rounded-full bg-accent/10 blur-3xl" />
      </div>

      {/* Top bar */}
      <header className="relative z-10 h-16 flex items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label="PowerTradeFX home" className="inline-flex items-center gap-2.5">
          <svg viewBox="0 0 32 32" aria-hidden="true" className="w-8 h-8">
            <rect width="32" height="32" rx="7" className="fill-accent" />
            <path fillRule="evenodd" d="M11 6.5 H19.2 C23.3 6.5 26.2 9.3 26.2 13.2 C26.2 17.1 23.3 19.9 19.2 19.9 H15.2 V25.5 H11 Z M15.2 10.2 V16.2 H18.9 C20.9 16.2 22 15 22 13.2 C22 11.4 20.9 10.2 18.9 10.2 Z" fill="#ffffff" />
          </svg>
          <span className="inline-flex items-baseline font-display font-bold tracking-tight text-lg select-none">
            <span className="text-white">PowerTrade</span>
            <span className="text-accent">FX</span>
          </span>
        </Link>
        <div className="hidden sm:flex items-center gap-3 text-sm text-gray-400">
          {copy.switchPrompt}
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
        {/* decorative floating quote chips */}
        <div className="lx-float lx-card hidden lg:block absolute left-[10%] top-[24%] rounded-2xl px-4 py-3 shadow-2xl" aria-hidden="true">
          <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-0.5">EURUSD</p>
          <p className="font-mono tabular-nums text-sm font-bold text-white">1.08425</p>
          <p className="text-[10px] font-semibold text-emerald-400">live</p>
        </div>
        <div className="lx-float-slow lx-card hidden lg:block absolute right-[10%] bottom-[22%] rounded-2xl px-4 py-3 shadow-2xl" aria-hidden="true">
          <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-0.5">XAUUSD</p>
          <p className="font-mono tabular-nums text-sm font-bold text-white">2,412.50</p>
          <p className="text-[10px] font-semibold text-accent">gold · spot</p>
        </div>

        <div className="w-full max-w-md">
          <div className="lx-card rounded-3xl p-7 sm:p-9 shadow-2xl relative">
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

                  <button
                    type="submit"
                    disabled={submitting}
                    className="lx-cta w-full disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl transition hover:brightness-110 inline-flex items-center justify-center gap-2 mt-1.5"
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
                  >
                    Try free $10,000 demo
                  </button>

                  <div className="text-center text-gray-500 text-sm sm:hidden">
                    {copy.switchPrompt}{' '}
                    <Link href={copy.switchHref} className="text-white font-semibold hover:text-accent">
                      {copy.switchLink}
                    </Link>
                  </div>
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
        />
        {revealable && (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            tabIndex={-1}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-200 transition-colors"
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
