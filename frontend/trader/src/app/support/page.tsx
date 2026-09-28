'use client';

import { useState, useEffect, useCallback, type KeyboardEvent } from 'react';
import toast from 'react-hot-toast';
import DashboardShell from '@/components/layout/DashboardShell';
import api from '@/lib/api/client';
import { cn } from '@/lib/utils';
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
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
  Textarea,
} from '@/components/ui';
import type { BadgeVariant } from '@/components/ui';
import { MessageSquare, Plus, Send, ChevronLeft, Sparkles, Mail, Clock } from 'lucide-react';

interface Message {
  id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
}

interface Ticket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  message_count: number;
  created_at: string;
  messages?: Message[];
}

interface TicketDetail {
  id: string;
  subject: string;
  status: string;
  messages: Message[];
}

function statusVariant(s: string): BadgeVariant {
  const lower = s?.toLowerCase();
  if (lower === 'open') return 'info';
  if (lower === 'in_progress' || lower === 'in progress') return 'warning';
  if (lower === 'resolved' || lower === 'closed') return 'success';
  return 'neutral';
}

function TicketStatus({ status }: { status: string }) {
  return (
    <Badge size="sm" dot variant={statusVariant(status)}>
      {status?.replace('_', ' ')}
    </Badge>
  );
}

/**
 * Module-level (NOT defined inside SupportPage) so its component identity is
 * stable across renders. When this lived inside SupportPage, every keystroke
 * re-created the function, so React saw a "new" component type and remounted
 * the whole modal — dropping input focus after a single character. Lifting it
 * out + passing state via props keeps the inputs mounted.
 */
function NewTicketModal({
  show,
  onClose,
  subject,
  onSubjectChange,
  category,
  onCategoryChange,
  description,
  onDescriptionChange,
  creating,
  onSubmit,
}: {
  show: boolean;
  onClose: () => void;
  subject: string;
  onSubjectChange: (v: string) => void;
  category: string;
  onCategoryChange: (v: string) => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  creating: boolean;
  onSubmit: () => void;
}) {
  return (
    <Modal open={show} onClose={onClose} title="New Support Ticket" width="lg">
      <div className="space-y-4">
        <Input
          label="Subject"
          type="text"
          value={subject}
          onChange={(e) => onSubjectChange(e.target.value)}
          placeholder="Brief description of your issue"
        />
        <Select label="Category" value={category} onChange={(e) => onCategoryChange(e.target.value)}>
          <option>Trading</option>
          <option>Deposit</option>
          <option>Withdrawal</option>
          <option>Account</option>
          <option>Technical</option>
          <option>Other</option>
        </Select>
        <Textarea
          label="Description"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="Describe your issue in detail — what happened, what you expected, any error messages."
          rows={5}
          className="resize-none"
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={onSubmit} loading={creating}>Submit ticket</Button>
        </div>
      </div>
    </Modal>
  );
}

/** One message in the thread: ours on the right (accent tint), support's on the left. */
function MessageBubble({ msg }: { msg: Message }) {
  const mine = !msg.is_admin;
  return (
    <div className={cn('max-w-[85%] sm:max-w-[75%]', mine ? 'ml-auto' : 'mr-auto')}>
      <div
        className={cn(
          'whitespace-pre-wrap break-words rounded-lg border px-3.5 py-2.5 text-sm leading-relaxed text-text-primary',
          mine ? 'border-accent/30 bg-accent/10' : 'border-border-primary bg-card-nested',
        )}
      >
        {msg.message}
      </div>
      <p className={cn('mt-1 px-1 text-xxs text-text-tertiary', mine ? 'text-right' : 'text-left')}>
        {msg.is_admin && <span className="mr-1 font-semibold text-accent">Support</span>}
        {new Date(msg.created_at).toLocaleString()}
      </p>
    </div>
  );
}

function SupportSkeleton() {
  return (
    <div className="space-y-4 md:space-y-5" aria-busy="true" aria-label="Loading support">
      <div className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <Card className="space-y-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
        </Card>
        <Card className="space-y-3">
          <Skeleton className="h-5 w-64 max-w-full" />
          <Skeleton className="h-16 w-3/4" />
          <Skeleton className="ml-auto h-16 w-3/4" />
        </Card>
      </div>
    </div>
  );
}

