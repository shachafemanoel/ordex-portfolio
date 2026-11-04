# OrdeX Design System

**PR / UI change checklist:** [DESIGN_SYSTEM_CHECKLIST.md](./DESIGN_SYSTEM_CHECKLIST.md)

## 1) Token Architecture

OrdeX uses a 3-layer design-token architecture:

1. **`shared/styles/theme.css` (source of truth)**  
   Canonical CSS variables for color, tone, gradients, spacing, radius, shadows, and typography.
2. **`tailwind.config.ts` (mapping layer)**  
   Tailwind color keys point to CSS variables (for example `primary.600 -> var(--color-primary-600)`).
3. **Components (consumption layer)**  
   Components should consume Tailwind semantic classes (`text-primary-600`) or explicit variables (`text-[var(--tone-info-text)]`), and avoid raw hex values.

### Light mode only

- The product UI is **always light**: `prefers-color-scheme: dark` and `html.dark` token overrides are **disabled** in `theme.css`; `html { color-scheme: light only; }` is set in `globals.css`.
- Do **not** add Tailwind `dark:` variants for layout chrome; they are misleading.
- `ThemeProvider` no longer applies a `dark` class or reads saved dark preference.

### Canonical components (avoid duplicates)

Import from **one** place per pattern:

| Pattern | Use | Do not duplicate |
|--------|-----|------------------|
| Empty / zero data | `EmptyState` from `@/components/ui/EmptyState` (`lucideIcon` + `action.variant`) | ~~`dashboard/ui/EmptyState`~~, ~~`shared/EmptyState`~~ (removed) |
| Dashboard home KPI tiles | `KpiCard` from `@/components/dashboard/widgets/KpiCard` | ~~`dashboard/ui/KpiCard`~~, ~~`ops/shared/KpiCard`~~ (removed — use widget-specific cards in ops if needed) |
| Actionable feed (home) | `ActionsFeed` / `ActionFeedCard` from `@/components/shared/ActionFeed` | ~~`dashboard/ActionFeed`~~ (removed — unused) |
| Status in tables/lists | Prefer `StatusDisplay` from `@/components/ui` over legacy `StatusBadge` / `StatusChip` | — |

When adding a new “card shell”, prefer `EntitySurface` + tokens, or extend an existing pattern instead of copying markup.

### Display templates (`components/ui/display-templates.tsx`)

Use these for consistent typography and semantic chips:

| Component | Use for |
|-----------|---------|
| `DisplayName` | Person / entity titles |
| `DisplayDateTime` | Dates and times (tabular numbers) |
| `DisplayItemLine` | Primary + secondary line (e.g. product row) |
| `DisplayCaption` | Helper / meta text |
| `DisplaySemanticBadge` | Status / label chips (`tone` prop: `neutral`, `info`, `success`, `warning`, `danger`, `accent`) |

### Page routes: semantic utility classes (`styles/globals.css`)

**Rules**

- Do **not** use raw Tailwind palette utilities on **app route pages** and their primary screen components (`text-slate-*`, `bg-white`, `border-gray-*`, `text-red-500`, arbitrary `#hex`, etc.). Use the utilities below; they are backed by `shared/styles/theme.css` variables.
- Tailwind’s `text-primary` maps to the **brand blue**, not body text. For copy hierarchy on light surfaces use **`text-fg`**, **`text-fg-muted`**, **`text-fg-subtle`**.
- Layout utilities (`flex`, `grid`, `gap`, `p-*`, breakpoints) remain Tailwind as usual.

**Core tokens** (`theme.css`)

| Variable | Role |
|----------|------|
| `--color-surface` | Main panel background (`var(--color-bg-primary)`) |
| `--color-surface-muted` | Page / section wash (`var(--color-bg-secondary)`) |
| `--color-border` | Default border (`var(--color-border-primary)`) — hairline neutrals; prefer `divide-*` between stacked blocks over boxing every row |
| `--color-focus` | Focus outline (`var(--color-border-focus)`) |
| `--color-success` / `--color-warning` / `--color-danger` / `--color-info` | Status colors |

**Semantic classes** (see `@layer utilities` in `globals.css` for the full set)

- Surfaces: `bg-surface`, `bg-surface-muted`, `bg-surface-highlight`, `bg-surface-translucent`, `border-subtle`, `border-surface-soft`, `border-surface-strong`
- Text: `text-fg`, `text-fg-muted`, `text-fg-subtle`, `text-brand`, `text-brand-deep`, `text-success`, `text-warning`, `text-danger`, `text-info`, `text-accent`, `text-on-inverse`, `text-whatsapp`
- Brand: `bg-brand-gradient`, `bg-brand-gradient-br`, `bg-brand-solid`, `bg-chart-bar`, `bg-nav-cta`
- Dividers / tracks: `border-divider-light`, `bg-progress-track`, `divider-gradient-y`
- Dashboard activity tones: `activity-tone-critical`, `activity-tone-warning`, `activity-tone-info`
- Ops: `surface-ops-glass`, `surface-deliveries-aside`, `text-ops-muted`, `text-ops-icon-muted`, `ring-brand-soft`

**Before / after**

```tsx
// Before (avoid on pages)
<p className="text-sm text-gray-600">…</p>
<div className="border border-slate-200 bg-white">…</div>

// After
<p className="text-sm text-fg-muted">…</p>
<div className="border border-subtle bg-surface">…</div>
```

### Foreground must follow background (accessibility)

Use **paired tokens** so text stays readable in light and dark theme:

