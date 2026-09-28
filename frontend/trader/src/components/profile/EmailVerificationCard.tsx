'use client';

/**
 * Email card on the Profile → Security page.
 *
 * Three states:
 *   • placeholder (wallet-first signup): warning callout pushing the
 *     user to add and verify a real address. Inline OTP form.
 *   • verified: shows the address + a success "Verified" badge + a
 *     "Change email" button that expands the same OTP flow.
 *   • not verified (rare — covers email/password users who haven't
 *     done OTP yet): shows the address + a "Verify now" button that
 *     opens the OTP flow re-using the existing email.
 */
import { useState } from 'react';
import { Mail, ShieldCheck, AlertTriangle, Pencil } from 'lucide-react';
import EmailOtpStep from '@/components/auth/EmailOtpStep';
import { Badge, Button, Card } from '@/components/ui';

export default function EmailVerificationCard({
  email, isVerified, isPlaceholder, onChanged,
}: {
  email: string;
  isVerified: boolean;
  isPlaceholder: boolean;
  /** Fired after a successful OTP verify so the parent can refetch /profile. */
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);

  const headline = isPlaceholder
    ? 'Add an email to your account'
    : isVerified
    ? 'Email — verified'
    : 'Verify your email';

  const sub = isPlaceholder
    ? 'Wallet sign-ins start with a placeholder email. Add a real address you control so we can send you trade confirmations, deposit receipts, and password-reset links.'
    : isVerified
    ? "Verified emails receive every transactional notification we send."
    : 'Confirm you control this address before you can use deposits, withdrawals, and trading.';

  const ok = isVerified && !isPlaceholder;

  return (
    <Card>
      <div className="flex items-start gap-3 mb-3">
        <div
          className={
            'grid h-9 w-9 shrink-0 place-items-center rounded-lg ' +
            (ok ? 'bg-success/10 text-success' : 'bg-warning/15 text-warning')
          }
        >
          <Mail size={16} aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-md font-semibold text-text-primary leading-tight">{headline}</h3>
            {ok && (
              <Badge variant="success" size="sm">
                <ShieldCheck size={10} aria-hidden /> Verified
              </Badge>
            )}
            {!ok && (
              <Badge variant="warning" size="sm">
                <AlertTriangle size={10} aria-hidden /> Needs verification
              </Badge>
            )}
          </div>
          <p className="text-text-tertiary text-xs mt-0.5 leading-relaxed">{sub}</p>
        </div>
      </div>

      {!editing && (
        <div className="space-y-3">
          {!isPlaceholder && (
            <div className="px-3 py-2.5 rounded-md bg-bg-input border border-border-primary text-sm text-text-primary truncate">
              {email}
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => setEditing(true)} leftIcon={<Pencil size={12} aria-hidden />}>
            {isPlaceholder ? 'Add email' : isVerified ? 'Change email' : 'Verify email'}
          </Button>
        </div>
      )}

      {editing && (
        <Card nested padding="sm" className="mt-3">
          <EmailOtpStep
            currentEmail={email}
            isPlaceholder={isPlaceholder}
            onVerified={() => {
              setEditing(false);
              onChanged();
            }}
          />
          <Button variant="ghost" size="xs" onClick={() => setEditing(false)} className="mt-2 -ml-2.5">
            Cancel
          </Button>
        </Card>
      )}
    </Card>
  );
}
