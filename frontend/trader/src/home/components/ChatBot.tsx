'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle, X, Send, Bot, User, Minimize2, ArrowRight,
} from 'lucide-react';
import Link from 'next/link';
import { BRAND_NAME, BRAND_SUPPORT_EMAIL } from '@/lib/brand';

type Sender = 'bot' | 'user';
interface Msg {
  id: string;
  sender: Sender;
  text: string;
  cta?: { label: string; href: string }[];
  ts: number;
}

/**
 * Rule-based response engine — matches user input against keyword groups
 * and returns the most relevant canned answer. No external API needed.
 * Order matters — the first matching rule wins. Each rule may include
 * follow-up CTAs that render as quick-link buttons under the message.
 */
const RULES: { keys: string[]; reply: string; cta?: { label: string; href: string }[] }[] = [
  {
    keys: ['hi', 'hello', 'hey', 'namaste', 'hola', 'good morning', 'good afternoon', 'good evening'],
    reply:
      `Hi! I'm the ${BRAND_NAME} assistant. I can help with opening an account, the free demo, deposits and withdrawals, leverage, copy trading and the IB programme. What would you like to know?`,
  },
  {
    keys: ['bonus', 'welcome bonus', '100%', 'promo', 'promo code', 'first deposit bonus'],
    reply:
      'We do not run a deposit bonus or promo-code offer. What you deposit is what you trade with — no bonus terms and no turnover requirement attached to your withdrawals.',
    cta: [
      { label: 'Compare accounts', href: '/account-types' },
      { label: 'Open account',     href: '/auth/register' },
    ],
  },
  {
    keys: ['demo', 'practice', 'try', 'test account'],
    reply:
      'The sign-in page has a one-click "Try with demo" button that creates a $10,000 demo account instantly — no email needed. It uses the same terminal and live prices as a real account. Demo accounts cannot deposit or withdraw.',
    cta: [{ label: 'Try a free demo', href: '/auth/login' }],
  },
  {
    keys: ['minimum deposit', 'min deposit', 'minimum', 'start with', 'how much to start', 'deposit kitna'],
    reply:
      'There is a low minimum deposit on live accounts; the exact figure is shown on the account types page. You can also start on the free $10,000 demo with no deposit at all.',
    cta: [
      { label: 'Compare accounts', href: '/account-types' },
      { label: 'Open account',     href: '/auth/register' },
    ],
  },
  {
    keys: ['account type', 'accounts', 'standard account', 'pro account', 'open account', 'register', 'sign up'],
    reply:
      'Register with an email and password or with Google, then open a live account in the app. Account types are Standard (commission-free, competitive spreads) and Pro (tighter spreads, priority support). You can hold several accounts under one login and transfer funds between them and your wallet.',
    cta: [
      { label: 'View account types', href: '/account-types' },
      { label: 'Open account',       href: '/auth/register' },
    ],
  },
  {
    keys: ['ib', 'referral', 'partner', 'introducing broker', 'affiliate', 'commission', 'refer'],
    reply:
      'Apply in the app and you get a personal referral link and code. Commission is calculated per lot when a referred trade fills and released when it closes. The network is multi-level, so you also earn on traders your sub-partners bring in. Payouts are reviewed and approved by our team.',
    cta: [
      { label: 'IB programme',   href: '/platforms/ib-management' },
      { label: 'Refer a friend', href: '/products/referral' },
    ],
  },
  {
    keys: ['copy', 'copy trading', 'social', 'master trader', 'follow'],
    reply:
      'Copy trading lets you follow a master trader from the leaderboard (sorted by return, followers or Sharpe ratio) with an allocation you choose. Their trades are mirrored to your live account automatically, masters may charge a performance fee, and you can stop any time.',
    cta: [{ label: 'Copy trading', href: '/platforms/copy-trading' }],
  },
  {
    keys: ['portfolio', 'pamm', 'managed account', 'manager'],
    reply:
      'PAMM lets you invest with approved managers who run pooled managed accounts, sorted by ROI. Managers apply in-app and are reviewed, and they earn a performance fee on profits.',
    cta: [{ label: 'View PAMM', href: '/services/portfolio-management' }],
  },
  {
    keys: ['deposit', 'fund', 'usdt', 'upi', 'bank transfer'],
    reply:
      'Deposit from your wallet by crypto (USDT on TRC20, BEP20 or ERC20) or by local banking (bank transfer or UPI via a payment link). Demo accounts cannot deposit.',
    cta: [{ label: 'Deposits & withdrawals', href: '/deposit-withdrawal' }],
  },
  {
    keys: ['withdraw', 'withdrawal', 'cash out', 'payout', 'paise nikalna'],
    reply:
      'Withdraw to USDT or to your bank or UPI. Crypto withdrawals are typically processed the same day; bank withdrawals are reviewed by our team. Identity verification (KYC) is required before your first withdrawal.',
    cta: [{ label: 'Deposits & withdrawals', href: '/deposit-withdrawal' }],
  },
  {
    keys: ['leverage', 'margin', 'lot size', 'position size'],
    reply:
      'Leverage is flexible up to 1:500 and is set per account group; the default is 1:100. Lot sizes start from 0.01. Balance, equity, margin, free margin and margin level are always visible in the terminal. Leverage magnifies both gains and losses.',
    cta: [{ label: 'Risk calculator', href: '/risk-calculator' }],
  },
  {
    keys: ['platform', 'terminal', 'app', 'mobile', 'web platform', 'android', 'ios', 'desktop', 'download'],
    reply:
      `The ${BRAND_NAME} web terminal runs in your browser on desktop and phone: TradingView charts, market, limit, stop and stop-limit orders, SL/TP on every trade, and a live account panel. A native desktop terminal and an Android app are coming soon.`,
    cta: [
      { label: 'Web terminal', href: '/platforms/web' },
      { label: 'Download',     href: '/download' },
    ],
  },
  {
    keys: ['market', 'instruments', 'forex', 'crypto', 'indices', 'commodities', 'gold', 'oil', 'pairs'],
    reply:
      'You can trade 40+ instruments across five classes: forex (EUR/USD, GBP/USD, USD/JPY and more), metals (gold, silver, platinum, palladium), indices (US30, NAS100, GER40, UK100), energy (US and UK oil) and crypto (BTC, ETH, LTC, SOL, XRP). Crypto trades 24/7; the rest follow market hours.',
    cta: [{ label: 'Browse markets', href: '/markets' }],
  },
  {
    keys: ['spread', 'fees', 'charges', 'trading conditions'],
    reply:
      'Standard accounts are commission-free with competitive spreads; Pro accounts have tighter spreads and priority support. Live bid, ask and spread are shown in the terminal watchlist before you trade.',
    cta: [{ label: 'Account types', href: '/account-types' }],
  },
  {
    keys: ['ai', 'algo', 'strategy', 'bot', 'api', 'automated'],
    reply:
      'The AI Strategy Builder turns a plain-language description into a rules-based strategy you can backtest and deploy on your account. The Algo Connector gives each account an API key and secret with REST endpoints and a WebSocket tick stream, so you can connect your own bot.',
    cta: [{ label: 'AI & algo trading', href: '/platforms/super-admin' }],
  },
  {
    keys: ['support', 'help', 'human', 'agent', 'contact', 'live chat', 'speak to someone', 'whatsapp', 'phone', 'call'],
    reply:
      `For anything I can't help with, our support team is reachable by ticket inside the app or by email at ${BRAND_SUPPORT_EMAIL}.`,
    cta: [
      { label: 'Email us',     href: `mailto:${BRAND_SUPPORT_EMAIL}` },
      { label: 'Contact page', href: '/company/contact' },
    ],
  },
  {
    keys: ['kyc', 'verification', 'verify', 'document'],
    reply:
      'KYC needs a government-issued ID and a selfie, plus proof of address. Verification is required before you can withdraw.',
    cta: [{ label: 'How it works', href: '/how-it-works' }],
  },
  {
    keys: ['regulated', 'license', 'regulation', 'safe', 'secure', 'security', '2fa', 'two-factor'],
    reply:
      'Your login is protected by a password plus optional two-factor authentication (TOTP), Google sign-in, session protection and encrypted connections. Funds and trading data run on segregated infrastructure, and withdrawals require identity verification.',
    cta: [{ label: 'Why PowerTradeFX', href: '/company/why-powertradefx' }],
  },
  {
    keys: ['insurance', 'insured', 'prop', 'ico', 'token sale'],
    reply:
      'Trade insurance, prop trading and the ICO launchpad are not live yet — they are coming soon. Contact us if you would like to be told when they launch.',
    cta: [{ label: 'Contact us', href: '/company/contact' }],
  },
  {
    keys: ['thanks', 'thank you', 'shukriya', 'dhanyavaad', 'ty'],
    reply: "You're welcome! Anything else I can help with? If you want to talk to a human, just say `support`.",
  },
  {
    keys: ['bye', 'goodbye', 'see you', 'cya'],
    reply: 'Bye! Come back whenever you have more questions.',
  },
];

