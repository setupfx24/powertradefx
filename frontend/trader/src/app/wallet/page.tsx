'use client';

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  Suspense,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import DashboardShell from '@/components/layout/DashboardShell';
import DemoLockGate from '@/components/demo/DemoLockGate';
import { formatCurrency } from '@/lib/formatters';
import { useAuthStore } from '@/stores/authStore';
import api, { getApiBase } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Skeleton,
  StatCard,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Tabs,
} from '@/components/ui';
// Automated deposits go through Razorpay Checkout (cards / UPI / netbanking).
// The user enters a USD amount; the backend converts USD→INR at the live
// mid-market rate, creates a Razorpay order, and we open the Razorpay
// Checkout popup (checkout.js). On success the handler posts the signature
// to /wallet/deposit/razorpay/verify which credits the USD amount.
import {
  Wallet as WalletIcon,
  CreditCard,
  ArrowUpFromLine,
  ArrowDownToLine,
  ArrowLeftRight,
  History as HistoryIcon,
  RefreshCcw,
  CheckCircle2,
  Hourglass,
  FileText,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { downloadWalletStatementPdf } from '@/lib/pdf/walletStatementPdf';

/**
 * Razorpay's Checkout iframe cannot read our CSS variables, so resolve the
 * accent token (`--accent-rgb`, an "r g b" triplet) to a hex string at call
 * time. Returns an empty object when the token is unavailable (SSR or an
 * unparsable value) so the popup falls back to Razorpay's default theme —
 * we never carry a colour literal in this file.
 */
function checkoutTheme(): { theme?: { color: string } } {
  if (typeof window === 'undefined') return {};
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim();
  const parts = raw.split(/[\s,]+/).map((p) => Number(p));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return {};
  const hex = parts.map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')).join('');
  return { theme: { color: `#${hex}` } };
}

// Razorpay popup integration removed — local-banking flow replaces it.
// Admin can still attach Razorpay payment-links per request from the
// admin panel; those open in a new tab when the user clicks them, no
// in-app SDK / checkout.js needed.

interface AccountItem {
  id: string;
  account_number?: string;
  currency?: string;
  is_demo?: boolean;
  is_active?: boolean;
  is_wallet_account?: boolean;
  balance?: number;
  account_group?: {
    id?: string;
    name?: string;
    minimum_deposit?: number;
  } | null;
}

interface LiveAccountRow {
  id: string;
  account_number: string;
  balance: number;
  credit?: number;
  margin_used?: number;
  currency?: string;
  free_margin?: number;
  is_wallet_account?: boolean;
  account_group?: {
    id?: string;
    name?: string;
    minimum_deposit?: number;
  } | null;
}

interface WalletData {
  balance: number;
  currency: string;
  main_wallet_balance: number;
  bonus_balance: number;
  total_deposited: number;
  total_withdrawn: number;
  pending_withdrawals: number;
  total_live_balance?: number;
  /** When the user has migrated to the wallet-bound model, the
   *  primary spendable balance lives on this trading account instead
   *  of main_wallet_balance. */
  wallet_account?: {
    id: string;
    account_number: string;
    balance: number;
  } | null;
}

interface WalletSummaryResponse {
  balance?: number;
  credit?: number;
  equity?: number;
  main_wallet_balance?: number;
  total_deposited?: number;
  total_withdrawn?: number;
  total_live_balance?: number;
  live_accounts?: LiveAccountRow[];
}

interface WalletListItem {
  id: string;
  created_at: string | null;
  type: string;
  method: string;
  amount: number;
  status: string;
  currency: string;
  // Populated by the backend for `local_banking` deposits once the admin
  // attaches a payment URL. Null while the request is still waiting for
  // admin review. When admin used the Razorpay-auto path this looks like
  // "razorpay:<order_id>" and the UI opens a Razorpay popup instead of an
  // external URL.
  payment_link?: string | null;
  // transaction_id holds the Razorpay order_id for auto-approved LB
  // deposits — the trader needs it to launch the Razorpay Checkout popup.
  transaction_id?: string | null;
}

/** Raw DB method code → friendly label. Covers both manual (bank / UPI /
 *  QR) and crypto (BTC / ETH / USDT / NOWPayments / OxaPay / wallet)
 *  channels so the history row reads clearly. */
function prettyMethod(method?: string): string {
  const m = (method || '').toLowerCase();
  switch (m) {
    case 'bank_transfer':
    case 'bank':
    case 'card':
      return 'Bank Transfer';
    case 'upi':
      return 'UPI';
    case 'qr':
      return 'QR Code';
    case 'manual':
      return 'Manual';
    case 'crypto_btc':
      return 'Crypto (BTC)';
    case 'crypto_eth':
      return 'Crypto (ETH)';
    case 'crypto_usdt':
      return 'Crypto (USDT)';
    case 'metamask':
      return 'Crypto (Wallet)';
    case 'razorpay':
      return 'Card / UPI';
    case 'nowpayments':
    case 'oxapay':
    case 'crypto':
      return 'Crypto';
    default:
      return m ? m.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '—';
  }
}

function fmtHistoryDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const DEMO_FUNDING_MSG =
  'Demo accounts cannot deposit, withdraw, or transfer funds. Open a live account to use wallet funding.';

// Networks the on-chain USDT payout supports (admin signs the transfer
// manually). Must mirror `ALLOWED_NETWORKS` in onchain_withdraw_service.py.
const WITHDRAW_NETWORK_OPTIONS = [
  {
    network: 'tron' as const,
    label: 'USDT TRC20',
    sub: 'Tron network',
    addressHint: 'Address starts with T (e.g. TXYZ…)',
    addressRegex: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
  },
  {
    network: 'bsc' as const,
    label: 'USDT BEP20',
    sub: 'BNB Smart Chain',
    addressHint: 'EVM address — 0x followed by 40 hex characters',
    addressRegex: /^0x[a-fA-F0-9]{40}$/,
  },
  {
    network: 'eth' as const,
    label: 'USDT ERC20',
    sub: 'Ethereum',
    addressHint: 'EVM address — 0x followed by 40 hex characters',
    addressRegex: /^0x[a-fA-F0-9]{40}$/,
  },
];

// 'crypto' = automated provider flow (Razorpay Checkout for deposits;
// on-chain USDT payout details for withdrawals). 'manual' = legacy bank/UPI
// manual path. (The deposit chip is labelled "Card / UPI" since Razorpay
// covers cards, UPI and netbanking.)
type FundingChannel = 'crypto' | 'manual';

interface ManualBankDetailsResponse {
  bank_name?: string;
  account_holder?: string;
  account_number?: string;
  ifsc_code?: string;
  upi_id?: string;
  qr_code_url?: string;
  /** Optional crypto wallet address admin attached on the same Banks row.
   *  Trader renders it as a copyable address + auto-generated QR. */
  wallet_address?: string;
}

type FundsTab = 'deposit' | 'withdrawal' | 'transfer' | 'history';

/** Synthetic id used inside the transfer source/destination pickers to
 *  represent the user's main wallet bucket (which is not an account row). */
const MAIN_WALLET_OPTION_ID = '__MAIN_WALLET__';

function WalletPageContent() {
  const isDemo = useAuthStore((s) => s.user?.is_demo);
  // Wallet-integration purged: the SIWE link flow that populated this
  // field is gone, so `user.wallet_address` is always undefined now.
  const linkedWalletAddress = useAuthStore((s) => s.user?.wallet_address || '');
  // Prefill the Razorpay Checkout email field.
  const userEmail = useAuthStore((s) => s.user?.email || '');
  const userFullName = useAuthStore((s) => [s.user?.first_name, s.user?.last_name].filter(Boolean).join(' '));
  // KYC gate (Card / UPI only). Read here so we can both block submit and
  // surface an inline notice in the Card / UPI panel.
  const kycStatus = useAuthStore((s) => (s.user?.kyc_status || '').toLowerCase());
  const kycApproved = kycStatus === 'approved' || kycStatus === 'verified';
  const router = useRouter();
  const searchParams = useSearchParams();
  const accountFromUrl = searchParams.get('account');
  const withdrawDeepLinkHandled = useRef(false);

  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [liveAccounts, setLiveAccounts] = useState<LiveAccountRow[]>([]);
  /** True when user has accounts but none are live (all demo). */
  const [demoFundingBlocked, setDemoFundingBlocked] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadGen = useRef(0);

  /** Top-level Vantage-style tab bar. */
  const [tab, setTab] = useState<FundsTab>('deposit');

  // Internal "fund target" preference — kept for backwards-compat with the
  // submit handlers (they branch on this for wallet-bound users).
  const [fundTargetPreference, setFundTargetPreference] = useState<'main' | 'wallet'>('main');

  // Channel chips ("Crypto" / "Bank/UPI") sit just below the voucher on
  // the Deposit and Withdrawal forms — kept inline (instead of moved into a
  // follow-up modal) so we don't have to surgically rewrite the submit
  // handlers' channel branching.
  // Deposit channels:
  //   - 'crypto'        = admin-set QR / wallet info shown, user pays externally
  //                       and uploads proof (the legacy manual flow's UI).
  //   - 'local_banking' = NEW: user submits a request, admin reviews KYC and
  //                       sends a payment link out of band. No upfront proof,
  //                       no upfront link — admin pushes it later.
  // The Razorpay-checkout popup that previously sat on 'crypto' is gone;
  // admin can still generate per-user Razorpay payment links and attach them
  // through the local-banking flow.
  const [depositUiSection, setDepositUiSection] = useState<'crypto' | 'local_banking'>('crypto');
  const [withdrawUiSection, setWithdrawUiSection] = useState<'crypto' | 'bank'>('crypto');
  const [depositAmount, setDepositAmount] = useState('');
  const [depositAccountId, setDepositAccountId] = useState<string | null>(null);
  const [depositTxId, setDepositTxId] = useState('');
  const [depositProofFile, setDepositProofFile] = useState<File | null>(null);
  const [cryptoGatewayBusy, setCryptoGatewayBusy] = useState(false);
  // Per-deposit amount inputs for the "Razorpay awaiting" row — keyed
  // by deposit id so multiple pending approvals don't overwrite each
  // other while the user is filling them in.
  const [rzpPayAmountByDeposit, setRzpPayAmountByDeposit] = useState<Record<string, string>>({});
  const [rzpCreatingForId, setRzpCreatingForId] = useState<string | null>(null);

  /** Open the OxaPay hosted crypto checkout for the entered amount. The
   *  backend creates a Deposit row + an OxaPay payment and returns the
   *  hosted payment_url; we redirect the user there. OxaPay's webhook
   *  flips the deposit to "approved" on payment confirmation. */
  const openCryptoGatewayCheckout = async () => {
    const amt = parseFloat(depositAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error('Enter a deposit amount first');
      return;
    }
    setCryptoGatewayBusy(true);
    try {
      const res = await api.post<{ payment_url?: string; id?: string }>(
        '/wallet/deposit',
        {
          amount: amt,
          method: 'oxapay',
          account_id: depositAccountId === MAIN_WALLET_OPTION_ID ? undefined : depositAccountId,
        },
      );
      if (res?.payment_url) {
        window.open(res.payment_url, '_blank', 'noopener');
        toast.success('Gateway opened — complete the payment in the new tab');
      } else {
        toast.error('Gateway did not return a payment link');
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not open the gateway');
    } finally {
      setCryptoGatewayBusy(false);
    }
  };
  const [manualBankInfo, setManualBankInfo] = useState<ManualBankDetailsResponse | null>(null);
  const [depositSubmitting, setDepositSubmitting] = useState(false);

  const [withdrawChannel, setWithdrawChannel] = useState<FundingChannel>('crypto');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAccountId, setWithdrawAccountId] = useState<string | null>(null);
  const [withdrawNetwork, setWithdrawNetwork] = useState<'tron' | 'bsc' | 'eth'>('tron');
  const [withdrawCryptoAddress, setWithdrawCryptoAddress] = useState('');
  const [manualWithdrawUpi, setManualWithdrawUpi] = useState('');
  const [manualWithdrawNotes, setManualWithdrawNotes] = useState('');
  const [manualWithdrawQrFile, setManualWithdrawQrFile] = useState<File | null>(null);
  const [withdrawSubmitting, setWithdrawSubmitting] = useState(false);

  // Transfer-between-accounts form (replaces the old card-level "balanceTransfer"
  // modal). Source / destination can be the synthetic main wallet (id =
  // MAIN_WALLET_OPTION_ID) or a real trading-account id.
  const [transferSourceId, setTransferSourceId] = useState<string>('');
  const [transferDestinationId, setTransferDestinationId] = useState<string>('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  // Local-banking pending requests shown inline on the Deposit tab — gives
  // the user a place to find the admin-issued payment link once it's been
  // attached. Refreshed on tab change + after submitting a new request.
  const [localBankingRequests, setLocalBankingRequests] = useState<WalletListItem[]>([]);
  // "I've Paid" inline confirmation: which request's form is open, and the
  // form fields. Kept local so multiple requests can have their own state
  // without an awkward outer modal.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmAmount, setConfirmAmount] = useState('');
  const [confirmTxId, setConfirmTxId] = useState('');
  const [confirmFile, setConfirmFile] = useState<File | null>(null);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);

  // History tab — recent ledger items rendered as a compact table.
  const [historyItems, setHistoryItems] = useState<WalletListItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchData = useCallback(
    async (isRefresh = false) => {
      const id = ++loadGen.current;
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setLoadError(null);

      try {
        const [summaryRes, wdRes, accountsRes] = await Promise.allSettled([
          api.get<WalletSummaryResponse>('/wallet/summary'),
          api.get<{ items?: WalletListItem[] }>('/wallet/withdrawals'),
          api.get<{ items?: AccountItem[] }>('/accounts'),
        ]);

        if (id !== loadGen.current) return;

        let currency = 'USD';
        let balance = 0;
        let mainWalletBalance = 0;
        let bonusBalance = 0;
        let totalDeposited = 0;
        let totalWithdrawn = 0;
        let totalLiveBalance: number | undefined;

        if (summaryRes.status === 'fulfilled' && summaryRes.value) {
          const s = summaryRes.value as WalletSummaryResponse & { bonus_balance?: number };
          const live = s.live_accounts || [];
          setLiveAccounts(live);
          mainWalletBalance = Number(s.main_wallet_balance) || 0;
          bonusBalance = Number(s.bonus_balance) || 0;
          totalDeposited = Number(s.total_deposited) || 0;
          totalWithdrawn = Number(s.total_withdrawn) || 0;
          totalLiveBalance =
            typeof s.total_live_balance === 'number' ? s.total_live_balance : undefined;

          let targetId = selectedAccountId;
          if (!targetId || !live.some((a) => a.id === targetId)) {
            targetId =
              accountFromUrl && live.some((a) => a.id === accountFromUrl)
                ? accountFromUrl
                : live[0]?.id ?? null;
          }
          setSelectedAccountId(targetId);

          const sel = live.find((a) => a.id === targetId);
          balance = sel ? Number(sel.balance) || 0 : Number(s.balance) || 0;
          if (sel?.currency) currency = sel.currency;
        } else if (accountsRes.status === 'fulfilled') {
          const items = accountsRes.value?.items || [];
          const live = items.find((a) => a.is_demo === false) || items[0];
          if (live && typeof live.balance === 'number') balance = live.balance;
          if (summaryRes.status === 'rejected') {
            setLoadError('Wallet summary unavailable — balance from account only.');
            toast.error('Could not load wallet summary (totals may be incomplete).');
          }
        } else {
          const msg =
            summaryRes.status === 'rejected' && summaryRes.reason instanceof Error
              ? summaryRes.reason.message
              : 'Failed to load wallet';
          setLoadError(msg);
          toast.error(msg);
        }

        const wdItems =
          wdRes.status === 'fulfilled' ? wdRes.value?.items || [] : [];

        setDemoFundingBlocked(false);

        if (wdRes.status === 'rejected') {
          toast.error('Could not load pending withdrawal count.');
        }

        const pendingWd = wdItems.filter(
          (w) => (w.status || '').toLowerCase() === 'pending',
        ).length;

        const accountItems =
          accountsRes.status === 'fulfilled' ? accountsRes.value?.items || [] : [];
        const walletAcc = accountItems.find(
          (a) => Boolean(a.is_wallet_account) && a.is_active !== false,
        );
        const walletAccount = walletAcc
          ? {
              id: walletAcc.id,
              account_number: walletAcc.account_number || '',
              balance: Number(walletAcc.balance) || 0,
            }
          : null;

        setWallet({
          balance,
          currency,
          main_wallet_balance: mainWalletBalance,
          bonus_balance: bonusBalance,
          total_deposited: totalDeposited,
          total_withdrawn: totalWithdrawn,
          pending_withdrawals: pendingWd,
          total_live_balance: totalLiveBalance,
          wallet_account: walletAccount,
        });
      } catch (err) {
        if (id !== loadGen.current) return;
        const message = err instanceof Error ? err.message : 'Failed to load wallet';
        setLoadError(message);
        toast.error(message);
        setDemoFundingBlocked(false);
        setWallet({
          balance: 0,
          currency: 'USD',
          main_wallet_balance: 0,
          bonus_balance: 0,
          total_deposited: 0,
          total_withdrawn: 0,
          pending_withdrawals: 0,
        });
      } finally {
        if (id === loadGen.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [selectedAccountId, accountFromUrl],
  );

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const fmt = useCallback(
    (n: number) => formatCurrency(n, wallet?.currency || 'USD'),
    [wallet?.currency],
  );

  // Withdraw still uses the legacy `crypto / manual` FundingChannel; deposit
  // branches directly on depositUiSection now (no more depositChannel).

  useEffect(() => {
    setWithdrawChannel(withdrawUiSection === 'crypto' ? 'crypto' : 'manual');
  }, [withdrawUiSection]);

  // Default the deposit / withdrawal account picker to the first live row
  // (or the wallet-bound account if migrated) once accounts are loaded.
  useEffect(() => {
    // Non-migrated users always fund via the main wallet — default both
    // pickers to it (works even when they have no live trading account yet).
    if (!wallet?.wallet_account) {
      setDepositAccountId(MAIN_WALLET_OPTION_ID);
      setWithdrawAccountId(MAIN_WALLET_OPTION_ID);
      return;
    }
    if (liveAccounts.length === 0) return;
    const defaultId = wallet.wallet_account.id ?? liveAccounts[0]?.id ?? null;
    setDepositAccountId((cur) => cur && liveAccounts.some((a) => a.id === cur) ? cur : defaultId);
    setWithdrawAccountId((cur) => cur && liveAccounts.some((a) => a.id === cur) ? cur : defaultId);
  }, [liveAccounts, wallet?.wallet_account?.id]);

  // Default transfer pickers: source = main wallet (or wallet account if
  // migrated), destination = first non-source trading account.
  useEffect(() => {
    if (liveAccounts.length === 0) return;
    setTransferSourceId((cur) => {
      if (cur) return cur;
      return wallet?.wallet_account?.id ?? MAIN_WALLET_OPTION_ID;
    });
    setTransferDestinationId((cur) => {
      if (cur) return cur;
      // Deep-link from a trading account's Deposit/Transfer button
      // (?tab=transfer&account=X): preselect that account as the destination
      // so the user lands on main wallet → X and only has to type an amount.
      if (accountFromUrl && liveAccounts.some((a) => a.id === accountFromUrl)) {
        return accountFromUrl;
      }
      const first = liveAccounts.find((a) => a.id !== wallet?.wallet_account?.id);
      return first?.id ?? '';
    });
  }, [liveAccounts, wallet?.wallet_account?.id, accountFromUrl]);

  // Sync fundTargetPreference from the picked deposit/withdraw account so
  // the legacy submit handlers continue to tag the request correctly.
  useEffect(() => {
    if (!wallet?.wallet_account) return;
    if (tab === 'deposit') {
      setFundTargetPreference(depositAccountId === wallet.wallet_account.id ? 'wallet' : 'main');
    } else if (tab === 'withdrawal') {
      setFundTargetPreference(withdrawAccountId === wallet.wallet_account.id ? 'wallet' : 'main');
    }
  }, [tab, depositAccountId, withdrawAccountId, wallet?.wallet_account]);

  const loadManualBankDetails = useCallback(async () => {
    try {
      const amt = parseFloat(depositAmount);
      const body =
        !Number.isNaN(amt) && amt > 0 ? { amount: amt } : {};
      const d = await api.post<ManualBankDetailsResponse>('/wallet/deposit/bank-details', body);
      setManualBankInfo(d && Object.keys(d).length > 0 ? d : null);
    } catch {
      setManualBankInfo(null);
    }
  }, [depositAmount]);

  // Preload admin's deposit QR / bank details whenever the user lands on
  // the Crypto chip — that's where we render them (the legacy manual flow
  // populated the same fields).
  useEffect(() => {
    if (tab !== 'deposit' || depositUiSection !== 'crypto') return;
    void loadManualBankDetails();
  }, [tab, depositUiSection, loadManualBankDetails]);

  // Pull recent deposits and pick out the local-banking ones so they can
  // surface inline on the Local Banking chip. Stays cheap — the deposits
  // list is small and already used by /history.
  /** Create the Razorpay order for a "razorpay:awaiting" deposit then
   *  open the checkout popup. Two-step because the order is created
   *  lazily with the user's chosen amount. */
  const openRazorpayForAwaitingDeposit = useCallback(async (deposit: WalletListItem) => {
    const raw = rzpPayAmountByDeposit[deposit.id] || '';
    const amt = parseFloat(raw);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    setRzpCreatingForId(deposit.id);
    let order: { order_id: string; key_id: string; amount_inr: number } | null = null;
    try {
      order = await api.post<{ order_id: string; key_id: string; amount_inr: number }>(
        `/wallet/deposit/${deposit.id}/razorpay-order`,
        { amount: amt },
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not create Razorpay order');
      setRzpCreatingForId(null);
      return;
    }

    const SCRIPT_ID = 'razorpay-checkout';
    const ensureSdk = () =>
      new Promise<void>((resolve, reject) => {
        if (typeof window === 'undefined') return reject(new Error('no window'));
        const w = window as unknown as { Razorpay?: unknown };
        if (w.Razorpay) return resolve();
        const existing = document.getElementById(SCRIPT_ID);
        if (existing) {
          existing.addEventListener('load', () => resolve());
          existing.addEventListener('error', () => reject(new Error('Failed to load Razorpay')));
          return;
        }
        const s = document.createElement('script');
        s.id = SCRIPT_ID;
        s.src = 'https://checkout.razorpay.com/v1/checkout.js';
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Failed to load Razorpay'));
        document.body.appendChild(s);
      });
    try {
      await ensureSdk();
    } catch {
      toast.error('Could not load Razorpay');
      setRzpCreatingForId(null);
      return;
    }

    type RazorpayCtor = new (opts: Record<string, unknown>) => { open: () => void };
    const w = window as unknown as { Razorpay: RazorpayCtor };
    const rzp = new w.Razorpay({
      key: order.key_id,
      order_id: order.order_id,
      amount: Math.round(order.amount_inr * 100),
      currency: 'INR',
      name: 'PowerTradeFX',
      description: `Deposit ${deposit.id.slice(0, 8)}`,
      ...checkoutTheme(), // Razorpay's iframe can't read our CSS vars — resolve the accent token at call time
      handler: async (resp: Record<string, string>) => {
        try {
          await api.post('/wallet/deposit/razorpay/verify', {
            razorpay_order_id: resp.razorpay_order_id,
            razorpay_payment_id: resp.razorpay_payment_id,
            razorpay_signature: resp.razorpay_signature,
          });
          toast.success('Payment received — wallet credited');
          void loadLocalBankingRequests();
        } catch (e: unknown) {
          toast.error(e instanceof Error ? e.message : 'Verification failed');
        }
      },
    });
    rzp.open();
    setRzpCreatingForId(null);
  }, [rzpPayAmountByDeposit]);

  /** Open the Razorpay Checkout popup for an approved local-banking
   *  deposit. The order is already created server-side (deposit's
   *  transaction_id holds the order_id, payment_link holds the sentinel),
   *  so we only need to fetch the publishable key + locked amount and
   *  launch checkout.js. On success we re-poll the deposits list — the
   *  webhook will flip the row to "approved" once Razorpay confirms. */
  const openRazorpayCheckout = useCallback(async (deposit: WalletListItem) => {
    const orderId = deposit.transaction_id;
    if (!orderId) {
      toast.error('No Razorpay order on this deposit yet');
      return;
    }
    // Fetch the publishable key + INR amount for THIS order so we don't
    // hardcode the conversion math on the client.
    let keyId: string | undefined;
    let amountInr: number | undefined;
    try {
      const meta = await api.get<{ key_id?: string; amount_inr?: number; currency?: string }>(
        `/wallet/deposit/razorpay/${orderId}/meta`,
      );
      keyId = meta?.key_id;
      amountInr = meta?.amount_inr;
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Could not load payment details');
      return;
    }
    if (!keyId) {
      toast.error('Razorpay is not configured');
      return;
    }

    // Lazy-load the Checkout SDK exactly once.
    const SCRIPT_ID = 'razorpay-checkout';
    const ensureSdk = () =>
      new Promise<void>((resolve, reject) => {
        if (typeof window === 'undefined') return reject(new Error('no window'));
        const w = window as unknown as { Razorpay?: unknown };
        if (w.Razorpay) return resolve();
        if (document.getElementById(SCRIPT_ID)) {
          document.getElementById(SCRIPT_ID)!.addEventListener('load', () => resolve());
          document.getElementById(SCRIPT_ID)!.addEventListener('error', () =>
            reject(new Error('Failed to load Razorpay')),
          );
          return;
        }
        const s = document.createElement('script');
        s.id = SCRIPT_ID;
        s.src = 'https://checkout.razorpay.com/v1/checkout.js';
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Failed to load Razorpay'));
        document.body.appendChild(s);
      });

    try {
      await ensureSdk();
    } catch {
      toast.error('Could not load Razorpay');
      return;
    }

    type RazorpayCtor = new (opts: Record<string, unknown>) => { open: () => void };
    const w = window as unknown as { Razorpay: RazorpayCtor };

    const rzp = new w.Razorpay({
      key: keyId,
      order_id: orderId,
      amount: amountInr ? Math.round(amountInr * 100) : undefined,
      currency: 'INR',
      name: 'PowerTradeFX',
      description: `Deposit ${deposit.id.slice(0, 8)}`,
      prefill: {},
      ...checkoutTheme(), // Razorpay's iframe can't read our CSS vars — resolve the accent token at call time
      handler: async (resp: Record<string, string>) => {
        // Verify the signature server-side so the row credits via the
        // same locked path the webhook uses. Webhook will also catch
        // this independently — double-credit is prevented by the
        // (payment_id, "captured") dedup row in webhook_events.
        try {
          await api.post('/wallet/deposit/razorpay/verify', {
            razorpay_order_id: resp.razorpay_order_id,
            razorpay_payment_id: resp.razorpay_payment_id,
            razorpay_signature: resp.razorpay_signature,
          });
          toast.success('Payment received — wallet credited');
          void loadLocalBankingRequests();
        } catch (e: unknown) {
          toast.error(e instanceof Error ? e.message : 'Verification failed');
        }
      },
      modal: {
        ondismiss: () => {
          // No-op — user can re-open the popup from the same row.
        },
      },
    });
    rzp.open();
  }, []);

  const loadLocalBankingRequests = useCallback(async () => {
    try {
      const res = await api.get<{ items?: WalletListItem[] }>('/wallet/deposits');
      const items = res?.items ?? [];
      // local_banking is the new method for the LB flow. When admin
      // chooses "Approve & Razorpay" the row gets flipped to method=
      // razorpay with a payment_link of "razorpay:<order_id>" — we
      // still want to surface those here so the user can find their
      // pending Razorpay payment in the same place.
      const local = items.filter((d) => {
        const m = (d.method || '').toLowerCase();
        if (m === 'local_banking') return true;
        return m === 'razorpay' && (d.payment_link || '').startsWith('razorpay:');
      });
      setLocalBankingRequests(local);
    } catch {
      setLocalBankingRequests([]);
    }
  }, []);

  useEffect(() => {
    if (tab !== 'deposit' || depositUiSection !== 'local_banking') return;
    void loadLocalBankingRequests();
  }, [tab, depositUiSection, loadLocalBankingRequests]);

  /** Open withdraw via ?action=withdraw deep link. */
  useEffect(() => {
    if (loading || withdrawDeepLinkHandled.current) return;
    const act = searchParams.get('action');
    if (!act) return;
    if (act.toLowerCase() === 'withdraw') {
      if (demoFundingBlocked) {
        withdrawDeepLinkHandled.current = true;
        toast.error(DEMO_FUNDING_MSG);
        const next = new URLSearchParams(searchParams.toString());
        next.delete('action');
        const qs = next.toString();
        router.replace(qs ? `/wallet?${qs}` : '/wallet', { scroll: false });
        return;
      }
      withdrawDeepLinkHandled.current = true;
      setTab('withdrawal');
      setWithdrawUiSection('crypto');
      setWithdrawAmount('');
      setWithdrawCryptoAddress('');
      setManualWithdrawUpi('');
      setManualWithdrawNotes('');
      setManualWithdrawQrFile(null);
    } else if (act.toLowerCase() === 'deposit') {
      withdrawDeepLinkHandled.current = true;
      setTab('deposit');
    }
    const next = new URLSearchParams(searchParams.toString());
    next.delete('action');
    const qs = next.toString();
    router.replace(qs ? `/wallet?${qs}` : '/wallet', { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open once when deep-linked
  }, [loading, searchParams, router, demoFundingBlocked]);

  /** Open a specific tab via ?tab=history|transfer|withdrawal|deposit.
   *  Used by the consolidated transaction history (/transactions now
   *  redirects here with ?tab=history) and the account-card "Transfer
   *  funds" action (?tab=transfer). */
  const tabDeepLinkHandled = useRef(false);
  useEffect(() => {
    if (tabDeepLinkHandled.current) return;
    const t = searchParams.get('tab');
    if (!t) return;
    const valid: FundsTab[] = ['deposit', 'withdrawal', 'transfer', 'history'];
    if ((valid as string[]).includes(t)) {
      tabDeepLinkHandled.current = true;
      setTab(t as FundsTab);
    }
  }, [searchParams]);

  // Lazy-load history items when the user lands on the History tab.
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const [dep, wd, txn] = await Promise.allSettled([
        api.get<{ items?: WalletListItem[] }>('/wallet/deposits'),
        api.get<{ items?: WalletListItem[] }>('/wallet/withdrawals'),
        api.get<{ items?: (WalletListItem & { description?: string })[] }>('/wallet/transactions'),
      ]);
      const depItems = dep.status === 'fulfilled' ? dep.value?.items || [] : [];
      const wdItems = wd.status === 'fulfilled' ? wd.value?.items || [] : [];
      const txnItems = txn.status === 'fulfilled' ? txn.value?.items || [] : [];
      // Transaction History should only surface SETTLED activity. A
      // Razorpay popup that was opened and closed without paying, or
      // an LB request still awaiting admin review, are in-progress
      // states — they belong in the Deposit tab's "Your requests"
      // panel, not here.
      const SETTLED_STATUSES = new Set([
        'approved', 'auto_approved', 'completed', 'paid',
        'rejected', 'failed', 'cancelled',
      ]);
      const settledDeposits = depItems.filter((d) =>
        SETTLED_STATUSES.has(String(d.status || '').toLowerCase()),
      );
      const settledWithdrawals = wdItems.filter((w) =>
        SETTLED_STATUSES.has(String(w.status || '').toLowerCase()),
      );
      // Internal transfer legs (trading ↔ main wallet). Deposits/withdrawals
      // are already fetched above, so we pull only the 'transfer' rows here to
      // avoid double-listing. Each transfer surfaces both legs (out of one
      // bucket, into the other) with its own descriptive label.
      const transferItems: WalletListItem[] = txnItems
        .filter((t) => (t.type || '').toLowerCase() === 'transfer')
        .map((t) => ({ ...t, method: t.description || t.method }));
      const merged = [...settledDeposits, ...settledWithdrawals, ...transferItems].sort((a, b) => {
        const ad = a.created_at ? Date.parse(a.created_at) : 0;
        const bd = b.created_at ? Date.parse(b.created_at) : 0;
        return bd - ad;
      });
      setHistoryItems(merged);
    } catch {
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab !== 'history') return;
    void loadHistory();
  }, [tab, loadHistory]);

  const submitWithdraw = async () => {
    if (demoFundingBlocked) {
      toast.error(DEMO_FUNDING_MSG);
      return;
    }
    const amt = parseFloat(withdrawAmount);
    if (!amt || amt <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (withdrawChannel === 'crypto') {
      const opt = WITHDRAW_NETWORK_OPTIONS.find((o) => o.network === withdrawNetwork)
        ?? WITHDRAW_NETWORK_OPTIONS[0]!;
      const addr = withdrawCryptoAddress.trim();
      if (!addr) {
        toast.error('Enter your USDT wallet address');
        return;
      }
      if (!opt.addressRegex.test(addr)) {
        toast.error(`Invalid ${opt.label} address. ${opt.addressHint}`);
        return;
      }
      setWithdrawSubmitting(true);
      try {
        await api.post('/wallet/withdraw/onchain', {
          network: opt.network,
          amount: amt,
          destination_address: addr,
          source: wallet?.wallet_account ? fundTargetPreference : undefined,
        });
        toast.success(`Withdrawal of $${amt.toLocaleString()} submitted — pending approval`);
        setWithdrawCryptoAddress('');
        void fetchData(true);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Withdrawal failed');
      } finally {
        setWithdrawSubmitting(false);
      }
      return;
    }

    const upi = manualWithdrawUpi.trim();
    if (!upi && !manualWithdrawQrFile) {
      toast.error('Enter your UPI ID and/or upload a QR code for manual payout');
      return;
    }
    setWithdrawSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('amount', String(amt));
      fd.append('upi_id', upi);
      fd.append('payout_notes', manualWithdrawNotes.trim());
      if (manualWithdrawQrFile) fd.append('file', manualWithdrawQrFile);
      if (wallet?.wallet_account) fd.append('source', fundTargetPreference);
      const token = api.getToken();
      // Multipart uploads bypass the api client (it sets a JSON
       // content-type) but we still need the absolute API base so the
       // request lands on the gateway (api.powertradefx.com) and not on
       // whichever marketing apex / trader subdomain the user is on.
      const res = await fetch(`${getApiBase()}/wallet/withdraw/manual`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
        credentials: 'include',
      });
      const raw = await res.text();
      let json: { detail?: unknown; message?: string } = {};
      try {
        json = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(raw.slice(0, 200) || `Request failed (${res.status})`);
      }
      if (!res.ok) {
        const d = json.detail;
        const msg =
          typeof d === 'string'
            ? d
            : Array.isArray(d)
              ? d.map((x: { msg?: string }) => x.msg).join(', ')
              : 'Withdrawal failed';
        throw new Error(msg);
      }
      toast.success(`Manual withdrawal of $${amt.toLocaleString()} submitted — pending approval`);
      void fetchData(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Withdrawal failed');
    } finally {
      setWithdrawSubmitting(false);
    }
  };

  const submitDeposit = async () => {
    if (demoFundingBlocked) {
      toast.error(DEMO_FUNDING_MSG);
      return;
    }
    // Crypto requires a real amount (user pays exactly that to admin's
    // QR). Local Banking is a permission request — admin sets the
    // final amount at approval time, so 0 is OK here.
    const amt = depositUiSection === 'local_banking'
      ? (parseFloat(depositAmount) || 0)
      : parseFloat(depositAmount);
    if (depositUiSection !== 'local_banking' && (!amt || amt <= 0)) {
      toast.error('Enter a valid amount');
      return;
    }
    // ── Crypto channel: user pays via admin's QR / wallet info shown
    //   in the panel, then uploads proof + reference. Existing manual
    //   deposit endpoint handles the row + admin review.
    if (depositUiSection === 'crypto') {
      // If admin hasn't configured any manual destination, the user has
      // no place to send funds outside the gateway — they should use
      // "Pay with crypto gateway" instead of hitting Continue.
      const hasManualDestination = !!(
        manualBankInfo &&
        (manualBankInfo.bank_name ||
          manualBankInfo.upi_id ||
          manualBankInfo.qr_code_url ||
          manualBankInfo.wallet_address)
      );
      if (!hasManualDestination) {
        toast.error('No manual payment destination configured — use "Pay with crypto gateway".');
        return;
      }
      if (!depositTxId.trim()) {
        toast.error('Enter your transaction reference / tx hash');
        return;
      }
      if (!depositProofFile) {
        toast.error('Upload a screenshot of your payment');
        return;
      }
      setDepositSubmitting(true);
      try {
        const fd = new FormData();
        fd.append('amount', String(amt));
        fd.append('transaction_id', depositTxId.trim());
        fd.append('file', depositProofFile);
        if (wallet?.wallet_account) fd.append('target', fundTargetPreference);
        const token = api.getToken();
        const res = await fetch(`${getApiBase()}/wallet/deposit/manual`, {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
          credentials: 'include',
        });
        const raw = await res.text();
        let json: { detail?: unknown; message?: string } = {};
        try {
          json = raw ? JSON.parse(raw) : {};
        } catch {
          throw new Error(raw.slice(0, 200) || `Request failed (${res.status})`);
        }
        if (!res.ok) {
          const d = json.detail;
          const msg =
            typeof d === 'string'
              ? d
              : Array.isArray(d)
                ? d.map((x: { msg?: string }) => x.msg).join(', ')
                : 'Deposit failed';
          throw new Error(msg);
        }
        toast.success(`Deposit of $${amt.toLocaleString()} submitted — pending approval`);
        setDepositAmount('');
        setDepositTxId('');
        setDepositProofFile(null);
        void fetchData(true);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Deposit failed');
      } finally {
        setDepositSubmitting(false);
      }
      return;
    }

    // ── Local Banking channel: user just submits an amount. Admin
    //   reviews KYC and pushes back a payment link out of band (via the
    //   new /wallet/deposit/local-banking endpoint). KYC-gated.
    if (!kycApproved) {
      toast.error('Complete KYC verification to use Local Banking deposits.');
      router.push('/kyc');
      return;
    }
    setDepositSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('amount', String(amt));
      const token = api.getToken();
      const res = await fetch(`${getApiBase()}/wallet/deposit/local-banking`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
        credentials: 'include',
      });
      const raw = await res.text();
      let json: { detail?: unknown; message?: string } = {};
      try {
        json = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(raw.slice(0, 200) || `Request failed (${res.status})`);
      }
      if (!res.ok) {
        const d = json.detail;
        const msg =
          typeof d === 'string'
            ? d
            : Array.isArray(d)
              ? d.map((x: { msg?: string }) => x.msg).join(', ')
              : 'Request failed';
        // Backend signals missing KYC as a special detail string so we can
        // route the user straight to the form instead of confusing copy.
        if (msg === 'KYC_REQUIRED') {
          toast.error('Complete KYC verification to continue.');
          router.push('/kyc');
          return;
        }
        throw new Error(msg);
      }
      toast.success(
        "Deposit request submitted. Our team will review your KYC and share payment details with you shortly.",
      );
      setDepositAmount('');
      void fetchData(true);
      void loadLocalBankingRequests();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setDepositSubmitting(false);
    }
  };

  /**
   * "I've Paid" — the user has paid via the admin's payment link and is
   * uploading their proof so the admin can confirm and credit the wallet.
   */
  const submitLocalBankingProof = async (depositId: string) => {
    const amt = parseFloat(confirmAmount);
    if (!amt || amt <= 0) {
      toast.error('Enter the amount you paid');
      return;
    }
    if (!confirmTxId.trim()) {
      toast.error('Enter the UTR / UPI reference of your payment');
      return;
    }
    if (!confirmFile) {
      toast.error('Upload a screenshot or PDF of your payment');
      return;
    }
    setConfirmSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('amount', String(amt));
      fd.append('transaction_id', confirmTxId.trim());
      fd.append('file', confirmFile);
      const token = api.getToken();
      const res = await fetch(
        `${getApiBase()}/wallet/deposit/local-banking/${depositId}/confirm-payment`,
        {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: fd,
          credentials: 'include',
        },
      );
      const raw = await res.text();
      let json: { detail?: unknown } = {};
      try { json = raw ? JSON.parse(raw) : {}; } catch { throw new Error(raw.slice(0, 200) || `Request failed (${res.status})`); }
      if (!res.ok) {
        const d = json.detail;
        const msg =
          typeof d === 'string'
            ? d
            : Array.isArray(d)
              ? d.map((x: { msg?: string }) => x.msg).join(', ')
              : 'Could not submit proof';
        throw new Error(msg);
      }
      toast.success("Proof submitted. We'll confirm and credit your wallet shortly.");
      setConfirmingId(null);
      setConfirmAmount('');
      setConfirmTxId('');
      setConfirmFile(null);
      void loadLocalBankingRequests();
      void fetchData(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not submit proof');
    } finally {
      setConfirmSubmitting(false);
    }
  };

  /**
   * Submit a transfer between two accounts. The backend only exposes
   * main↔trading transfers, so this resolves the picked source/destination
   * pair into one of those two endpoints. trading↔trading transfers aren't
   * supported on the backend yet — surfaced as an inline toast.
   */
  const submitTransfer = async () => {
    if (demoFundingBlocked) {
      toast.error(DEMO_FUNDING_MSG);
      return;
    }
    if (!transferSourceId || !transferDestinationId) {
      toast.error('Pick a source and destination account');
      return;
    }
    if (transferSourceId === transferDestinationId) {
      toast.error('Source and destination must be different');
      return;
    }
    const amt = parseFloat(transferAmount);
    if (!amt || amt <= 0) {
      toast.error('Enter a valid amount');
      return;
    }

    const srcIsMain = transferSourceId === MAIN_WALLET_OPTION_ID;
    const destIsMain = transferDestinationId === MAIN_WALLET_OPTION_ID;

    if (!srcIsMain && !destIsMain) {
      toast.error('Transfers between two trading accounts are not yet supported — route via main wallet.');
      return;
    }

    setTransferSubmitting(true);
    try {
      if (srcIsMain) {
        await api.post('/wallet/transfer-main-to-trading', {
          to_account_id: transferDestinationId,
          amount: amt,
        });
        const num = liveAccounts.find((a) => a.id === transferDestinationId)?.account_number ?? '';
        toast.success(`$${amt.toLocaleString()} sent to ${num || 'trading account'}`);
      } else {
        await api.post('/wallet/transfer-trading-to-main', {
          from_account_id: transferSourceId,
          amount: amt,
        });
        toast.success(`$${amt.toLocaleString()} moved to main wallet`);
      }
      setTransferAmount('');
      void fetchData(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Transfer failed');
    } finally {
      setTransferSubmitting(false);
    }
  };

  // Validation flags ------------------------------------------------------

  const depositAccount = useMemo(
    () => liveAccounts.find((a) => a.id === depositAccountId) ?? null,
    [liveAccounts, depositAccountId],
  );
  const depositMinDeposit = Number(depositAccount?.account_group?.minimum_deposit ?? 0);
  const depositAmountNumber = parseFloat(depositAmount);
  const depositAmountValid =
    !Number.isNaN(depositAmountNumber) &&
    depositAmountNumber > 0 &&
    (depositMinDeposit <= 0 || depositAmountNumber >= depositMinDeposit);
  const depositCanContinue =
    !demoFundingBlocked &&
    !depositSubmitting &&
    !!depositAccountId &&
    // Crypto needs amount; LB is KYC-gated and amount is optional.
    (depositUiSection === 'local_banking' ? kycApproved : depositAmountValid);

  const withdrawAmountNumber = parseFloat(withdrawAmount);
  const withdrawAmountValid = !Number.isNaN(withdrawAmountNumber) && withdrawAmountNumber > 0;
  const withdrawAddrTrimmed = withdrawCryptoAddress.trim();
  const withdrawActiveNetwork =
    WITHDRAW_NETWORK_OPTIONS.find((o) => o.network === withdrawNetwork)
    ?? WITHDRAW_NETWORK_OPTIONS[0]!;
  const withdrawAddrValid =
    withdrawChannel !== 'crypto'
      ? true
      : withdrawAddrTrimmed.length > 0 && withdrawActiveNetwork.addressRegex.test(withdrawAddrTrimmed);
  const withdrawCanContinue =
    !demoFundingBlocked &&
    !withdrawSubmitting &&
    !!withdrawAccountId &&
    withdrawAmountValid &&
    withdrawAddrValid;

  const transferAmountNumber = parseFloat(transferAmount);
  const transferAmountValid = !Number.isNaN(transferAmountNumber) && transferAmountNumber > 0;
  const transferCanContinue =
    !demoFundingBlocked &&
    !transferSubmitting &&
    !!transferSourceId &&
    !!transferDestinationId &&
    transferSourceId !== transferDestinationId &&
    transferAmountValid;


  // The manual crypto path needs somewhere to send funds. Mirrors the check
  // inside submitDeposit(); used here only to decide what to render.
  const hasManualDestination = !!(
    manualBankInfo &&
    (manualBankInfo.bank_name ||
      manualBankInfo.upi_id ||
      manualBankInfo.qr_code_url ||
      manualBankInfo.wallet_address)
  );

  if (loading) {
    return (
      <DashboardShell>
        <WalletSkeleton />
      </DashboardShell>
    );
  }

  if (isDemo) {
    return (
      <DashboardShell>
        <DemoLockGate
          feature="Deposits & Withdrawals"
          description="Funding is only available on real trading accounts. Register a live account to deposit, withdraw and transfer funds."
        >
          <></>
        </DemoLockGate>
      </DashboardShell>
    );
  }

  // ── Render -----------------------------------------------------------

  const currency = wallet?.currency || 'USD';

  // Non-migrated users fund through the main wallet: deposits land there and
  // withdrawals come from it; trading accounts are funded via the Transfer
  // tab. Migrated / wallet-bound users pick a real account row directly.
  const accountOptionsForFunding: AccountOption[] = wallet?.wallet_account
    ? liveAccounts.map((a) => ({
        id: a.id,
        label: `${a.account_group?.name || 'Standard'} · ${a.account_number || a.id.slice(0, 8)}`,
        sublabel: formatCurrency(Number(a.balance) || 0, a.currency || wallet?.currency || 'USD'),
      }))
    : [
        {
          id: MAIN_WALLET_OPTION_ID,
          label: 'Main Wallet',
          sublabel: formatCurrency(Number(wallet?.main_wallet_balance ?? 0), wallet?.currency || 'USD'),
        },
      ];

  /** Admin's QR / bank / UPI / wallet destination for the manual crypto path. */
  const renderPayTo = (info: ManualBankDetailsResponse) => (
    <Card nested padding="sm" className="space-y-3">
      <p className="text-xxs font-bold uppercase tracking-[0.12em] text-text-tertiary">Pay to</p>
      {info.qr_code_url && (
        <img
          src={info.qr_code_url}
          alt="Admin payment QR"
          className="block h-40 w-40 rounded-md border border-border-primary bg-card object-contain"
        />
      )}
      <div className="space-y-1 text-xs text-text-secondary">
        {info.bank_name && (
          <div><span className="font-semibold text-text-primary">Bank:</span> {info.bank_name}</div>
        )}
        {info.account_holder && (
          <div><span className="font-semibold text-text-primary">Holder:</span> {info.account_holder}</div>
        )}
        {info.account_number && (
          <div><span className="font-semibold text-text-primary">A/C:</span> {info.account_number}</div>
        )}
        {info.ifsc_code && (
          <div><span className="font-semibold text-text-primary">IFSC:</span> {info.ifsc_code}</div>
        )}
        {info.upi_id && (
          <div><span className="font-semibold text-text-primary">UPI:</span> {info.upi_id}</div>
        )}
      </div>
      {info.wallet_address && (
        <div className="space-y-2 border-t border-border-secondary pt-3">
          <p className="text-xxs font-bold uppercase tracking-[0.12em] text-text-tertiary">Crypto address</p>
          <div className="flex items-start gap-3 rounded-md border border-border-primary bg-card p-2.5">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&margin=2&data=${encodeURIComponent(info.wallet_address)}`}
              alt="Wallet address QR"
              className="block h-24 w-24 shrink-0 rounded-sm border border-border-primary bg-card object-contain"
            />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="break-all font-mono text-xs leading-snug text-text-primary">{info.wallet_address}</p>
              <Button
                variant="link"
                size="xs"
                leftIcon={<Copy className="h-3.5 w-3.5" />}
                onClick={() => {
                  navigator.clipboard?.writeText(info.wallet_address!);
                  toast.success('Address copied');
                }}
              >
                Copy address
              </Button>
            </div>
          </div>
          <p className="text-xxs leading-snug text-text-tertiary">
            Scan the QR or copy the address. After paying, paste your transaction hash below as proof.
          </p>
        </div>
      )}
    </Card>
  );

  /** One local-banking request: status, the admin-issued link / Razorpay
   *  CTA, and the inline "I've Paid" proof form. */
  const renderLocalBankingRequest = (r: WalletListItem) => {
    const status = (r.status || 'pending').toLowerCase();
    const isApproved = status === 'approved' || status === 'auto_approved';
    const isRejected = status === 'rejected' || status === 'failed';
    const hasLink = !!r.payment_link;
    const proofSubmitted = Number(r.amount || 0) > 0;
    const isConfirming = confirmingId === r.id;
    const stage = isApproved
      ? 'Credited'
      : isRejected
        ? 'Rejected'
        : proofSubmitted
          ? 'Proof submitted — admin verifying'
          : hasLink
            ? 'Payment link ready'
            : 'Awaiting admin review';
    // Three link states:
    //   razorpay:awaiting → admin approved, user enters amount and creates the order
    //   razorpay:<order_id> → order already created (legacy / repeat-open path) — open popup
    //   anything else → external link admin shared
    const pl = r.payment_link || '';
    const isRzpAwaiting = pl === 'razorpay:awaiting';
    const isRzpOrder = pl.startsWith('razorpay:') && !isRzpAwaiting;
    const showActions = hasLink && !isApproved && !isRejected && !proofSubmitted && !isRzpAwaiting;
    const rzpBusy = rzpCreatingForId === r.id;

    return (
      <Card key={r.id} nested padding="sm" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold tabular-nums text-text-primary">
                {proofSubmitted ? `$${Number(r.amount || 0).toLocaleString()}` : 'Deposit request'}
              </span>
              <Badge size="sm" dot variant={isApproved ? 'success' : isRejected ? 'danger' : 'warning'}>
                {isApproved ? 'Credited' : isRejected ? 'Rejected' : 'Pending'}
              </Badge>
            </div>
            <p className="mt-0.5 text-xs text-text-tertiary">
              {r.created_at ? new Date(r.created_at).toLocaleString() : ''} · {stage}
            </p>
          </div>
          {showActions && (
            <div className="flex shrink-0 items-center gap-1.5">
              {isRzpOrder ? (
                <Button size="sm" variant="secondary" onClick={() => void openRazorpayCheckout(r)}>
                  Pay with Razorpay
                </Button>
              ) : (
                <>
                  <a href={r.payment_link as string} target="_blank" rel="noopener noreferrer" className={LINK_BUTTON_CLASS}>
                    Pay now
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                  <Button
                    size="sm"
                    variant={isConfirming ? 'ghost' : 'outline'}
                    onClick={() => {
                      setConfirmingId(isConfirming ? null : r.id);
                      setConfirmAmount('');
                      setConfirmTxId('');
                      setConfirmFile(null);
                    }}
                  >
                    {isConfirming ? 'Cancel' : "I've Paid"}
                  </Button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Razorpay-awaiting form — admin approved, user enters the amount and
            we create the Razorpay order on the fly, then open Checkout. */}
        {isRzpAwaiting && !isApproved && !isRejected && (
          <Card padding="sm" className="space-y-3">
            <p className="text-xs leading-snug text-text-tertiary">
              Your request was approved. Enter how much you want to deposit and pay via Razorpay.
            </p>
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Input
                  label="Amount (USD)"
                  numeric
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="1"
                  value={rzpPayAmountByDeposit[r.id] || ''}
                  onChange={(e) => setRzpPayAmountByDeposit((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  placeholder="e.g. 100"
                />
              </div>
              <Button
                variant="secondary"
                loading={rzpBusy}
                disabled={rzpBusy || !(parseFloat(rzpPayAmountByDeposit[r.id] || '0') > 0)}
                onClick={() => void openRazorpayForAwaitingDeposit(r)}
              >
                {rzpBusy ? 'Opening…' : 'Pay with Razorpay'}
              </Button>
            </div>
          </Card>
        )}

        {/* Inline "I've Paid" form — collapses back when closed. */}
        {isConfirming && (
          <Card padding="sm" className="space-y-3">
            <Input
              label="Amount paid (USD)"
              numeric
              type="number"
              inputMode="decimal"
              step="0.01"
              value={confirmAmount}
              onChange={(e) => setConfirmAmount(e.target.value)}
              placeholder="e.g. 100"
            />
            <Input
              label="UTR / UPI reference"
              type="text"
              value={confirmTxId}
              onChange={(e) => setConfirmTxId(e.target.value)}
              placeholder="Transaction reference from your bank / UPI app"
            />
            <Input
              label="Payment proof (screenshot / PDF)"
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setConfirmFile(e.target.files?.[0] ?? null)}
              className={FILE_INPUT_CLASS}
            />
            <Button
              variant="secondary"
              fullWidth
              loading={confirmSubmitting}
              onClick={() => void submitLocalBankingProof(r.id)}
            >
              {confirmSubmitting ? 'Submitting…' : 'Submit proof'}
            </Button>
          </Card>
        )}
      </Card>
    );
  };

  const renderDepositTab = () => (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Deposit funds" description="Pick the account to fund, then choose how you want to pay." />
        <CardBody className="space-y-4">
          <AccountSelect
            label="Account"
            value={depositAccountId}
            options={accountOptionsForFunding}
            placeholder="Select an account"
            onChange={(id) => {
              setDepositAccountId(id);
              setDepositAmount('');
            }}
            disabled={accountOptionsForFunding.length === 0}
          />

          {/* Amount — required for Crypto, optional for Local Banking. LB
              users submit a permission request; the admin sets the final
              Razorpay charge amount at approval time so the user can leave
              this blank or use it as a suggestion. */}
          <Input
            label={`Amount${depositUiSection === 'local_banking' ? ' (optional)' : ''}`}
            numeric
            type="number"
            inputMode="decimal"
            min={depositMinDeposit > 0 ? depositMinDeposit : 0}
            step="0.01"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            placeholder="Enter an amount"
            suffix={currency}
            error={
              depositAmount && !depositAmountValid && depositMinDeposit > 0
                ? `Minimum deposit for this account is ${formatCurrency(depositMinDeposit, depositAccount?.currency || wallet?.currency || 'USD')}.`
                : undefined
            }
            hint={
              depositMinDeposit > 0 && depositAmountValid
                ? `Minimum deposit: ${formatCurrency(depositMinDeposit, depositAccount?.currency || wallet?.currency || 'USD')}`
                : undefined
            }
          />

          {/* Payment method: Crypto (admin's QR shown, user pays + uploads
              proof) and Local Banking (request flow, admin sends back link). */}
          <Field label="Payment method">
            <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MethodCard
                active={depositUiSection === 'crypto'}
                label="Crypto"
                badge={<Badge size="sm" variant="success">Auto-credit</Badge>}
                onSelect={() => setDepositUiSection('crypto')}
              />
              <MethodCard
                active={depositUiSection === 'local_banking'}
                label="Local Banking"
                sub="Request payment link"
                badge={
                  <Badge size="sm" variant={kycApproved ? 'neutral' : 'warning'}>
                    {kycApproved ? 'Admin review' : 'KYC required'}
                  </Badge>
                }
                onSelect={() => setDepositUiSection('local_banking')}
              />
            </div>
          </Field>

          {/* Channel-specific extras ------------------------------ */}
          {depositUiSection === 'crypto' ? (
            <>
              {/* Admin's QR / wallet info — same source as the legacy manual
                  flow used (per-tier bank/UPI/QR rows the admin maintains). */}
              {hasManualDestination && renderPayTo(manualBankInfo!)}

              {/* Automated crypto checkout via the OxaPay gateway. Opens a
                  hosted page where the user picks a coin/network, pays, and
                  the OxaPay webhook auto-credits the deposit — no manual
                  tx-hash entry required. */}
              <Button
                variant="outline"
                size="lg"
                fullWidth
                rightIcon={<ExternalLink className="h-4 w-4" />}
                loading={cryptoGatewayBusy}
                disabled={cryptoGatewayBusy || !(parseFloat(depositAmount) > 0)}
                onClick={() => void openCryptoGatewayCheckout()}
              >
                {cryptoGatewayBusy ? 'Opening gateway…' : 'Pay with crypto gateway'}
              </Button>

              {/* Manual proof submission — only when admin has configured a
                  bank/UPI/QR/wallet to pay TO. Otherwise the user has nowhere
                  to send funds manually, so hide the tx-hash + proof fields
                  rather than show empty inputs that lead to a stuck request. */}
              {hasManualDestination && (
                <>
                  <p className="text-center text-xs leading-snug text-text-tertiary">
                    Or pay manually to the address above and submit your transaction hash below.
                  </p>
                  <Input
                    label="Transaction reference / tx hash"
                    type="text"
                    value={depositTxId}
                    onChange={(e) => setDepositTxId(e.target.value)}
                    placeholder="On-chain tx hash, UTR, or transfer reference"
                    className="font-mono"
                  />
                  <Input
                    label="Payment proof"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setDepositProofFile(e.target.files?.[0] ?? null)}
                    className={FILE_INPUT_CLASS}
                  />
                </>
              )}
            </>
          ) : (
            <div className="space-y-3">
              {!kycApproved && (
                <Card nested padding="sm" className="flex flex-wrap items-center justify-between gap-3 border-warning/40">
                  <span className="text-sm leading-relaxed text-text-primary">
                    Local Banking requires <span className="font-semibold">verified KYC</span>.
                  </span>
                  <Button size="sm" variant="secondary" onClick={() => router.push('/kyc')}>
                    Complete KYC
                  </Button>
                </Card>
              )}
              <p className="rounded-md bg-bg-tertiary px-4 py-3 text-sm leading-relaxed text-text-secondary">
                Submit this request and our team will share a payment link (Razorpay, bank transfer, or UPI) with you shortly. Your wallet is credited the USD amount once payment is confirmed.
              </p>

              {/* User's existing local-banking requests (admin queue / link). */}
              {localBankingRequests.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xxs font-bold uppercase tracking-[0.12em] text-text-tertiary">Your requests</p>
                  {localBankingRequests.slice(0, 5).map(renderLocalBankingRequest)}
                </div>
              )}
            </div>
          )}

          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!depositCanContinue}
            loading={depositSubmitting}
            onClick={() => void submitDeposit()}
          >
            {depositSubmitting ? 'Processing…' : depositUiSection === 'local_banking' ? 'Send Request' : 'Continue'}
          </Button>
        </CardBody>
      </Card>

      <StepsCard
        steps={[
          {
            icon: <WalletIcon size={16} />,
            title: 'Deposit Funds',
            description: 'Start by depositing the desired amount into your account to initiate the process.',
            state: 'current',
          },
          {
            icon: <CreditCard size={16} />,
            title: 'Select Deposit Method',
            description: 'Choose the most convenient payment method from the available options for your deposit.',
            state: 'upcoming',
          },
        ]}
      />
    </div>
  );

  const renderWithdrawalTab = () => (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader title="Withdraw funds" description="Requests are reviewed by finance before funds are released." />
        <CardBody className="space-y-4">
          <AccountSelect
            label="Account"
            value={withdrawAccountId}
            options={accountOptionsForFunding}
            placeholder="Select an account"
            onChange={(id) => {
              setWithdrawAccountId(id);
              setWithdrawAmount('');
            }}
            disabled={accountOptionsForFunding.length === 0}
          />

          <Input
            label="Amount"
            numeric
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            placeholder="Enter an amount"
            suffix={currency}
            hint={
              <span className="flex items-center justify-end">
                <Button
                  variant="link"
                  size="xs"
                  onClick={() => {
                    const acc = liveAccounts.find((a) => a.id === withdrawAccountId);
                    const bal = Number(acc?.balance ?? wallet?.main_wallet_balance ?? 0);
                    setWithdrawAmount(String(Math.max(0, bal)));
                  }}
                >
                  Max
                </Button>
              </span>
            }
          />

          <Field label="Payout method">
            <div role="radiogroup" aria-label="Payout method" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <MethodCard
                active={withdrawUiSection === 'crypto'}
                label="Crypto"
                sub="USDT on-chain"
                badge={<Badge size="sm" variant="info">Up to 24h</Badge>}
                onSelect={() => setWithdrawUiSection('crypto')}
              />
              <MethodCard
                active={withdrawUiSection === 'bank'}
                label="Bank / UPI"
                sub="Manual payout"
                badge={<Badge size="sm" variant="neutral">Finance review</Badge>}
                onSelect={() => setWithdrawUiSection('bank')}
              />
            </div>
          </Field>

          {withdrawUiSection === 'crypto' ? (
            <>
              <Field label="USDT Network">
                <div role="radiogroup" aria-label="USDT network" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {WITHDRAW_NETWORK_OPTIONS.map((opt) => (
                    <MethodCard
                      key={opt.network}
                      active={opt.network === withdrawNetwork}
                      label={opt.label}
                      sub={opt.sub}
                      onSelect={() => setWithdrawNetwork(opt.network)}
                    />
                  ))}
                </div>
              </Field>
              <Input
                label={`Your ${withdrawActiveNetwork.label} address`}
                type="text"
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                value={withdrawCryptoAddress}
                onChange={(e) => setWithdrawCryptoAddress(e.target.value)}
                placeholder={withdrawActiveNetwork.addressHint}
                className="font-mono"
                error={
                  withdrawAddrTrimmed && !withdrawAddrValid
                    ? `That doesn't look like a valid ${withdrawActiveNetwork.label} address.`
                    : undefined
                }
                hint={
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span>Double-check the address — payouts on the wrong network can&apos;t be recovered. Processing time: up to 24h.</span>
                    {linkedWalletAddress && withdrawActiveNetwork.addressRegex.test(linkedWalletAddress) && (
                      <Button variant="link" size="xs" onClick={() => setWithdrawCryptoAddress(linkedWalletAddress)}>
                        Use linked wallet
                      </Button>
                    )}
                  </span>
                }
              />
            </>
          ) : (
            <>
              <Input
                label="UPI ID"
                type="text"
                value={manualWithdrawUpi}
                onChange={(e) => setManualWithdrawUpi(e.target.value)}
                placeholder="yourname@upi"
              />
              <Input
                label="QR code (optional)"
                type="file"
                accept="image/*"
                onChange={(e) => setManualWithdrawQrFile(e.target.files?.[0] ?? null)}
                className={FILE_INPUT_CLASS}
              />
              <Input
                label="Notes (optional)"
                type="text"
                value={manualWithdrawNotes}
                onChange={(e) => setManualWithdrawNotes(e.target.value)}
                placeholder="Any context for finance"
              />
            </>
          )}

          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={!withdrawCanContinue}
            loading={withdrawSubmitting}
            onClick={() => void submitWithdraw()}
          >
            {withdrawSubmitting
              ? 'Processing…'
              : withdrawAmount
                ? `Continue — ${fmt(withdrawAmountNumber || 0)}`
                : 'Continue'}
          </Button>
        </CardBody>
      </Card>

      <StepsCard
        steps={[
          {
            icon: <ArrowUpFromLine size={16} />,
            title: 'Withdrawal Request',
            description: 'Enter the amount and payout destination, then submit your request for review.',
            state: 'current',
          },
          {
            icon: <CheckCircle2 size={16} />,
            title: 'Funds Released',
            description: 'Finance approves the request and your funds are released to the chosen destination.',
            state: 'upcoming',
          },
        ]}
      />
    </div>
  );

  const renderTransferTab = () => {
    // Build the option list once — main wallet (or wallet account row, when
    // migrated) + every other live trading account.
    const sharedOptions: AccountOption[] = [
      ...(wallet?.wallet_account
        ? [] // wallet-bound users have their wallet listed as a normal row
        : [{
            id: MAIN_WALLET_OPTION_ID,
            label: 'Main Wallet',
            sublabel: formatCurrency(Number(wallet?.main_wallet_balance ?? 0), wallet?.currency || 'USD'),
          }]),
      ...liveAccounts.map((a) => ({
        id: a.id,
        label: `${a.account_group?.name || (a.is_wallet_account ? 'Wallet Account' : 'Standard')} · ${a.account_number || a.id.slice(0, 8)}`,
        sublabel: formatCurrency(Number(a.balance) || 0, a.currency || wallet?.currency || 'USD'),
      })),
    ];
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Transfer between accounts" description="Move funds between your main wallet and trading accounts." />
          <CardBody className="space-y-4">
            <AccountSelect
              label="From"
              value={transferSourceId}
              options={sharedOptions}
              placeholder="Select source account"
              onChange={setTransferSourceId}
              disabled={sharedOptions.length === 0}
            />
            <AccountSelect
              label="To"
              value={transferDestinationId}
              options={sharedOptions.filter((o) => o.id !== transferSourceId)}
              placeholder="Select destination account"
              onChange={setTransferDestinationId}
              disabled={sharedOptions.length === 0}
            />
            <Input
              label="Amount"
              numeric
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              placeholder="Enter an amount"
              suffix={currency}
              hint="Transfers between accounts are instant. Trading-account ↔ trading-account routes via your main wallet automatically."
            />

            <Button
              variant="primary"
              size="lg"
              fullWidth
              disabled={!transferCanContinue}
              loading={transferSubmitting}
              onClick={() => void submitTransfer()}
            >
              {transferSubmitting ? 'Processing…' : 'Continue'}
            </Button>
          </CardBody>
        </Card>

        <StepsCard
          steps={[
            {
              icon: <WalletIcon size={16} />,
              title: 'Pick Source Account',
              description: 'Choose the account you want to move funds from.',
              state: 'current',
            },
            {
              icon: <ArrowLeftRight size={16} />,
              title: 'Pick Destination Account',
              description: 'Select where the funds should land and confirm the transfer.',
              state: 'upcoming',
            },
          ]}
        />
      </div>
    );
  };

  const renderHistoryTab = () => (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card padding="none" className="lg:col-span-2">
        <CardHeader
          title="Recent transactions"
          className="mb-0 border-b border-border-secondary px-4 py-3 md:px-5"
          actions={
            <Button
              size="sm"
              variant="secondary"
              leftIcon={<FileText className="h-3.5 w-3.5" />}
              onClick={() => {
                if (historyItems.length === 0) { toast.error('No transactions to export'); return; }
                void downloadWalletStatementPdf(
                  historyItems.map((it) => ({
                    type: it.type, method: it.method, amount: it.amount,
                    currency: it.currency, status: it.status, created_at: it.created_at,
                  })),
                  {
                    accountName: userFullName || undefined,
                    accountEmail: userEmail || undefined,
                    currency: wallet?.currency || 'USD',
                    totalDeposited: wallet?.total_deposited,
                    totalWithdrawn: wallet?.total_withdrawn,
                    currentBalance: wallet?.balance,
                  },
                );
              }}
            >
              Statement PDF
            </Button>
          }
        />
        {historyLoading ? (
          <div className="space-y-2 p-4" aria-busy="true">
            {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        ) : historyItems.length === 0 ? (
          <EmptyState compact icon={<HistoryIcon />} title="No transactions yet." />
        ) : (
          <Table dense>
            <THead>
              <TR>
                <TH>Type</TH>
                <TH>Method</TH>
                <TH align="right">Amount</TH>
                <TH align="right">Date</TH>
                <TH align="right">Status</TH>
              </TR>
            </THead>
            <TBody>
              {historyItems.slice(0, 25).map((it) => {
                const t = (it.type || '').toLowerCase();
                return (
                  <TR key={`${it.id}-${it.type}`}>
                    <TD className="font-medium capitalize">{t || 'transaction'}</TD>
                    <TD muted className="max-w-[16rem] truncate">{prettyMethod(it.method)}</TD>
                    <TD numeric>{formatCurrency(Number(it.amount) || 0, it.currency || wallet?.currency || 'USD')}</TD>
                    <TD numeric muted>{fmtHistoryDate(it.created_at)}</TD>
                    <TD align="right"><TxnStatusBadge status={it.status} /></TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader
          eyebrow="Good to know"
          title="Processing time"
          actions={
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-border-primary bg-bg-tertiary text-text-secondary">
              <Hourglass size={16} />
            </span>
          }
        />
        <p className="text-sm leading-relaxed text-text-secondary">
          Crypto withdrawals are reviewed by finance; most requests are processed within 24 hours.
        </p>
      </Card>
    </div>
  );

  const walletLabel = wallet?.wallet_account ? 'Wallet account' : 'Main wallet';
  const walletBalance = wallet?.wallet_account ? wallet.wallet_account.balance : wallet?.main_wallet_balance ?? 0;

  return (
    <DashboardShell>
      <div className="space-y-4 md:space-y-5">
        <PageHeader
          title="Funds"
          description="Deposits, withdrawals and transfers between your accounts."
          actions={
            <Button
              variant="ghost"
              iconOnly
              aria-label="Refresh wallet"
              onClick={() => void fetchData(true)}
              disabled={refreshing}
            >
              <RefreshCcw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </Button>
          }
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={walletLabel}
            value={fmt(walletBalance)}
            hint={wallet?.wallet_account?.account_number ? `Account ${wallet.wallet_account.account_number}` : currency}
            icon={<WalletIcon />}
          />
          <StatCard label="Total deposited" value={fmt(wallet?.total_deposited ?? 0)} icon={<ArrowDownToLine />} />
          <StatCard label="Total withdrawn" value={fmt(wallet?.total_withdrawn ?? 0)} icon={<ArrowUpFromLine />} />
          <StatCard
            label="Pending withdrawals"
            value={String(wallet?.pending_withdrawals ?? 0)}
            hint="awaiting approval"
            icon={<Hourglass />}
          />
        </div>

        {loadError && <Notice tone="warning">{loadError}</Notice>}

        {demoFundingBlocked && (
          <Notice tone="danger" title="Demo account — funding disabled">
            {DEMO_FUNDING_MSG}
          </Notice>
        )}

        {/* Scroll container lives outside Tabs so the active underline's
            1px overhang is not clipped on narrow screens. */}
        <div className="overflow-x-auto scrollbar-none">
          <Tabs
            variant="underline"
            aria-label="Funds"
            active={tab}
            onChange={(id) => setTab(id as FundsTab)}
            className="min-w-max"
            tabs={[
              { id: 'deposit', label: 'Deposit', icon: <ArrowDownToLine /> },
              { id: 'withdrawal', label: 'Withdrawal', icon: <ArrowUpFromLine /> },
              { id: 'transfer', label: 'Transfer Between Accounts', icon: <ArrowLeftRight /> },
              { id: 'history', label: 'Transaction History', icon: <HistoryIcon /> },
            ]}
          />
        </div>

        <div key={tab} className="animate-fade-in">
          {tab === 'deposit' && renderDepositTab()}
          {tab === 'withdrawal' && renderWithdrawalTab()}
          {tab === 'transfer' && renderTransferTab()}
          {tab === 'history' && renderHistoryTab()}
        </div>
      </div>
    </DashboardShell>
  );
}

// ---------------------------------------------------------------------------
// Local UI pieces — layout glue over the shared primitives. Kept in this file
// because they are specific to the Funds page.
// ---------------------------------------------------------------------------

interface AccountOption {
  id: string;
  label: string;
  sublabel?: string;
}

/** Native file input styled on the control tokens; the picker button is a
 *  small raised chip. */
const FILE_INPUT_CLASS =
  'py-1.5 file:mr-3 file:rounded-sm file:border-0 file:bg-bg-hover file:px-2.5 file:py-1 file:text-xs file:font-semibold file:text-text-primary';

/** Anchor that opens the admin's external payment link in a new tab; styled
 *  like a small secondary Button (the primitive renders a <button>). */
const LINK_BUTTON_CLASS =
  'inline-flex h-8 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-border-primary bg-bg-tertiary px-3 text-xs font-semibold text-text-primary transition-colors hover:border-border-strong hover:bg-bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45';

/** Account picker: native Select with the balance echoed under it. */
function AccountSelect({
  label,
  value,
  options,
  placeholder,
  onChange,
  disabled,
}: {
  label: string;
  value: string | null;
  options: ReadonlyArray<AccountOption>;
  placeholder: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}) {
  const selected = options.find((o) => o.id === value) ?? null;
  return (
    <Select
      label={label}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      hint={
        selected?.sublabel ? (
          <>
            Balance: <span className="font-mono tabular-nums text-text-secondary">{selected.sublabel}</span>
          </>
        ) : undefined
      }
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.sublabel ? `${o.label} — ${o.sublabel}` : o.label}
        </option>
      ))}
    </Select>
  );
}

/** Selectable payment-method tile. A Card with radio semantics so Enter /
 *  Space select it exactly like the buttons it replaces. */
function MethodCard({
  active,
  label,
  sub,
  badge,
  onSelect,
}: {
  active: boolean;
  label: string;
  sub?: string;
  badge?: ReactNode;
  onSelect: () => void;
}) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect();
    }
  };
  return (
    <Card
      interactive
      nested={!active}
      padding="sm"
      role="radio"
      aria-checked={active}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className={cn(
        'flex flex-col gap-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/45',
        active && 'border-accent hover:border-accent',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn('text-sm font-semibold', active ? 'text-text-primary' : 'text-text-secondary')}>{label}</span>
        {badge}
      </div>
      {sub && <span className="text-xs text-text-tertiary">{sub}</span>}
    </Card>
  );
}

/** Inline warning / danger notice under the header. */
function Notice({ tone, title, children }: { tone: 'warning' | 'danger'; title?: string; children: ReactNode }) {
  return (
    <div
      role="alert"
      className={cn(
        'rounded-md border px-3 py-2.5 text-xs leading-relaxed',
        tone === 'warning' ? 'border-warning/40 bg-warning/10 text-warning' : 'border-danger/40 bg-danger/10 text-danger',
      )}
    >
      {title && <p className="font-semibold">{title}</p>}
      <p className={cn(title && 'mt-1 text-text-primary')}>{children}</p>
    </div>
  );
}

/** Settled-status chip for the history table. */
function TxnStatusBadge({ status }: { status: string }) {
  const s = (status || '').toLowerCase();
  const variant =
    s === 'completed' || s === 'approved' || s === 'auto_approved' || s === 'paid'
      ? 'success'
      : s === 'pending'
        ? 'warning'
        : s === 'failed' || s === 'rejected' || s === 'cancelled'
          ? 'danger'
          : 'neutral';
  return (
    <Badge size="sm" dot variant={variant}>
      {s ? s.replace(/_/g, ' ') : 'unknown'}
    </Badge>
  );
}

interface Step {
  icon: ReactNode;
  title: string;
  description: string;
  state: 'current' | 'upcoming' | 'done';
}

/** Right-column "how it works" stepper. A vertical line connects the icon
 *  squares; current / done steps are filled with the accent. */
function StepsCard({ steps }: { steps: ReadonlyArray<Step> }) {
  return (
    <Card className="h-fit">
      <CardHeader eyebrow="How it works" className="mb-3" />
      <ol className="relative space-y-6">
        <span className="absolute bottom-8 left-[15px] top-8 w-px bg-border-primary" aria-hidden />
        {steps.map((s, i) => {
          const filled = s.state !== 'upcoming';
          return (
            <li key={i} className="relative flex items-start gap-3.5">
              <span
                className={cn(
                  'grid h-8 w-8 shrink-0 place-items-center rounded-md border',
                  filled ? 'border-accent bg-accent text-text-on-accent' : 'border-border-primary bg-card text-text-tertiary',
                )}
              >
                {s.icon}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className={cn('text-sm font-semibold', filled ? 'text-text-primary' : 'text-text-tertiary')}>{s.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-text-tertiary">{s.description}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

/** Page-shaped loading placeholder: header, four KPI tiles, tab row, form. */
function WalletSkeleton() {
  return (
    <div className="space-y-4 md:space-y-5" aria-busy="true" aria-label="Loading wallet">
      <div className="space-y-2">
        <Skeleton className="h-7 w-28" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <StatCard key={i} label={<Skeleton className="h-3 w-20" />} value="" loading />
        ))}
      </div>
      <Skeleton className="h-10 w-full max-w-lg" />
      <Card className="space-y-4">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-11 w-full" />
      </Card>
    </div>
  );
}

export default function WalletPage() {
  return (
    <Suspense
      fallback={
        <DashboardShell>
          <WalletSkeleton />
        </DashboardShell>
      }
    >
      <WalletPageContent />
    </Suspense>
  );
}
