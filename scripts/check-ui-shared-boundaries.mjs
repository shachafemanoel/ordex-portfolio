import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const MAX_PAGE_LINES = 150;

const pageBudgetFiles = [
  'app/(ops)/orders/calendar/page.tsx',
  'app/(platform)/search/page.tsx',
  'app/(admin)/profile/page.tsx',
  'app/login/page.tsx',
  'app/(platform)/customers/[id]/page.tsx',
  'app/(ops)/orders/new/page.tsx',
  'app/page.tsx',
];

const styleCheckFiles = [
  ...pageBudgetFiles,
  'components/search/SearchPageContainer.tsx',
  'components/profile/UserProfilePageContainer.tsx',
  'components/auth/login/LoginPageContainer.tsx',
  'components/customers/CustomerDetailsView.tsx',
  'components/orders/calendar/WorkCalendarPageContainer.tsx',
  'components/stitch/StitchShell.tsx',
  'components/layout/PageHeader.tsx',
  'components/layout/Section.tsx',
  'components/layout/templates/DashboardPage.tsx',
  'components/layout/ListPageTemplate.tsx',
  'components/layout/DetailsPageTemplate.tsx',
  'components/marketing/LandingHeader.tsx',
  'components/marketing/LandingHero.tsx',
  'components/marketing/LandingFeatures.tsx',
  'app/(admin)/settings/announcements/page.tsx',
  'app/(admin)/settings/help/page.tsx',
  'app/(admin)/settings/labels/page.tsx',
  'app/(admin)/settings/templates/page.tsx',
  'components/shared/ModuleLayout.tsx',
  'components/ui/Button.tsx',
  'components/ui/Input.tsx',
  'components/ui/Checkbox.tsx',
  'components/ui/card.tsx',
  'components/ui/Badge.tsx',
  'components/ui/StatusBadge.tsx',
  'components/ui/StatusChip.tsx',
  'components/ui/StatusDisplay.tsx',
  'components/ui/Table.tsx',
  'components/ui/dialog.tsx',
  'components/ui/dropdown-menu.tsx',
  'components/ui/popover.tsx',
  'components/shared/display/EntityPrimitives.tsx',
  'components/shared/display/displayStatus.ts',
];

const bannedPatterns = [
  { label: 'raw hex color', regex: /#[0-9a-fA-F]{3,6}\b/g },
  { label: 'bg-white utility', regex: /\bbg-white\b/g },
  { label: 'text-black utility', regex: /\btext-black\b/g },
  { label: 'border-black utility', regex: /\bborder-black\b/g },
  { label: 'rounded-none utility', regex: /\brounded-none\b/g },
  { label: 'direct dark slate bg', regex: /\bdark:bg-slate-[\w/-]+\b/g },
  { label: 'direct dark text class', regex: /\bdark:text-[\w/-]+\b/g },
  { label: 'direct dark border class', regex: /\bdark:border-[\w/-]+\b/g },
];

const failures = [];

for (const relativePath of pageBudgetFiles) {
  const absolutePath = path.join(repoRoot, relativePath);
  const content = fs.readFileSync(absolutePath, 'utf8');
  const lineCount = content.split('\n').length;

  if (lineCount > MAX_PAGE_LINES) {
    failures.push(`${relativePath}: page budget exceeded (${lineCount} lines > ${MAX_PAGE_LINES})`);
  }
}

for (const relativePath of styleCheckFiles) {
  const absolutePath = path.join(repoRoot, relativePath);
  const content = fs.readFileSync(absolutePath, 'utf8');

  for (const pattern of bannedPatterns) {
    const match = content.match(pattern.regex);
    if (match?.length) {
      failures.push(`${relativePath}: found banned ${pattern.label}`);
    }
  }
}

if (failures.length > 0) {
  console.error('UI shared-boundary check failed:\n');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('UI shared-boundary check passed.');