export default function SupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketDetail, setTicketDetail] = useState<TicketDetail | null>(null);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [reply, setReply] = useState('');
  const [newSubject, setNewSubject] = useState('');
  const [newCategory, setNewCategory] = useState('Trading');
  const [newDescription, setNewDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Mobile-only: when a ticket is picked from the list we slide to the
  // conversation. Back button on the conversation view returns to list.
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

  const fetchTickets = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get<{ items: Ticket[] }>('/support/tickets');
      const items = res.items ?? [];
      setTickets(items);
      if (items.length > 0 && !selectedTicketId) {
        setSelectedTicketId(items[0]!.id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load tickets';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [selectedTicketId]);

  const fetchTicketDetail = useCallback(async (id: string) => {
    try {
      setDetailLoading(true);
      const detail = await api.get<TicketDetail>(`/support/tickets/${id}`);
      setTicketDetail(detail);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load ticket');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  useEffect(() => {
    if (selectedTicketId) {
      fetchTicketDetail(selectedTicketId);
    } else {
      setTicketDetail(null);
    }
  }, [selectedTicketId, fetchTicketDetail]);

  const handleSendReply = async () => {
    if (!reply.trim() || !selectedTicketId) return;
    try {
      setSending(true);
      await api.post(`/support/tickets/${selectedTicketId}/reply`, { message: reply });
      toast.success('Reply sent');
      setReply('');
      fetchTicketDetail(selectedTicketId);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const handleCreateTicket = async () => {
    if (!newSubject.trim() || !newDescription.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    try {
      setCreating(true);
      const res = await api.post<{ id: string }>('/support/tickets', {
        subject: newSubject,
        category: newCategory,
        message: newDescription,
      });
      toast.success('Support ticket created');
      setShowNewTicket(false);
      setNewSubject('');
      setNewDescription('');
      setNewCategory('Trading');
      await fetchTickets();
      if (res.id) {
        setSelectedTicketId(res.id);
        setMobileView('detail');
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to create ticket');
    } finally {
      setCreating(false);
    }
  };

  const selectTicket = (id: string) => {
    setSelectedTicketId(id);
    setMobileView('detail');
  };

  if (loading) {
    return (
      <DashboardShell>
        <SupportSkeleton />
      </DashboardShell>
    );
  }

  const ticketModal = (
    <NewTicketModal
      show={showNewTicket}
      onClose={() => setShowNewTicket(false)}
      subject={newSubject}
      onSubjectChange={setNewSubject}
      category={newCategory}
      onCategoryChange={setNewCategory}
      description={newDescription}
      onDescriptionChange={setNewDescription}
      creating={creating}
      onSubmit={handleCreateTicket}
    />
  );

  // ── Error state ───────────────────────────────────────────────────────
  if (error && !tickets.length) {
    return (
      <DashboardShell>
        <div className="space-y-4 md:space-y-5">
          <PageHeader title="Support" />
          <Card>
            <EmptyState
              icon={<MessageSquare />}
              title="Couldn't load your tickets"
              description={error}
              action={<Button variant="primary" size="sm" onClick={fetchTickets}>Retry</Button>}
            />
          </Card>
        </div>
        {ticketModal}
      </DashboardShell>
    );
  }

  // ── Empty state — no tickets at all ───────────────────────────────────
  if (tickets.length === 0) {
    return (
      <DashboardShell>
        <div className="space-y-4 md:space-y-5">
          <PageHeader title="Support" />
          <Card>
            <EmptyState
              icon={<Sparkles />}
              title="Need a hand?"
              description="Open a support ticket and our team will reply within a few hours. Trading questions, deposit issues, account changes — anything goes."
              action={
                <Button variant="primary" leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} />} onClick={() => setShowNewTicket(true)}>
                  Create your first ticket
                </Button>
              }
            />
          </Card>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border-primary bg-bg-tertiary text-accent">
                <Clock size={18} />
              </span>
              <div>
                <p className="text-sm font-semibold text-text-primary">Typical response</p>
                <p className="mt-0.5 text-xs leading-snug text-text-tertiary">Within a few hours during business days.</p>
              </div>
            </Card>
            <Card className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border-primary bg-bg-tertiary text-accent">
                <Mail size={18} />
              </span>
              <div>
                <p className="text-sm font-semibold text-text-primary">Email a copy</p>
                <p className="mt-0.5 text-xs leading-snug text-text-tertiary">Every reply also goes to your registered email.</p>
              </div>
            </Card>
          </div>
        </div>
        {ticketModal}
      </DashboardShell>
    );
  }

  // ── Has tickets — list + conversation layout ─────────────────────────
  const isClosed =
    ticketDetail?.status?.toLowerCase() === 'resolved' || ticketDetail?.status?.toLowerCase() === 'closed';

  return (
    <DashboardShell>
      {ticketModal}

      <div className="space-y-4 md:space-y-5">
        <PageHeader
          title="Support"
          description="Open a ticket and our team will reply within a few hours."
          actions={
            <Button variant="secondary" leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} />} onClick={() => setShowNewTicket(true)}>
              New ticket
            </Button>
          }
        />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
          {/* Ticket list — hidden on mobile when viewing a conversation */}
          <Card padding="none" className={cn('min-w-0 self-start', mobileView === 'detail' ? 'hidden lg:block' : 'block')}>
            <CardHeader
              title="Your tickets"
              description={`${tickets.length} total`}
              className="mb-0 border-b border-border-secondary px-4 py-3"
            />
            <Table dense>
              <THead>
                <TR>
                  <TH>Subject</TH>
                  <TH align="right">Status</TH>
                </TR>
              </THead>
              <TBody>
                {tickets.map((t) => {
                  const selected = selectedTicketId === t.id;
                  const onKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      selectTicket(t.id);
                    }
                  };
                  return (
                    <TR
                      key={t.id}
                      interactive
                      tabIndex={0}
                      aria-selected={selected}
                      onClick={() => selectTicket(t.id)}
                      onKeyDown={onKeyDown}
                      className={cn('focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/45', selected && 'bg-bg-tertiary')}
                    >
                      <TD className="max-w-0 whitespace-normal">
                        <p className={cn('truncate text-sm', selected ? 'font-semibold text-text-primary' : 'font-medium text-text-primary')}>
                          {t.subject}
                        </p>
                        <p className="mt-0.5 text-xxs text-text-tertiary">
                          {t.message_count ?? 0} messages · {new Date(t.created_at).toLocaleDateString()}
                        </p>
                      </TD>
                      <TD align="right">
                        <TicketStatus status={t.status} />
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </Card>

          {/* Conversation pane — hidden on mobile when on the list */}
          <Card padding="none" className={cn('min-h-[60vh] min-w-0 flex-col', mobileView === 'list' ? 'hidden lg:flex' : 'flex')}>
            {detailLoading ? (
              <div className="space-y-3 p-4" aria-busy="true">
                <Skeleton className="h-5 w-64 max-w-full" />
                <Skeleton className="h-16 w-3/4" />
                <Skeleton className="ml-auto h-16 w-3/4" />
              </div>
            ) : ticketDetail ? (
              <>
                <div className="flex items-center gap-3 border-b border-border-secondary px-4 py-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    iconOnly
                    className="lg:hidden"
                    aria-label="Back to ticket list"
                    onClick={() => setMobileView('list')}
                  >
                    <ChevronLeft size={18} />
                  </Button>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-md font-semibold text-text-primary">{ticketDetail.subject}</h3>
                    <div className="mt-0.5 flex items-center gap-2">
                      <span className="font-mono text-xxs text-text-tertiary">#{ticketDetail.id.slice(0, 8)}</span>
                      <TicketStatus status={ticketDetail.status} />
                    </div>
                  </div>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                  {(ticketDetail.messages ?? []).map((msg) => (
                    <MessageBubble key={msg.id} msg={msg} />
                  ))}
                </div>

                {!isClosed && (
                  <div className="flex items-end gap-2 border-t border-border-secondary p-3">
                    <div className="min-w-0 flex-1">
                      <Textarea
                        aria-label="Reply"
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey && !sending) {
                            e.preventDefault();
                            handleSendReply();
                          }
                        }}
                        placeholder="Type a reply…  (Shift+Enter for a new line)"
                        rows={2}
                        className="max-h-32 resize-none"
                      />
                    </div>
                    <Button
                      variant="primary"
                      leftIcon={<Send className="h-4 w-4" />}
                      onClick={handleSendReply}
                      disabled={sending || !reply.trim()}
                      loading={sending}
                    >
                      Send
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <EmptyState
                compact
                className="flex-1"
                icon={<MessageSquare />}
                title="No ticket selected"
                description="Pick a ticket from the list to view the conversation."
              />
            )}
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}
