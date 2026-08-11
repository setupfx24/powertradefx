'use client';

/**
 * Minimal landing i18n — successor to the old src/landing dict.
 * Same storage key + language set as before so returning visitors keep
 * their choice. Scope: landing chrome + home page only; the app itself
 * is English (unchanged).
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Lang = 'en' | 'fr' | 'ja' | 'zh';
const STORAGE_KEY = 'powertradefx-lang';

export const LANGS: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
];

type Dict = Record<string, Record<Lang, string>>;

const D: Dict = {
  // ── Nav ──────────────────────────────────────────────────────────
  'nav.markets':   { en: 'Markets',   fr: 'Marchés',        ja: 'マーケット',       zh: '市场' },
  'nav.features':  { en: 'Platform',  fr: 'Plateforme',     ja: 'プラットフォーム', zh: '平台' },
  'nav.contact':   { en: 'Contact',   fr: 'Contact',        ja: 'お問い合わせ',     zh: '联系我们' },
  'nav.signin':    { en: 'Sign in',   fr: 'Connexion',      ja: 'ログイン',         zh: '登录' },
  'nav.open':      { en: 'Open account', fr: 'Ouvrir un compte', ja: '口座開設',    zh: '开设账户' },
  // ── Hero ─────────────────────────────────────────────────────────
  'hero.eyebrow':  { en: 'Precision trading', fr: 'Trading de précision', ja: '精密なトレーディング', zh: '精准交易' },
  'hero.title1':   { en: 'Trade the world.', fr: 'Tradez le monde.', ja: '世界を取引する。', zh: '交易全球市场。' },
  'hero.title2':   { en: 'Own the moment.',  fr: 'Saisissez l’instant.', ja: 'その瞬間を掴む。', zh: '把握每个时机。' },
  'hero.sub': {
    en: 'FX, metals, indices and crypto on one institutional-grade platform. Live pricing, transparent costs, execution in milliseconds.',
    fr: 'Devises, métaux, indices et crypto sur une plateforme de niveau institutionnel. Prix en direct, coûts transparents, exécution en millisecondes.',
    ja: 'FX・貴金属・株価指数・暗号資産を、機関投資家レベルの一つのプラットフォームで。リアルタイム価格、透明なコスト、ミリ秒の約定。',
    zh: '外汇、贵金属、指数与加密资产，尽在一个机构级平台。实时报价，成本透明，毫秒级执行。',
  },
  'hero.cta':      { en: 'Start trading', fr: 'Commencer à trader', ja: '取引を始める', zh: '开始交易' },
  'hero.demo':     { en: 'Try free demo', fr: 'Essayer la démo', ja: '無料デモを試す', zh: '试用模拟账户' },
  'hero.stat1':    { en: 'Execution speed', fr: 'Vitesse d’exécution', ja: '約定速度', zh: '执行速度' },
  'hero.stat2':    { en: 'Leverage up to',  fr: 'Levier jusqu’à',      ja: '最大レバレッジ', zh: '杠杆高达' },
  'hero.stat3':    { en: 'Asset classes',   fr: 'Classes d’actifs',    ja: '資産クラス', zh: '资产类别' },
  'hero.stat4':    { en: 'Market access',   fr: 'Accès au marché',     ja: 'マーケットアクセス', zh: '市场准入' },
  // ── Features ─────────────────────────────────────────────────────
  'feat.eyebrow':  { en: 'Why PowerTradeFX', fr: 'Pourquoi PowerTradeFX', ja: 'PowerTradeFXが選ばれる理由', zh: '为何选择 PowerTradeFX' },
  'feat.title':    { en: 'Built like a terminal. Priced like a partner.', fr: 'Conçu comme un terminal. Tarifé comme un partenaire.', ja: 'ターミナルの性能、パートナーの価格。', zh: '终端级性能，伙伴式定价。' },
  'feat.1.t':      { en: 'Millisecond execution', fr: 'Exécution en millisecondes', ja: 'ミリ秒の約定', zh: '毫秒级执行' },
  'feat.1.d': {
    en: 'Orders fill against live top-of-book pricing with no dealing desk delay.',
    fr: 'Les ordres sont exécutés sur des prix en direct, sans délai de dealing desk.',
    ja: 'ディーリングデスクの遅延なく、ライブ価格で即時に約定します。',
    zh: '订单按实时最优价格成交，无交易台延迟。',
  },
  'feat.2.t':      { en: 'Transparent costs', fr: 'Coûts transparents', ja: '透明なコスト', zh: '透明的成本' },
  'feat.2.d': {
    en: 'Spreads and commissions shown before you trade — never buried after.',
    fr: 'Spreads et commissions affichés avant de trader — jamais cachés après.',
    ja: 'スプレッドと手数料は取引前に表示。後から隠れたコストはありません。',
    zh: '点差与佣金在交易前清晰展示，绝无事后隐藏费用。',
  },
  'feat.3.t':      { en: 'Copy trading & PAMM', fr: 'Copy trading & PAMM', ja: 'コピートレード & PAMM', zh: '跟单交易与 PAMM' },
  'feat.3.d': {
    en: 'Mirror proven strategy providers or run pooled funds with full attribution.',
    fr: 'Copiez des fournisseurs de stratégies éprouvés ou gérez des fonds communs.',
    ja: '実績あるストラテジープロバイダーを複製、またはプール型ファンドを運用。',
    zh: '跟随经过验证的策略提供者，或运作全程可追溯的集合基金。',
  },
  'feat.4.t':      { en: 'Algo API', fr: 'API Algo', ja: 'アルゴAPI', zh: '算法 API' },
  'feat.4.d': {
    en: 'Wire any bot or EA to your account over REST and WebSocket in minutes.',
    fr: 'Connectez n’importe quel bot ou EA à votre compte via REST et WebSocket.',
    ja: 'RESTとWebSocketで、あらゆるボット・EAを数分で接続できます。',
    zh: '通过 REST 与 WebSocket，几分钟内接入任何交易机器人或 EA。',
  },
  'feat.5.t':      { en: 'Bank-grade security', fr: 'Sécurité de niveau bancaire', ja: '銀行品質のセキュリティ', zh: '银行级安全' },
  'feat.5.d': {
    en: 'Segregated ledgers, 2FA, hardware-wallet deposits and full audit trails.',
    fr: 'Comptes séparés, 2FA, dépôts par portefeuille matériel et pistes d’audit complètes.',
    ja: '分別管理、二要素認証、ハードウェアウォレット入金、完全な監査証跡。',
    zh: '独立账本、双重验证、硬件钱包入金与完整审计记录。',
  },
  'feat.6.t':      { en: 'TradingView charts', fr: 'Graphiques TradingView', ja: 'TradingViewチャート', zh: 'TradingView 图表' },
  'feat.6.d': {
    en: 'Full charting suite with drag-to-set stops and on-chart position control.',
    fr: 'Suite graphique complète avec stops glissables et contrôle des positions sur le graphique.',
    ja: 'ドラッグでSL/TPを設定できる、フル機能のチャートスイート。',
    zh: '完整图表套件，拖拽设置止损止盈，图上直接管理仓位。',
  },
  // ── Markets ──────────────────────────────────────────────────────
  'mkt.eyebrow':   { en: 'Live markets', fr: 'Marchés en direct', ja: 'ライブマーケット', zh: '实时市场' },
  'mkt.title':     { en: 'Real prices. Right now.', fr: 'Des prix réels. Maintenant.', ja: '本物の価格を、今すぐ。', zh: '真实价格，即刻呈现。' },
  'mkt.symbol':    { en: 'Instrument', fr: 'Instrument', ja: '銘柄', zh: '产品' },
  'mkt.bid':       { en: 'Bid', fr: 'Achat', ja: '売値', zh: '买价' },
  'mkt.ask':       { en: 'Ask', fr: 'Vente', ja: '買値', zh: '卖价' },
  'mkt.spread':    { en: 'Spread', fr: 'Spread', ja: 'スプレッド', zh: '点差' },
  'mkt.trade':     { en: 'Trade', fr: 'Trader', ja: '取引', zh: '交易' },
  // ── Steps ────────────────────────────────────────────────────────
  'steps.title':   { en: 'Live in three steps', fr: 'Opérationnel en trois étapes', ja: '3ステップで取引開始', zh: '三步开启交易' },
  'steps.1.t':     { en: 'Create account', fr: 'Créez un compte', ja: '口座を作成', zh: '创建账户' },
  'steps.1.d':     { en: 'Email + verification code. Under two minutes.', fr: 'E-mail + code de vérification. Moins de deux minutes.', ja: 'メールと認証コードのみ。2分以内で完了。', zh: '邮箱加验证码，两分钟内完成。' },
  'steps.2.t':     { en: 'Fund it', fr: 'Alimentez-le', ja: '入金する', zh: '入金' },
  'steps.2.d':     { en: 'Cards, bank transfer or on-chain USDT.', fr: 'Carte, virement ou USDT on-chain.', ja: 'カード、銀行振込、オンチェーンUSDT。', zh: '银行卡、银行转账或链上 USDT。' },
  'steps.3.t':     { en: 'Trade', fr: 'Tradez', ja: '取引する', zh: '交易' },
  'steps.3.d':     { en: 'Web terminal, mobile, or your own algo.', fr: 'Terminal web, mobile ou votre propre algo.', ja: 'Webターミナル、モバイル、独自アルゴで。', zh: '网页终端、移动端或您自己的算法。' },
  // ── Clarix showcase ──────────────────────────────────────────────
  'cx.eyebrow': { en: 'Inside the engine', fr: 'Au cœur du moteur', ja: 'エンジンの内側', zh: '引擎内部' },
  'cx.t1': { en: 'Execution you can watch', fr: 'Une exécution visible', ja: '見える約定', zh: '看得见的执行' },
  'cx.d1': {
    en: 'Orders route straight to the book — no dealing desk, no re-quotes. What you see moving is what fills you.',
    fr: 'Les ordres vont droit au carnet — pas de dealing desk, pas de re-cotations. Ce qui bouge est ce qui vous exécute.',
    ja: '注文はブックに直行。ディーリングデスクもリクオートもなし。動いているものが、そのまま約定します。',
    zh: '订单直达订单簿——没有交易台，没有重新报价。你看到的行情，就是你的成交。',
  },
  'cx.t2': { en: 'Risk that never sleeps', fr: 'Un risque sous contrôle continu', ja: '眠らないリスク管理', zh: '永不休眠的风控' },
  'cx.d2': {
    en: 'Margin is recalculated every second against live prices, with warnings long before the stop-out line.',
    fr: 'La marge est recalculée chaque seconde sur les prix réels, avec des alertes bien avant le stop-out.',
    ja: '証拠金はライブ価格で毎秒再計算。ストップアウトのはるか手前で警告します。',
    zh: '保证金按实时价格每秒重算，在强平线之前提前预警。',
  },
  'cx.t3': { en: 'One mark. Every market.', fr: 'Une marque. Tous les marchés.', ja: 'ひとつのマークで、すべての市場へ。', zh: '一个标识，纵横所有市场。' },
  'cx.d3': {
    en: 'FX, metals, indices and crypto behind a single account, a single terminal, a single standard.',
    fr: 'Devises, métaux, indices et crypto derrière un seul compte, un seul terminal, un seul standard.',
    ja: 'FX・貴金属・指数・暗号資産を、ひとつの口座、ひとつのターミナル、ひとつの基準で。',
    zh: '外汇、贵金属、指数与加密资产，同一账户、同一终端、同一标准。',
  },
  // ── CTA / footer ─────────────────────────────────────────────────
  'cta.title':     { en: 'Markets don’t wait.', fr: 'Les marchés n’attendent pas.', ja: 'マーケットは待ってくれない。', zh: '市场不会等待。' },
  'cta.sub':       { en: 'Open a live account or practice risk-free with $10,000 demo funds.', fr: 'Ouvrez un compte réel ou entraînez-vous sans risque avec 10 000 $ virtuels.', ja: 'ライブ口座を開設、または1万ドルのデモ資金でリスクなしの練習を。', zh: '开设真实账户，或用 $10,000 模拟资金零风险练习。' },
  'foot.tagline': {
    en: 'Institutional-grade multi-asset trading for people who take it seriously.',
    fr: 'Trading multi-actifs de niveau institutionnel, pour ceux qui le prennent au sérieux.',
    ja: '本気のトレーダーのための、機関投資家レベルのマルチアセット取引。',
    zh: '为认真交易者打造的机构级多资产交易。',
  },
  'foot.legal':    { en: 'Legal', fr: 'Juridique', ja: '法的情報', zh: '法律信息' },
  'foot.privacy':  { en: 'Privacy Policy', fr: 'Confidentialité', ja: 'プライバシーポリシー', zh: '隐私政策' },
  'foot.terms':    { en: 'Terms of Service', fr: 'Conditions d’utilisation', ja: '利用規約', zh: '服务条款' },
  'foot.risk':     { en: 'Risk Disclosure', fr: 'Avertissement sur les risques', ja: 'リスク開示', zh: '风险披露' },
  'foot.policy':   { en: 'Policies', fr: 'Politiques', ja: '各種ポリシー', zh: '政策' },
  'foot.deletion': { en: 'Account Deletion', fr: 'Suppression de compte', ja: 'アカウント削除', zh: '账户注销' },
  'foot.riskwarn': {
    en: 'Trading leveraged products carries a high level of risk and may not be suitable for all investors. You could lose more than your initial deposit. Past performance is not indicative of future results. PowerTradeFX does not provide investment advice.',
    fr: 'Le trading de produits à effet de levier comporte un risque élevé et peut ne pas convenir à tous les investisseurs. Vous pouvez perdre plus que votre dépôt initial. Les performances passées ne préjugent pas des résultats futurs. PowerTradeFX ne fournit pas de conseil en investissement.',
    ja: 'レバレッジ商品の取引は高いリスクを伴い、すべての投資家に適するとは限りません。当初の入金額を超える損失が生じる可能性があります。過去の実績は将来の結果を保証するものではありません。PowerTradeFXは投資助言を行いません。',
    zh: '杠杆产品交易具有高风险，未必适合所有投资者。您的损失可能超过初始入金。过往表现并不代表未来结果。PowerTradeFX 不提供投资建议。',
  },
};

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: string) => string }>({
  lang: 'en', setLang: () => {}, t: (k) => k,
});

export function LandingLangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (saved && LANGS.some((l) => l.code === saved)) setLangState(saved);
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
    document.documentElement.lang = l;
  };
  const t = (k: string) => D[k]?.[lang] ?? D[k]?.en ?? k;
  return <Ctx.Provider value={{ lang, setLang, t }}>{children}</Ctx.Provider>;
}

export const useLandingLang = () => useContext(Ctx);
