'use client';

import { useState, useEffect, useCallback, useId, type ChangeEvent } from 'react';
import toast from 'react-hot-toast';
import DashboardShell from '@/components/layout/DashboardShell';
import api, { getApiBase } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Input,
  Modal,
  PageHeader,
  Select,
  Skeleton,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
} from '@/components/ui';
import type { BadgeVariant } from '@/components/ui';
import { ShieldCheck, Check, CheckCircle2, Upload, FileText, FileImage, MapPin } from 'lucide-react';

interface KycDocument {
  id: string;
  document_type: string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
}

interface Profile {
  kyc_status: string;
  kyc_documents: KycDocument[];
  country?: string;
  address?: string | null;
}

const DOC_TYPES = [
  { value: 'passport', label: 'Passport' },
  { value: 'national_id', label: 'National ID' },
  { value: 'driving_license', label: 'Driving License' },
  { value: 'id_front', label: 'ID Front' },
  { value: 'id_back', label: 'ID Back' },
  { value: 'proof_of_address', label: 'Proof of Address' },
  { value: 'bank_statement', label: 'Bank Statement' },
  { value: 'other', label: 'Other' },
] as const;

/** Backend: new users `pending`; after upload `submitted`; admin sets `approved` / `rejected`. */
function normalizeKycStatus(raw: string) {
  return (raw || '').toLowerCase().trim();
}

function StatusBadge({ status, kind = 'user' }: { status: string; kind?: 'user' | 'document' }) {
  const s = normalizeKycStatus(status);
  let variant: BadgeVariant = 'neutral';
  let label = 'Not Started';
  if (s === 'pending' && kind === 'document') {
    variant = 'warning';
    label = 'Pending';
  } else if (s === 'verified' || s === 'approved') {
    variant = 'success';
    label = 'Approved';
  } else if (s === 'submitted' || s === 'under_review') {
    variant = 'warning';
    label = 'Under Review';
  } else if (s === 'rejected' || s === 'failed') {
    variant = 'danger';
    label = 'Rejected';
  }
  return (
    <Badge variant={variant} dot size={kind === 'document' ? 'sm' : 'md'}>
      {label}
    </Badge>
  );
}

type FlowStatus = 'not_started' | 'review' | 'rejected' | 'verified';
type StepState = 'done' | 'current' | 'upcoming' | 'blocked';

const STEP_BADGE: Record<StepState, { variant: BadgeVariant; label: string }> = {
  done: { variant: 'success', label: 'Done' },
  current: { variant: 'accent', label: 'In progress' },
  upcoming: { variant: 'neutral', label: 'Pending' },
  blocked: { variant: 'danger', label: 'Action needed' },
};