| Role | CSS variables | Tailwind (when mapped) | When to use |
|------|---------------|------------------------|-------------|
| Text on **light** surfaces (white, gray-50, `--card-bg`, gradients from `--gradient-brand-subtle`) | `--on-bright`, `--on-bright-muted`, `--on-bright-subtle` | `text-on-bright`, `text-on-bright-muted`, `text-on-bright-subtle` | Default body, labels, secondary lines on cards and app chrome |
| Text on **dark** surfaces (`--color-bg-inverse`, primary-600 CTAs, slate-900 bars) | `--on-dark`, `--on-dark-muted`, `--on-dark-subtle` | `text-on-dark`, `text-on-dark-muted`, `text-on-dark-subtle` | Toolbars, inverse headers, filled primary buttons |
| **Pre-composed surfaces** | — | `surface-bright`, `surface-muted`, `surface-dark`, `surface-primary`, `surface-primary-soft` | Prefer wrapping a block with one class instead of mixing arbitrary `bg-*` + `text-slate-*` |

**Rules**

1. On **`--tone-*-bg`** surfaces, use the matching **`--tone-*-text`** (see §3). `EntityBadge` / `EntityField` / `EntityNotice` already do this.
2. On **`EntitySurface`** and nested **`EntityField`**, inherited color uses **`--on-bright`** so children stay correct when `html` is `.dark`.
3. Do **not** pair `text-slate-900` with dark backgrounds or `text-white` with light gray-only backgrounds without checking contrast; prefer the table above.
4. **`--ordex-text-main` / `--ordex-text-muted`** (in `globals.css`) track `--color-text-primary` / secondary and follow theme — use with `text-ordex-text-main` on `bg-ordex-bg` shells.

## 2) Color Palette

### Primary
- `--color-primary-50`: `#eef6ff`
- `--color-primary-100`: `#dfeeff`
- `--color-primary-200`: `#b8d8ff`
- `--color-primary-500`: `#0085ff`
- `--color-primary-600`: `#0065c2` (main action)
- `--color-primary-700`: `#004d97` (hover)
- `--color-primary-900`: `#001f3f`

### Accent
- `--color-accent-500`: `#ec5b13`
- `--color-accent-600`: `#d45f00`

### Semantic
- `--color-success`: `#059669`
- `--color-warning`: `#d97706`
- `--color-danger`: `#dc2626`
- `--color-info`: `var(--color-primary-600)`
- `--color-whatsapp`: `#128c7e`

### Neutrals
Use existing neutral scale in `theme.css`:
- `--color-neutral-50` through `--color-neutral-900`

### App backgrounds & inverse
- `--color-bg-primary`, `--color-bg-secondary`, `--color-bg-tertiary` — page / section layers  
- `--color-bg-inverse` — dark strip / inverse shell (`bg-surface-inverse`, `surface-dark`)  
- `--entity-surface-border` — borders for nested panels (tracks light/dark)

## 3) Entity Tone System

### Tones
- **info**: process information, neutral positive guidance
- **success**: successful completion / healthy state
- **warning**: attention required / action needed
- **accent**: highlighted secondary context

### Tone tokens
- `--tone-info-bg`, `--tone-info-text`, `--tone-info-border`
- `--tone-success-bg`, `--tone-success-text`, `--tone-success-border`
- `--tone-warning-bg`, `--tone-warning-text`, `--tone-warning-border`
- `--tone-accent-bg`, `--tone-accent-text`, `--tone-accent-border`

### Example
```tsx
<EntityBadge tone="warning" label="דורש טיפול" />
```

## 4) Typography Scale

Operational UI scale (from globals):
- `--font-heading-lg`
- `--font-heading-md`
- `--font-body-strong`
- `--font-body`
- `--font-caption`
- `--font-label`

General token sizes also exist in `theme.css` (`--font-size-xs` ... `--font-size-5xl`).

## 5) Spacing System

Fluid spacing values are defined in:
- `shared/styles/ops-tokens.css`

Base spacing tokens are defined in:
- `shared/styles/theme.css` (`--spacing-*`)

Rules:
- Prefer tokenized spacing classes (`p-4`, `gap-3`, etc.) mapped via Tailwind.
- Do not modify fluid spacing values in `ops-tokens.css` unless doing a dedicated spacing-system migration.

## Core Component Notes (Top 10)

1. `EntityBadge` — semantic chips with tone tokens
2. `StatusChip` — order/purchase/install/payment status chip wrapper
3. `OrderCard` — expandable order summary/details container
4. `StackRow` — collapsed/expanded queue overflow row
5. `QuickActions` — call/WhatsApp/detail utility actions
6. `EntityField` — small labeled info blocks inside cards
7. `EntityNotice` — contextual notice panel by tone
8. `OrderWizardProgress` — step progress and progress bar
9. `DashboardOverviewHeader` — top overview hero
10. `OrderCardDetails` — secondary actions/details for an order

## 6) Contrast checklist (for new UI)

The app is **light-only**; avoid `dark:` variants on new chrome. Still pair foreground to background:

- [ ] Filled actions (`bg-primary-600`, `bg-nav-cta`, success/danger fills) use **`text-on-dark`** (or button component defaults).
- [ ] Light surfaces (`bg-surface`, `bg-surface-muted`, cards) use **`text-fg`** / **`text-fg-muted`** / **`text-fg-subtle`** — not raw `text-slate-*` on new code.
- [ ] Tinted status/tone rows use **`--tone-*-text`** on **`--tone-*-bg`**, not arbitrary grays.
