'use client';

/**
 * Email OTP step inside the OnboardingGate (and reused on the profile
 * Security card for the change-email flow).
 *
 * Two phases:
 *   1. Enter the address → POST /auth/email/start-verification
 *      Backend rate-limits 1/min and 3/hour per user.
 *   2. Enter the 6-digit code → POST /auth/email/verify-otp
 *      Backend allows 5 wrong attempts before consuming the code.
 *
 * On success we call onVerified() which the parent uses to refreshUser()
 * (the gate then unmounts itself because email_verified flips to true).
 */
import { useEffect, useRef, useState } from 'react';
import { Mail, ArrowRight, RotateCcw, Check, Pencil } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api/client';
import { getErrorMessage } from '@/lib/errors';
import { Button, Input } from '@/components/ui';

const RESEND_COOLDOWN_SECONDS = 60;

type StartResp = { sent: boolean; target_email: string; expires_at: string; ttl_seconds: number };
type VerifyResp = { verified: boolean; email: string; email_verified: boolean; action: string };

export default function EmailOtpStep({
  currentEmail, isPlaceholder, onVerified,
}: {
  /** users.email value at render time. Used to pre-fill if it's a real address; cleared if placeholder. */
  currentEmail: string;
  isPlaceholder: boolean;
  onVerified: () => void;
}) {
  // Skip the "enter email" step when we already know the address. On
  // fresh signup the register flow has already fired start-verification
  // against the user's real email, so the only thing left for the user
  // to do is type the 6-digit code that's already in their inbox. The
  // "Use a different email" link in the OTP phase still gives them an
  // escape hatch if they need to switch addresses.
  const hasRealEmail = !isPlaceholder && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(currentEmail);
  const [phase, setPhase] = useState<'enter-email' | 'enter-otp'>(
    hasRealEmail ? 'enter-otp' : 'enter-email',
  );
  const [email, setEmail] = useState(isPlaceholder ? '' : currentEmail);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(hasRealEmail ? RESEND_COOLDOWN_SECONDS : 0);
  const [error, setError] = useState<string | null>(null);

  // Resend cooldown timer.
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (resendIn <= 0) {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
      return;
    }
    if (tickRef.current) return;
    tickRef.current = setInterval(() => {
      setResendIn((s) => Math.max(0, s - 1));
    }, 1000);
    return () => {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    };
  }, [resendIn]);

  const sendCode = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
      setError('Enter a valid email address');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const res = await api.post<StartResp>('/auth/email/start-verification', { email: trimmed });
      toast.success(`Code sent to ${res.target_email}`);
      setPhase('enter-otp');
      setOtp('');
      setResendIn(RESEND_COOLDOWN_SECONDS);
    } catch (e: unknown) {
      const msg = getErrorMessage(e, 'Could not send code');
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  // Jump back to the address step so the user can correct / change the
  // email the code was sent to. The field stays pre-filled with the
  // current address so they can edit it rather than retype from scratch.
  const editEmail = () => {
    setPhase('enter-email');
    setOtp('');
    setError(null);
  };

  const verifyCode = async () => {
    const code = otp.trim();
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await api.post<VerifyResp>('/auth/email/verify-otp', { otp: code });
      toast.success('Email verified');
      onVerified();
    } catch (e: unknown) {
      const msg = getErrorMessage(e, 'Could not verify code');
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {phase === 'enter-email' ? (
        <>
          <Input
            label="Email address"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            icon={<Mail aria-hidden />}
            error={error}
            autoFocus
          />
          <Button
            variant="primary"
            fullWidth
            onClick={() => void sendCode()}
            disabled={busy || !email.trim()}
            loading={busy}
            leftIcon={<ArrowRight size={14} aria-hidden />}
          >
            Send code
          </Button>
        </>
      ) : (
        <>
          <p className="text-xs text-text-secondary leading-relaxed">
            We sent a 6-digit code to{' '}
            <span className="font-semibold text-text-primary tabular-nums">{email.trim().toLowerCase()}</span>
            <Button
              variant="link"
              size="xs"
              onClick={editEmail}
              className="ml-1 align-middle gap-0.5"
              aria-label="Edit email address"
              leftIcon={<Pencil size={11} aria-hidden />}
            >
              Edit
            </Button>
            . It expires in 10 minutes.
          </p>
          <Input
            label="Verification code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={otp}
            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={(e) => { if (e.key === 'Enter') void verifyCode(); }}
            placeholder="••••••"
            size="lg"
            numeric
            className="text-center text-xl tracking-[0.5em]"
            error={error}
            autoFocus
          />
          <Button
            variant="primary"
            fullWidth
            onClick={() => void verifyCode()}
            disabled={busy || otp.length !== 6}
            loading={busy}
            leftIcon={<Check size={14} aria-hidden />}
          >
            Verify
          </Button>
          <div className="flex items-center justify-between text-xs text-text-tertiary">
            <Button variant="ghost" size="xs" onClick={editEmail} className="-ml-2.5">
              Use a different email
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => { if (resendIn === 0) void sendCode(); }}
              disabled={resendIn > 0 || busy}
              className="-mr-2.5"
              leftIcon={<RotateCcw size={10} aria-hidden />}
            >
              {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