/** Three-step progress: upload → review → verified. */
function KycStepper({ status }: { status: FlowStatus }) {
  const steps: { title: string; desc: string; state: StepState }[] = [
    {
      title: 'Upload documents',
      desc: 'Government ID and proof of address',
      state: status === 'not_started' ? 'current' : status === 'rejected' ? 'blocked' : 'done',
    },
    {
      title: 'Compliance review',
      desc: 'Usually 24–48 hours',
      state: status === 'review' ? 'current' : status === 'verified' ? 'done' : 'upcoming',
    },
    {
      title: 'Verified',
      desc: 'Deposits, withdrawals and live trading unlocked',
      state: status === 'verified' ? 'done' : 'upcoming',
    },
  ];
  return (
    <Card padding="sm">
      <ol className="grid gap-2 md:grid-cols-3">
        {steps.map((s, i) => {
          const badge = STEP_BADGE[s.state];
          return (
            <li
              key={s.title}
              className={cn('flex items-start gap-3 rounded-md p-3', s.state === 'current' && 'bg-bg-tertiary')}
              aria-current={s.state === 'current' ? 'step' : undefined}
            >
              <span
                className={cn(
                  'grid h-7 w-7 shrink-0 place-items-center rounded-full border font-mono text-xs font-bold tabular-nums',
                  s.state === 'done' && 'border-success bg-success text-text-inverse',
                  s.state === 'current' && 'border-accent bg-accent text-text-on-accent',
                  s.state === 'blocked' && 'border-danger text-danger',
                  s.state === 'upcoming' && 'border-border-primary text-text-tertiary',
                )}
              >
                {s.state === 'done' ? <Check size={14} strokeWidth={3} /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-text-primary">{s.title}</p>
                  <Badge size="sm" dot variant={badge.variant}>
                    {badge.label}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-text-tertiary">{s.desc}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/** Dashed drop-target wrapping a hidden file input. */
function UploadDropzone({
  file,
  accept,
  onChange,
  hint,
  compact,
}: {
  file: File | null;
  accept: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  hint: string;
  compact?: boolean;
}) {
  const inputId = useId();
  return (
    <label
      htmlFor={inputId}
      className={cn(
        'flex w-full cursor-pointer items-center justify-center rounded-lg border-2 border-dashed px-3 transition-colors',
        compact ? 'min-h-[4rem]' : 'min-h-[5.5rem]',
        file ? 'border-accent/40 bg-accent/5' : 'border-border-primary bg-card-nested hover:border-border-strong',
      )}
    >
      <input id={inputId} type="file" accept={accept} className="hidden" onChange={onChange} />
      {file ? (
        <span className="break-all text-center text-sm font-medium text-accent">{file.name}</span>
      ) : (
        <span className="flex flex-col items-center gap-1 py-2 text-center">
          {!compact && <Upload size={18} className="text-text-tertiary" />}
          <span className="text-xs text-text-secondary">{hint}</span>
        </span>
      )}
    </label>
  );
}

function DocumentsTable({ docs }: { docs: KycDocument[] }) {
  return (
    <Table dense>
      <THead>
        <TR>
          <TH>Document</TH>
          <TH>Submitted</TH>
          <TH align="right">Status</TH>
        </TR>
      </THead>
      <TBody>
        {docs.map((doc) => (
          <TR key={doc.id}>
            <TD className="capitalize">
              <span className="inline-flex items-center gap-2">
                <FileText size={14} className="shrink-0 text-text-tertiary" />
                {doc.document_type.replace(/_/g, ' ')}
              </span>
            </TD>
            <TD muted>{new Date(doc.created_at).toLocaleDateString()}</TD>
            <TD align="right">
              <StatusBadge status={doc.status} kind="document" />
            </TD>
          </TR>
        ))}
      </TBody>
    </Table>
  );
}

function KycSkeleton() {
  return (
    <div className="space-y-4 md:space-y-5" aria-busy="true" aria-label="Loading">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-20 w-full" />
      <Card className="space-y-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-11 w-56 max-w-full" />
      </Card>
    </div>
  );
}

export default function KycPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFormModal, setShowFormModal] = useState(false);

  const [docType, setDocType] = useState('passport');
  const [file, setFile] = useState<File | null>(null);
  const [docType2, setDocType2] = useState('proof_of_address');
  const [file2, setFile2] = useState<File | null>(null);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postal, setPostal] = useState('');
  const [country, setCountry] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.get<Profile>('/profile');
      setProfile(data);
      setCountry(data.country ?? '');
      setAddress((data.address ?? '').trim());
    } catch {
      toast.error('Failed to load KYC status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  const kycStatus = normalizeKycStatus(profile?.kyc_status ?? '');
  const isVerified = kycStatus === 'verified' || kycStatus === 'approved';
  const isReview = kycStatus === 'submitted' || kycStatus === 'under_review';
  const isRejected = kycStatus === 'rejected' || kycStatus === 'failed';
  const isNotStarted = !isVerified && !isReview && !isRejected;
  const canSubmit = !isVerified && !isReview;

  const openForm = () => {
    setFile(null);
    setFile2(null);
    setShowFormModal(true);
  };

  const handleSubmit = async () => {
    if (!file) {
      toast.error('Please select a primary document');
      return;
    }
    const fd = new FormData();
    fd.append('document_type', docType);
    fd.append('file', file);
    if (file2) {
      fd.append('document_type_2', docType2);
      fd.append('file_2', file2);
    }
    if (address.trim()) fd.append('residential_address', address.trim());
    if (city.trim()) fd.append('city', city.trim());
    if (postal.trim()) fd.append('postal_code', postal.trim());
    if (country.trim()) fd.append('country_of_residence', country.trim());

    setSubmitting(true);
    try {
      const token = api.getToken();
      // Multipart upload — bypasses the api client (it sets a JSON
      // content-type), but the base URL comes from the same helper the
      // client uses so the request lands on the gateway, not on whatever
      // host the user happens to be browsing.
      const res = await fetch(`${getApiBase()}/profile/kyc/submit/`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
        credentials: 'include',
      });
      const raw = await res.text();
      let json: { detail?: unknown } = {};
      try {
        json = raw ? JSON.parse(raw) : {};
      } catch {
        /* ignore */
      }
      if (!res.ok) {
        const d = json.detail;
        throw new Error(
          typeof d === 'string'
            ? d
            : Array.isArray(d)
              ? d.map((x: { msg?: string }) => x.msg).join(', ')
              : `Submit failed (${res.status})`,
        );
      }
      toast.success('KYC submitted — our team will review within 1–2 business days');
      setShowFormModal(false);
      void fetchProfile();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardShell>
        <KycSkeleton />
      </DashboardShell>
    );
  }

  const flowStatus: FlowStatus = isVerified ? 'verified' : isReview ? 'review' : isRejected ? 'rejected' : 'not_started';
  const docs = profile?.kyc_documents ?? [];
  const rejectionReasons = isRejected ? docs.filter((d) => d.rejection_reason) : [];

  return (
    <DashboardShell>
      <div className="space-y-4 md:space-y-5">
        <PageHeader
          title="KYC Verification"
          description="Complete identity verification to unlock deposits, withdrawals, and live trading. Your documents are encrypted and reviewed by our compliance team."
          actions={<StatusBadge status={profile?.kyc_status ?? ''} />}
        />

        <KycStepper status={flowStatus} />

        {/* Approved — full success state */}
        {isVerified && (
          <Card padding="none">
            <div className="space-y-4 p-8 text-center md:p-10">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-success/30 bg-success/10 text-success">
                <CheckCircle2 size={32} strokeWidth={2} />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Identity verified</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-text-secondary">
                  Your account is fully verified. You can deposit, withdraw, and use all live trading features.
                </p>
              </div>
            </div>
            {docs.length > 0 && (
              <div className="border-t border-border-secondary">
                <p className="px-4 pb-1 pt-4 text-xxs font-bold uppercase tracking-[0.12em] text-text-tertiary">
                  Submitted documents
                </p>
                <DocumentsTable docs={docs} />
              </div>
            )}
          </Card>
        )}

        {/* Main flow: not yet approved */}
        {!isVerified && (
          <>
            <Card>
              <CardHeader
                title="Identity Verification"
                description="Secure KYC — upload government ID and proof of address"
                actions={
                  <span className="grid h-9 w-9 place-items-center rounded-lg border border-accent/20 bg-accent/10 text-accent">
                    <ShieldCheck size={18} strokeWidth={2} />
                  </span>
                }
              />

              {isReview && (
                <p className="text-sm leading-relaxed text-text-secondary">
                  Your documents are under review. This usually takes{' '}
                  <span className="font-medium text-text-primary">24–48 hours</span>. We&apos;ll notify you when the
                  decision is ready.
                </p>
              )}

              {rejectionReasons.length > 0 && (
                <div className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2.5">
                  <p className="mb-1 text-xs font-semibold text-danger">Rejection reason</p>
                  {rejectionReasons.map((d) => (
                    <p key={d.id} className="text-sm text-text-secondary">
                      {d.rejection_reason}
                    </p>
                  ))}
                </div>
              )}

              {(isNotStarted || isRejected) && (
                <div className={cn('space-y-4 py-6 text-center', rejectionReasons.length > 0 && 'mt-4')}>
                  <span className="mx-auto grid h-16 w-16 place-items-center rounded-lg border border-accent/25 bg-accent/10 text-accent">
                    <FileImage size={30} strokeWidth={1.75} />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold text-text-primary">Start Verification</h2>
                    <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-text-secondary">
                      Complete a quick identity verification to unlock deposits, withdrawals, and live trading features.
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    size="lg"
                    leftIcon={<ShieldCheck size={18} strokeWidth={2.5} />}
                    onClick={openForm}
                    className="w-full sm:w-auto sm:min-w-[240px]"
                  >
                    {isRejected ? 'Re-submit KYC' : 'Start KYC Verification'}
                  </Button>
                </div>
              )}
            </Card>

            {/* Info sections — only before review */}
            {(isNotStarted || isRejected) && (
              <>
                <Card>
                  <CardHeader title="What You'll Need" />
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {[
                      {
                        num: '1',
                        title: 'Government ID',
                        desc: "Passport, driver's license, or national ID card",
                        Icon: FileText,
                      },
                      {
                        num: '2',
                        title: 'Proof of Address',
                        desc: 'Utility bill or bank statement (last 3 months)',
                        Icon: MapPin,
                      },
                    ].map(({ num, title, desc, Icon }) => (
                      <Card key={num} nested padding="sm" className="flex items-start gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-accent/20 bg-accent/10 text-accent">
                          <Icon size={18} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xxs font-bold uppercase tracking-[0.12em] text-text-tertiary">Step {num}</p>
                          <p className="text-sm font-semibold text-text-primary">{title}</p>
                          <p className="mt-1 text-xs leading-relaxed text-text-secondary">{desc}</p>
                        </div>
                      </Card>
                    ))}
                  </div>
                </Card>

                <Card>
                  <CardHeader title="Why Verify?" />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {[
                      'Access live trading accounts',
                      'Deposit and withdraw funds',
                      'Higher transaction limits',
                      'Join affiliate program',
                    ].map((item) => (
                      <Card key={item} nested padding="sm" className="flex items-center gap-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-success/20 bg-success/10 text-success">
                          <CheckCircle2 size={16} strokeWidth={2.5} />
                        </span>
                        <span className="text-sm font-medium leading-snug text-text-primary">{item}</span>
                      </Card>
                    ))}
                  </div>
                </Card>
              </>
            )}

            {docs.length > 0 && (
              <Card padding="none">
                <CardHeader title="Submitted Documents" className="mb-0 border-b border-border-secondary px-4 py-3 md:px-5" />
                <DocumentsTable docs={docs} />
              </Card>
            )}
          </>
        )}
      </div>

      {/* Modal: submit form */}
      <Modal
        open={showFormModal && canSubmit}
        onClose={() => !submitting && setShowFormModal(false)}
        title={isRejected ? 'Re-submit documents' : 'Submit documents'}
        width="lg"
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <Select label="Primary document" required value={docType} onChange={(e) => setDocType(e.target.value)}>
              {DOC_TYPES.slice(0, 6).map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
            <UploadDropzone
              file={file}
              accept=".jpg,.jpeg,.png,.pdf,.webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              hint="Tap to upload · JPG, PNG, PDF, WEBP · max 10 MB"
            />
          </div>

          <div className="space-y-2">
            <Select label="Secondary document (optional)" value={docType2} onChange={(e) => setDocType2(e.target.value)}>
              {DOC_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
            <UploadDropzone
              compact
              file={file2}
              accept=".jpg,.jpeg,.png,.pdf,.webp"
              onChange={(e) => setFile2(e.target.files?.[0] ?? null)}
              hint="Upload second file (e.g. proof of address)"
            />
          </div>

          <div className="space-y-3">
            <Input
              label="Address (optional)"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Residential address"
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                aria-label="City"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
              />
              <Input
                aria-label="Postal / ZIP"
                type="text"
                value={postal}
                onChange={(e) => setPostal(e.target.value)}
                placeholder="Postal / ZIP"
              />
            </div>
            <Input
              aria-label="Country"
              type="text"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Country"
            />
          </div>

          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={submitting}
            leftIcon={<ShieldCheck size={18} />}
            onClick={() => void handleSubmit()}
          >
            {submitting ? 'Uploading…' : 'Submit for review'}
          </Button>
        </div>
      </Modal>
    </DashboardShell>
  );
}
