import { FlatCompat } from '@eslint/eslintrc'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const compat = new FlatCompat({ baseDirectory: __dirname })

/**
 * Flat ESLint config — replaces the absent `.eslintrc*`. Uses the
 * FlatCompat shim because `eslint-config-next` 15.x still ships in
 * legacy format. Drop the shim once Next exports a native flat config.
 *
 * Started minimal (just next's core-web-vitals + typescript rules)
 * to keep CI green; ratchet up over time by adding plugin-react-hooks
 * and jsx-a11y to the spread below.
 */
export default [
  {
    /* .d.ts type-declaration files (e.g. types/datafeed-api.d.ts) carry
     * disable directives for plugins we don't load (jsdoc, etc.). Ignore
     * them at the lint layer — TS already validates declarations. */
    ignores: ['.next/**', 'node_modules/**', 'out/**', '**/*.d.ts', 'public/**'],
  },
  ...compat.config({
    extends: ['next/core-web-vitals', 'next/typescript'],
  }),
  /* jsx-a11y recommended preset. All rules registered as warnings (not
   * errors) so they surface in lint output without breaking CI on the
   * existing surface. Promote to 'error' once each rule's findings are
   * driven to zero per-file. */
  {
    plugins: { 'jsx-a11y': jsxA11y },
    rules: Object.fromEntries(
      Object.entries(jsxA11y.configs.recommended.rules).map(([k, v]) => [
        k,
        typeof v === 'string' ? 'warn' : Array.isArray(v) ? ['warn', ...v.slice(1)] : 'warn',
      ]),
    ),
  },
  {
    /* Downgrade strict rules to warnings until Batch G (TS hardening)
     * cleans up the existing `any` types and unused vars. Keeps CI
     * green while still surfacing the debt in lint output. */
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      /* Pre-existing JSX entity escaping (e.g. apostrophes in copy). Cosmetic
       * — downgrade to warn until copy editor sweep. */
      'react/no-unescaped-entities': 'warn',
      /* Legacy `module = ...` assignment somewhere in the vendored charting
       * code; not worth a refactor. */
      '@next/next/no-assign-module-variable': 'warn',
    },
  },
]