const QUICK_REPLIES = [
  'Open account',
  'Free demo',
  'Deposits',
  'Leverage',
  'Copy trading',
  'Support',
];

const INITIAL: Msg[] = [
  {
    id: 'm0',
    sender: 'bot',
    text:
      `Hi! I'm the ${BRAND_NAME} assistant. Ask me about opening an account, the free demo, deposits, leverage, copy trading or the IB programme — or pick a topic below.`,
    ts: Date.now(),
  },
];

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function matchRule(input: string): { reply: string; cta?: { label: string; href: string }[] } {
  const t = input.toLowerCase().trim();
  for (const rule of RULES) {
    if (rule.keys.some((k) => t.includes(k))) {
      return { reply: rule.reply, cta: rule.cta };
    }
  }
  // Default fallback
  return {
    reply:
      "I didn't quite catch that — try asking about opening an account, the demo, deposits, leverage, copy trading or the IB programme. Or pick a topic below.",
  };
}

export function ChatBot() {
  const [open, setOpen] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const [messages, setMessages] = useState<Msg[]>(INITIAL);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [unread, setUnread] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to newest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typing]);

  // Clear unread badge when opened
  useEffect(() => {
    if (open) setUnread(0);
  }, [open]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const userMsg: Msg = { id: uid(), sender: 'user', text: trimmed, ts: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setTyping(true);

    // Simulated typing delay 600–1100ms for a natural feel
    const delay = 600 + Math.random() * 500;
    window.setTimeout(() => {
      const { reply, cta } = matchRule(trimmed);
      const botMsg: Msg = { id: uid(), sender: 'bot', text: reply, cta, ts: Date.now() };
      setMessages((prev) => [...prev, botMsg]);
      setTyping(false);
      if (!open) setUnread((u) => u + 1);
    }, delay);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    send(input);
  };

  return (
    <>
      {/* Floating action button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            type="button"
            aria-label="Open chat"
            onClick={() => { setOpen(true); setMinimised(false); }}
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-20 right-5 sm:bottom-24 sm:right-6 z-[80] size-14 rounded-full flex items-center justify-center shadow-2xl"
            style={{
              background: 'var(--mk-accent)',
              boxShadow: '0 8px 28px rgba(232, 93, 61,0.45), 0 0 0 4px rgba(232, 93, 61,0.15)',
            }}
          >
            <MessageCircle className="size-6 text-white" />
            {unread > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 rounded-full text-[10px] font-bold flex items-center justify-center"
                style={{ background: 'hsl(0 100% 50%)', color: 'white' }}
              >
                {unread}
              </span>
            )}
            {/* Pulsing ring */}
            <span
              aria-hidden
              className="absolute inset-0 rounded-full animate-ping"
              style={{ background: 'rgba(227, 34, 25, 0.35)' }}
            />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.95 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-20 right-5 sm:bottom-24 sm:right-6 z-[80] w-[min(380px,calc(100vw-2.5rem))] flex flex-col rounded-3xl overflow-hidden"
            style={{
              height: minimised ? 'auto' : 'min(580px, calc(100vh - 11rem))',
              background: '#ffffff',
              border: '1px solid var(--mk-line)',
              boxShadow: '0 24px 60px rgba(11, 11, 12, 0.20)',
            }}
            role="dialog"
            aria-label={`${BRAND_NAME} assistant chat`}
          >
            {/* Header */}
            <div
              className="flex items-center gap-3 px-4 py-3 border-b border-foreground/10"
              style={{ background: 'var(--mk-bg-raised)' }}
            >
              <div className="size-9 rounded-full flex items-center justify-center" style={{ background: 'var(--mk-accent-soft)' }}>
                <Bot className="size-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display uppercase text-sm tracking-tight" style={{ color: 'var(--mk-text)' }}>{BRAND_NAME} Assistant</div>
                <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--mk-text-muted)' }}>
                  <span className="relative inline-flex">
                    <span className="absolute inset-0 rounded-full bg-primary opacity-60 animate-ping" />
                    <span className="relative size-1.5 rounded-full bg-primary" />
                  </span>
                  Online · usually replies instantly
                </div>
              </div>
              <button
                type="button"
                aria-label="Minimise chat"
                onClick={() => setMinimised((m) => !m)}
                className="size-8 rounded-full flex items-center justify-center text-foreground/55 hover:text-foreground hover:bg-foreground/10"
              >
                <Minimize2 className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Close chat"
                onClick={() => setOpen(false)}
                className="size-8 rounded-full flex items-center justify-center text-foreground/55 hover:text-foreground hover:bg-foreground/10"
              >
                <X className="size-4" />
              </button>
            </div>

            {!minimised && (
              <>
                {/* Messages */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ background: 'hsl(0 0% 5%)' }}>
                  {messages.map((m) => <MessageBubble key={m.id} m={m} />)}
                  {typing && <TypingIndicator />}
                </div>

                {/* Quick replies */}
                {messages.length <= 2 && (
                  <div className="px-4 pb-2 flex flex-wrap gap-2" style={{ background: 'hsl(0 0% 5%)' }}>
                    {QUICK_REPLIES.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => send(q)}
                        className="text-xs font-semibold px-3.5 py-2 rounded-full transition"
                        style={{
                          color: '#ffffff',
                          background: 'var(--mk-accent-soft)',
                          border: '1px solid var(--mk-accent-line)',
                        }}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}

                {/* Input */}
                <form
                  onSubmit={onSubmit}
                  className="flex items-center gap-2 px-3 py-3 border-t border-foreground/10"
                  style={{ background: '#ffffff' }}
                >
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about accounts, deposits, leverage…"
                    aria-label="Message"
                    className="flex-1 bg-transparent rounded-full px-4 py-2.5 text-sm outline-none border focus:border-primary/60"
                    style={{
                      color: '#ffffff',
                      borderColor: 'var(--mk-line)',
                    }}
                  />
                  <button
                    type="submit"
                    aria-label="Send message"
                    disabled={!input.trim()}
                    className="size-10 rounded-full flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background:
                        'var(--mk-accent)',
                    }}
                  >
                    <Send className="size-4 text-white" />
                  </button>
                </form>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function MessageBubble({ m }: { m: Msg }) {
  const isUser = m.sender === 'user';
  return (
    <div className={`flex items-end gap-2 ${isUser ? 'flex-row-reverse' : ''}`}>
      <div
        className={`size-7 rounded-full flex items-center justify-center shrink-0 ${isUser ? '' : ''}`}
        style={{ background: isUser ? 'var(--mk-accent-soft)' : 'var(--mk-surface)' }}
      >
        {isUser ? <User className="size-3.5 text-primary" /> : <Bot className="size-3.5 text-primary" />}
      </div>
      <div className={`flex flex-col gap-1.5 max-w-[78%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div
          className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
            isUser ? 'rounded-br-md' : 'rounded-bl-md'
          }`}
          style={{
            background: isUser ? 'var(--mk-accent-soft)' : 'var(--mk-surface)',
            color: 'var(--mk-text)',
            border: isUser ? '1px solid var(--mk-accent-line)' : '1px solid var(--mk-line)',
          }}
        >
          {m.text}
        </div>
        {m.cta && m.cta.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {m.cta.map((c) =>
              c.href.startsWith('http') || c.href.startsWith('mailto') ? (
                <a
                  key={c.label}
                  href={c.href}
                  className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full bg-primary text-white font-semibold hover:opacity-90 transition"
                >
                  {c.label} <ArrowRight className="size-3" />
                </a>
              ) : (
                <Link
                  key={c.label}
                  href={c.href}
                  className="inline-flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-full bg-primary text-white font-semibold hover:opacity-90 transition"
                >
                  {c.label} <ArrowRight className="size-3" />
                </Link>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="size-7 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--mk-surface)' }}>
        <Bot className="size-3.5 text-primary" />
      </div>
      <div
        className="px-3.5 py-3 rounded-2xl rounded-bl-md inline-flex gap-1.5"
        style={{ background: 'hsl(0 0% 13%)', border: '1px solid hsl(0 0% 18%)' }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 rounded-full bg-primary"
            style={{
              animation: 'brand-bot-bounce 1.2s infinite ease-in-out',
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </div>
      <style jsx>{`
        @keyframes brand-bot-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40%           { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
