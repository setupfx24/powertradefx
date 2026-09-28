'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Mail, Send, MessageCircle, X, Ticket, Clock } from 'lucide-react';
import { Section, SectionHeading, PageHero } from '@/marketing/components';
import { BRAND_NAME, BRAND_SUPPORT_EMAIL } from '@/lib/brand';

/**
 * Company → Contact.
 *
 * Three ways to reach the team: email, in-app support tickets (/support
 * after sign-in) and the live-chat assistant on this page. The enquiry
 * form still POSTs to /api/v1/public/contact and the success modal only
 * opens once the backend confirms delivery.
 *
 * There is intentionally no phone number and no office address on this
 * page: the ones that used to be here belonged to a previous brand.
 */

const RISK_LINE =
  'Trading leveraged products such as forex and CFDs carries a high level of risk and may not be suitable for all investors. You could lose more than your initial deposit.';

type ChatMessage = { from: 'agent' | 'user'; text: string; time: string };

/** Shared field styling — kept in one place so every input on the form
 *  reads from the same marketing tokens. */
const FIELD_STYLE: React.CSSProperties = {
  background: 'var(--mk-surface-2)',
  border: '1px solid var(--mk-line)',
  borderRadius: 'var(--mk-radius-sm)',
  color: 'var(--mk-text)',
  fontSize: 'var(--mk-text-sm)',
  width: '100%',
  padding: '0.75rem 1rem',
  outline: 'none',
};

