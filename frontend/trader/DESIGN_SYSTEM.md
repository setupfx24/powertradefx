# PowerTradeFX trader app — design system

One theme file, one set of primitives, no colour literals in components.

## Where things live

| Concern | File |
|---|---|
| Colour, radius, shadow, font-stack tokens (dark default, light opt-in) | `src/app/globals.css` |
| Tailwind utilities mapped onto those tokens | `tailwind.config.ts` |
| UI primitives | `src/components/ui/*` (import from `@/components/ui`) |
| Dashboard shell (nav, account pill, footer) | `src/components/layout/DashboardShell.tsx` + the `dk-*` block in `globals.css` |
| Guard that fails the build on hard-coded colours | `scripts/check-design-tokens.mjs` (`npm run lint:tokens`) |

## Rules

1. **No colour literals in TSX.** No hex, `rgb()`, or Tailwind palette classes (`bg-green-500`, `text-gray-400`). Use the token utilities: `bg-card`, `bg-bg-tertiary`, `text-text-secondary`, `border-border-primary`, `text-accent`, `bg-buy/10`, `text-danger`. Need a new colour? Add a token in `globals.css` first.
2. **Green buy, red sell, everywhere.** `buy`/`sell` utilities and the `SideBadge`. `success`/`danger` share those hues. Never use blue for buy.
3. **One accent.** Brand orange (`accent`) is for the primary action and active state only. One primary button per view.
4. **Two radii.** Controls `rounded-md` (6px), surfaces `rounded-lg` (10px), sheets `rounded-sheet` (14px), pills `rounded-full`.
5. **Numerals are `font-mono tabular-nums`** (Space Grotesk in the dashboard, JetBrains Mono in the terminal). Use `numeric` on `Input` and `TD`.
6. **Use the primitives.** Raw `<button>` / `<input>` / `<table>` / hand-rolled cards only when a primitive truly cannot express it, and then still with token utilities.
7. **Depth is black.** Shadows are `shadow-sm|md|lg`. No coloured glows.
8. **Type scale.** Page title `text-xl md:text-2xl font-semibold`, card title `text-md font-semibold`, body `text-sm`, captions `text-xs text-text-tertiary`, eyebrows `text-xxs uppercase tracking-[0.12em]`.

## Primitives

```tsx
import { Button, Card, CardHeader, CardBody, Input, Select, Textarea, Field, Badge, SideBadge,
         Tabs, Segmented, PageHeader, StatCard, Table, THead, TBody, TR, TH, TD,
         EmptyState, Skeleton, Modal } from '@/components/ui';

<PageHeader title="Wallet" description="Deposits, withdrawals and transfers"
  actions={<Button variant="primary">Deposit</Button>} />

<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
  <StatCard label="Balance" value="$12,400.00" delta={2.4} icon={<Wallet />} />
</div>

<Card>
  <CardHeader title="Open positions" actions={<Button size="sm" variant="ghost">View all</Button>} />
  <Table dense>
    <THead><TR><TH>Symbol</TH><TH>Side</TH><TH align="right">Lots</TH><TH align="right">P/L</TH></TR></THead>
    <TBody>
      <TR><TD>EURUSD</TD><TD><SideBadge side="buy" /></TD><TD numeric>0.10</TD><TD numeric className="text-success">+12.40</TD></TR>
    </TBody>
  </Table>
</Card>

<Segmented value={tab} onChange={setTab} options={[{ value: 'market', label: 'Market' }, { value: 'pending', label: 'Limit / Stop' }]} />
<Segmented value={side} onChange={setSide} fullWidth options={[{ value: 'buy', label: 'Buy', tone: 'buy' }, { value: 'sell', label: 'Sell', tone: 'sell' }]} />
```

Button variants: `primary` (orange CTA), `secondary` (default), `outline`, `ghost`, `danger`, `buy`, `sell`, `link`. Sizes `xs|sm|md|lg`, `iconOnly`, `loading`, `leftIcon`/`rightIcon`.

Badge variants: `neutral|accent|success|danger|warning|info|buy|sell`, tones `soft|solid|outline`.

## Theme

Dark graphite is the default (`:root`). Light is opt-in via `data-theme="light"` on `<html>`, toggled from the shell; the store persists it. The trading terminal is always dark. Everything re-themes from `globals.css`; components never branch on theme.
