#!/usr/bin/env node
/**
 * Design-token guard for the signed-in trader app.
 *
 * Fails when a component under src/ hard-codes a colour instead of using
 * the tokens in src/app/globals.css (via the Tailwind mapping or var()).
 * Flagged:
 *   - hex colours            #fff, #0b0e11, #ffffffcc
 *   - rgb()/rgba()/hsl()     inline colour functions
 *   - Tailwind palette       bg-green-500, text-gray-400, border-red-500/20 …
 *   - retired class families skeu-*, glass-*, rainbow-*
 *
 * Marketing surfaces (landing, portal, auth) and a few files that must
 * carry fixed colours (chart-library config, brand logos, PDF export)
 * are allow-listed below. Add to the list only with a reason.
 *
 * Usage: node scripts/check-design-tokens.mjs [--warn]
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = join(process.cwd(), 'src');
const WARN_ONLY = process.argv.includes('--warn');

/** Path prefixes (relative to src/, posix separators) that are exempt. */
const ALLOW_PREFIXES = [
  'app/(landing)/',            // marketing site, own design
  'app/(portal)/',             // marketing portal, CSS module
  'app/auth/',                 // auth pages use auth.css (separate pass)
  'app/s/',                    // public share card page
  'app/global-error.tsx',      // renders before CSS is guaranteed
  'app/layout.tsx',            // <meta theme-color> must be a literal
  'app/manifest.ts',           // PWA manifest colours must be literals
  'components/landing/',
  'components/portal/',
  'components/hero/',
  'components/demo/',
  'components/ui/liquid-metal-hero.tsx',
  'components/ui/dot-matrix-backdrop.tsx',
  'components/ui/full-screen-signup.tsx',
  'components/charts/TradingViewChart.tsx',       // library overrides need literal colours
  'components/charts/TradingViewNewsTimeline.tsx', // third-party embed params
  'components/charts/TradingViewEventsCalendar.tsx',
  'components/trading/SymbolIcon.tsx',            // instrument brand marks
  'components/trading/ShareTradeCard.tsx',        // rasterised to an image
  'lib/pdf/',
  'lib/brand.ts',
  'lib/chart/',
  'styles/',
];

const PALETTE =
  '(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)';
const RULES = [
  { name: 'hex colour', re: /#[0-9a-fA-F]{3,8}\b(?![\w-])/g },
  { name: 'colour function', re: /\b(?:rgba?|hsla?)\(/g },
  {
    name: 'tailwind palette class',
    re: new RegExp(
      `(?<![\\w-])(?:[a-z-]+:)*(?:bg|text|border|from|via|to|ring|shadow|fill|stroke|divide|outline|decoration|accent|caret|placeholder)-${PALETTE}-\\d{2,3}(?:/\\d{1,3})?\\b`,
      'g',
    ),
  },
  { name: 'retired class', re: /(?<![\w-])(?:skeu|glass|rainbow)-[a-z-]+/g },
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(name) && !/\.d\.ts$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

/** Drop comments so documented hexes ("brand is #FA5600") do not count. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:\\])\/\/[^\n]*/g, (m, p) => p + ' '.repeat(m.length - p.length));
}

const files = walk(ROOT);
const findings = [];
for (const file of files) {
  const rel = relative(ROOT, file).split(sep).join('/');
  if (ALLOW_PREFIXES.some((p) => rel === p || rel.startsWith(p))) continue;
  const lines = stripComments(readFileSync(file, 'utf8')).split('\n');
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(line))) {
        findings.push({ rel, line: i + 1, col: m.index + 1, rule: rule.name, match: m[0] });
      }
    }
  });
}

if (findings.length === 0) {
  console.log(`design tokens: OK (${files.length} files scanned)`);
  process.exit(0);
}

const byFile = new Map();
for (const f of findings) {
  if (!byFile.has(f.rel)) byFile.set(f.rel, []);
  byFile.get(f.rel).push(f);
}
for (const [rel, list] of [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n${rel}  (${list.length})`);
  for (const f of list.slice(0, 25)) console.log(`  ${f.line}:${f.col}  ${f.rule}: ${f.match}`);
  if (list.length > 25) console.log(`  … ${list.length - 25} more`);
}
console.log(`\ndesign tokens: ${findings.length} hard-coded colour(s) in ${byFile.size} file(s). Use the tokens in src/app/globals.css.`);
process.exit(WARN_ONLY ? 0 : 1);