const LABEL_STYLE: React.CSSProperties = {
  display: 'block',
  marginBottom: 'var(--mk-space-2)',
  fontSize: 'var(--mk-text-sm)',
  color: 'var(--mk-text-muted)',
};

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
  });

  const [showSuccess, setShowSuccess] = useState(false);
  const [sentTo, setSentTo] = useState({ name: '', email: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { from: 'agent', text: `Hi, I'm the ${BRAND_NAME} assistant. Ask me about accounts, deposits, KYC or trading and I'll point you the right way.`, time: 'now' },
  ]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isChatOpen]);

  // Success modal: lock background scroll and close on Escape (same treatment
  // the global PopupContext gives its overlay).
  useEffect(() => {
    if (!showSuccess) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowSuccess(false); };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [showSuccess]);

  /** Scripted answers for the most common trader questions. Anything the
   *  script cannot answer is routed to a ticket or the form. */
  const getAutoReply = (text: string) => {
    const t = text.toLowerCase();
    if (t.includes('demo')) return 'Go to Sign in and press "Try with demo" — you get a $10,000 demo account instantly, no email needed.';
    if (t.includes('open') || t.includes('register') || t.includes('sign up') || t.includes('account')) return 'Open a live account at /auth/register. Once you are signed in you can add more accounts from Open account and move funds between them.';
    if (t.includes('deposit') || t.includes('fund') || t.includes('payment') || t.includes('usdt')) return 'Deposits are made from Wallet: USDT on TRC20, BEP20 or ERC20, or bank transfer / UPI via a payment link. Demo accounts cannot deposit.';
    if (t.includes('withdraw')) return 'Withdrawals go to USDT or bank/UPI from Wallet. Complete KYC first — withdrawals need a verified account. Crypto is typically same-day; bank withdrawals are reviewed by our team.';
    if (t.includes('kyc') || t.includes('verify') || t.includes('verification')) return 'KYC takes a government ID, a selfie and proof of address. Upload them at /kyc after sign-in; you need it before your first withdrawal.';
    if (t.includes('leverage') || t.includes('margin')) return 'Leverage is flexible up to 1:500 (default 1:100) and set per account group. Lot sizes start from 0.01. The margin calculator at /risk-calculator shows what a position needs.';
    if (t.includes('copy') || t.includes('pamm')) return 'Copy trading (/social) and PAMM (/pamm) both need a live account. Pick a master or manager, choose an allocation, and you can stop at any time.';
    if (t.includes('partner') || t.includes('ib') || t.includes('affiliate') || t.includes('referral')) return 'Apply to the IB programme from /business after sign-in. You get a referral link and code, and commission is calculated per lot when a referred trade fills.';
    if (t.includes('api') || t.includes('bot') || t.includes('algo')) return 'The Algo Connector (/algo-connector) gives you a per-account API key with REST endpoints for BUY/SELL/CLOSE and a WebSocket tick stream. The AI strategy builder is at /ai-strategies.';
    if (t.includes('hi') || t.includes('hello') || t.includes('hey')) return 'Hello. What can I help you with — your account, deposits, KYC, trading or the partner programme?';
    if (t.includes('thank')) return 'You\'re welcome. If you need anything else, open a ticket from /support and a person will pick it up.';
    return `Thanks — I can answer common questions about accounts, deposits, KYC and trading. For anything specific to your account, open a ticket at /support after signing in or email ${BRAND_SUPPORT_EMAIL}.`;
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const userMsg: ChatMessage = { from: 'user', text: chatInput, time: 'now' };
    setMessages((prev) => [...prev, userMsg]);
    const replyText = getAutoReply(chatInput);
    setChatInput('');
    setTimeout(() => {
      setMessages((prev) => [...prev, { from: 'agent', text: replyText, time: 'now' }]);
    }, 800);
  };

  /** POSTs to the gateway, which emails the submission to the support inbox
   *  (CONTACT_INBOX_EMAIL). The success modal only opens once the backend
   *  confirms delivery, so a failed message never looks sent. */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setSubmitError('');

    // Capture the name before the reset below clears it — the modal greets by name.
    const sender = { name: formData.name.trim(), email: formData.email.trim() };

    try {
      const res = await fetch('/api/v1/public/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify({
          name: sender.name,
          email: sender.email,
          subject: formData.subject,
          message: formData.message.trim(),
        }),
      });
      if (!res.ok) {
        const data: { detail?: unknown } = await res.json().catch(() => ({}));
        throw new Error(
          typeof data?.detail === 'string'
            ? data.detail
            : `We couldn't send your message. Please email ${BRAND_SUPPORT_EMAIL} directly.`
        );
      }
      setSentTo(sender);
      setShowSuccess(true);
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (err) {
      setSubmitError(
        (err as Error)?.message || `We couldn't send your message. Please email ${BRAND_SUPPORT_EMAIL} directly.`
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <main>
      <PageHero
        kicker="Contact"
        title="Get in touch"
        lead="Questions about your account, a deposit, KYC or a trade? Email us, open a support ticket from your dashboard, or use the form below."
      />

      <Section raised>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Email */}
          <article className="mk-card mk-card--hover text-center flex flex-col items-center gap-3">
            <span
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl shrink-0"
              style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
            >
              <Mail className="h-5 w-5" />
            </span>
            <h3 className="mk-h3">Email us</h3>
            <a href={`mailto:${BRAND_SUPPORT_EMAIL}`} className="mk-body break-words">
              {BRAND_SUPPORT_EMAIL}
            </a>
          </article>

          {/* In-app tickets */}
          <article className="mk-card mk-card--hover text-center flex flex-col items-center gap-3">
            <span
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl shrink-0"
              style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
            >
              <Ticket className="h-5 w-5" />
            </span>
            <h3 className="mk-h3">Support tickets</h3>
            <p className="mk-body">
              Signed in? Open a ticket from your dashboard — it is tied to your account, so we can
              look straight at the deposit, trade or document you are asking about.
            </p>
            <Link href="/support" className="mk-link" style={{ fontSize: 'var(--mk-text-sm)' }}>
              Open a ticket →
            </Link>
          </article>

          {/* Live chat */}
          <article className="mk-card mk-card--hover text-center flex flex-col items-center gap-3">
            <span
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl shrink-0"
              style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
            >
              <MessageCircle className="h-5 w-5" />
            </span>
            <h3 className="mk-h3">Live chat</h3>
            <p className="mk-body">
              Instant answers to the common questions — demo accounts, funding, KYC, leverage — right
              here on this page.
            </p>
            <button
              type="button"
              className="mk-link"
              style={{ fontSize: 'var(--mk-text-sm)' }}
              onClick={() => setIsChatOpen(true)}
            >
              Start chat →
            </button>
          </article>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mt-12">
          <div>
            <h2 className="mk-h2 mb-6">Send us a message</h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div>
                <label htmlFor="contact-name" style={LABEL_STYLE}>Name</label>
                <input
                  id="contact-name"
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  style={FIELD_STYLE}
                  placeholder="Your name"
                />
              </div>
              <div>
                <label htmlFor="contact-email" style={LABEL_STYLE}>Email</label>
                <input
                  id="contact-email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  style={FIELD_STYLE}
                  placeholder="your@email.com"
                />
              </div>
              <div>
                <label htmlFor="contact-subject" style={LABEL_STYLE}>Subject</label>
                <select
                  id="contact-subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  style={FIELD_STYLE}
                >
                  <option value="">Select a subject</option>
                  <option value="account">My account</option>
                  <option value="funding">Deposits &amp; withdrawals</option>
                  <option value="kyc">KYC / verification</option>
                  <option value="trading">Trading &amp; platform</option>
                  <option value="partnership">Partnership / IB programme</option>
                  <option value="general">Something else</option>
                </select>
              </div>
              <div>
                <label htmlFor="contact-message" style={LABEL_STYLE}>Message</label>
                <textarea
                  id="contact-message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows={6}
                  style={{ ...FIELD_STYLE, resize: 'none' }}
                  placeholder="Tell us what you need. If it is about a specific deposit or trade, include the date and amount."
                />
              </div>
              {submitError && (
                <p
                  role="alert"
                  style={{
                    fontSize: 'var(--mk-text-sm)',
                    color: 'var(--mk-down)',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: 'var(--mk-radius-sm)',
                    padding: '0.75rem 1rem',
                  }}
                >
                  {submitError}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting}
                className="mk-btn mk-btn--primary w-full disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Send className="h-4 w-4" />
                {submitting ? 'Sending…' : 'Send message'}
              </button>
            </form>
          </div>

          <div>
            <h2 className="mk-h2 mb-6">Before you write</h2>
            <article className="mk-card flex flex-col gap-4">
              <h3 className="mk-h3">Fastest answers</h3>
              <ul className="flex flex-col gap-2.5">
                {[
                  { label: 'Want to try the platform first?', body: 'Sign in and press "Try with demo" for an instant $10,000 demo — no email needed.', href: '/auth/login', cta: 'Try a free demo' },
                  { label: 'Deposit or withdrawal question?', body: 'Funding methods, limits and timing are on the deposits page.', href: '/deposit-withdrawal', cta: 'Deposits & withdrawals' },
                  { label: 'General question?', body: 'Check the FAQ — accounts, KYC, funding, trading, copy trading and partners.', href: '/faq', cta: 'Read the FAQ' },
                ].map((item) => (
                  <li key={item.label} className="flex flex-col gap-1" style={{ paddingBottom: 'var(--mk-space-3)', borderBottom: '1px solid var(--mk-line)' }}>
                    <span className="font-bold" style={{ fontSize: 'var(--mk-text-sm)', color: 'var(--mk-text)' }}>{item.label}</span>
                    <span className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>{item.body}</span>
                    <Link href={item.href} className="mk-link" style={{ fontSize: 'var(--mk-text-sm)' }}>{item.cta} →</Link>
                  </li>
                ))}
              </ul>
              <div className="flex items-start gap-2 mk-meta">
                <Clock size={15} className="mt-0.5 shrink-0" />
                <span>
                  Account-specific requests (a pending withdrawal, a KYC document, a disputed fill)
                  are handled fastest through an in-app ticket, because it is already linked to your account.
                </span>
              </div>
            </article>
          </div>
        </div>
      </Section>

      <Section>
        <SectionHeading
          kicker="Support"
          title="Need help right now?"
          lead="Start a chat for instant answers to common questions, or email us and a member of the team will reply."
        />

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <button type="button" className="mk-btn mk-btn--primary" onClick={() => setIsChatOpen(true)}>
            <MessageCircle className="h-4 w-4" />
            Start live chat
          </button>
          <a href={`mailto:${BRAND_SUPPORT_EMAIL}`} className="mk-btn mk-btn--ghost">
            <Mail className="h-4 w-4" />
            Email us
          </a>
          <Link href="/support" className="mk-btn mk-btn--ghost">
            <Ticket className="h-4 w-4" />
            Open a ticket
          </Link>
        </div>

        <p className="mk-meta mx-auto text-center" style={{ marginTop: 'var(--mk-space-8)', maxWidth: '72ch' }}>
          {RISK_LINE}
        </p>
      </Section>

      {showSuccess && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowSuccess(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="contact-success-title"
        >
          <div
            className="relative w-full max-w-md text-center overflow-hidden mk-card"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowSuccess(false)}
              className="absolute top-4 right-4 z-10"
              style={{ color: 'var(--mk-text-faint)' }}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="relative z-10 flex flex-col items-center gap-3">
              <span
                className="inline-flex h-16 w-16 items-center justify-center rounded-full"
                style={{ background: 'var(--mk-accent-soft)', color: 'var(--mk-accent)' }}
              >
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                </svg>
              </span>

              <h2 id="contact-success-title" className="mk-h3">
                {sentTo.name ? `Thanks, ${sentTo.name}!` : 'Message sent'}
              </h2>

              <p className="mk-body">Your message is on its way to our team.</p>
              {sentTo.email && (
                <p className="mk-body" style={{ fontSize: 'var(--mk-text-sm)' }}>
                  We&apos;ll reply to{' '}
                  <span className="font-bold break-all" style={{ color: 'var(--mk-text)' }}>{sentTo.email}</span>
                </p>
              )}

              <div className="flex flex-col sm:flex-row gap-3 w-full mt-2">
                <button type="button" onClick={() => setShowSuccess(false)} className="mk-btn mk-btn--primary flex-1">
                  Done
                </button>
                <button
                  type="button"
                  onClick={() => { setShowSuccess(false); setIsChatOpen(true); }}
                  className="mk-btn mk-btn--ghost flex-1"
                >
                  <MessageCircle className="h-4 w-4" />
                  Live chat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isChatOpen && (
        <div className="fixed bottom-6 right-6 z-[100] w-[calc(100vw-3rem)] sm:w-96">
          <div
            className="overflow-hidden flex flex-col h-[500px]"
            style={{
              background: 'var(--mk-surface)',
              border: '1px solid var(--mk-line)',
              borderRadius: 'var(--mk-radius-lg)',
              boxShadow: 'var(--mk-shadow-lift)',
            }}
          >
            <div
              className="p-4 flex items-center justify-between"
              style={{ background: 'var(--mk-accent)' }}
            >
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div
                    className="h-10 w-10 rounded-full flex items-center justify-center font-bold"
                    style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}
                  >
                    {BRAND_NAME.charAt(0)}
                  </div>
                  <div
                    className="absolute bottom-0 right-0 h-3 w-3 rounded-full"
                    style={{ background: 'var(--mk-up)', border: '2px solid #fff' }}
                  />
                </div>
                <div>
                  <div className="font-bold" style={{ color: '#fff' }}>{BRAND_NAME} assistant</div>
                  <div style={{ fontSize: 'var(--mk-text-xs)', color: 'rgba(255,255,255,0.8)' }}>
                    Instant answers to common questions
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsChatOpen(false)}
                style={{ color: 'rgba(255,255,255,0.85)' }}
                aria-label="Close chat"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3" style={{ background: 'var(--mk-bg)' }}>
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="max-w-[80%] px-4 py-2"
                    style={{
                      fontSize: 'var(--mk-text-sm)',
                      borderRadius: 'var(--mk-radius)',
                      background: msg.from === 'user' ? 'var(--mk-accent)' : 'var(--mk-surface-2)',
                      color: msg.from === 'user' ? '#fff' : 'var(--mk-text)',
                    }}
                  >
                    {msg.text}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <form
              onSubmit={handleSendChat}
              className="p-3 flex items-center gap-2"
              style={{ borderTop: '1px solid var(--mk-line)', background: 'var(--mk-bg-raised)' }}
            >
              <input
                id="contact-chat-input"
                name="chat"
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type your question…"
                className="flex-1 min-w-0 px-4 py-2 outline-none"
                style={{
                  background: 'var(--mk-surface-2)',
                  border: '1px solid var(--mk-line)',
                  borderRadius: 'var(--mk-radius-pill)',
                  color: 'var(--mk-text)',
                  fontSize: 'var(--mk-text-sm)',
                }}
              />
              <button
                type="submit"
                className="h-10 w-10 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'var(--mk-accent)', color: '#fff' }}
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
