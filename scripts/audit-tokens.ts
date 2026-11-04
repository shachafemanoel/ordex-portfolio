#!/usr/bin/env ts-node
/**
 * Audits the codebase for hardcoded hex color values in TSX/TS/CSS files.
 * Run: npx ts-node scripts/audit-tokens.ts
 * Use in CI to detect regressions.
 */
import { execSync } from 'child_process';

const ALLOWED_HEX = new Set([
  '#128c7e', // WhatsApp brand — intentional, mapped via --color-whatsapp
  '#000000',
  '#ffffff',
]);

const result = execSync(
  `grep -rn --include="*.tsx" --include="*.ts" --include="*.css" ` +
    `'#[0-9a-fA-F]\\{3,8\\}' src/ components/ app/ shared/ styles/ ` +
    `--exclude-dir=node_modules`,
  { encoding: 'utf-8' }
)
  .split('\n')
  .filter(Boolean);

const violations = result.filter((line) => {
  const hexMatch = line.match(/#([0-9a-fA-F]{3,8})/g);
  if (!hexMatch) return false;
  return hexMatch.some((hex) => !ALLOWED_HEX.has(hex.toLowerCase()));
});

if (violations.length > 0) {
  console.error(`\n❌ Found ${violations.length} hardcoded hex values:\n`);
  violations.forEach((v) => console.error(v));
  console.error('\nReplace with CSS variable tokens. See shared/styles/theme.css\n');
  process.exit(1);
} else {
  console.log('✅ No hardcoded hex values found.');
}
