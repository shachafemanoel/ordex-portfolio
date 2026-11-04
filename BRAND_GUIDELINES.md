# Retzef (רצף) Brand Guidelines
> **Version:** 2.0 · October 2026 — brand kit v2 (`design-system/retzef-brand-v2/`)
> **For:** Developers, designers, AI agents working on the product UI/UX
> **Codebase:** Next.js · TypeScript · Tailwind CSS · RTL Hebrew-first

> ⚠️ The v2 kit is marked by its authors as a review version, not a release approval. No name/typeface rights check has been done yet.

---

## 1. Brand Identity

### Who is Retzef?

רצף is a **mobile-first order management system (OMS)** for small Israeli businesses. The name and symbol express an order's continuous, stepped progress from start to finish.

- **Primary message:** כל הזמנה. מהתחלה עד הסוף.
- **Supporting message:** ניהול לקוחות, הזמנות ותפעול במקום אחד.
- Do not promise "שליטה מלאה" or similar absolute claims.

### Brand Personality

| Trait | Expression |
|---|---|
| **Direct** | No jargon, no enterprise fluff. Say what you mean. |
| **Practical** | Every feature earns its place. Speed over aesthetics. |
| **Continuous** | One clear path between stages — no decoration replacing structure. |
| **Calm** | Light background, generous spacing, flat color — no gradients or 3D. |
| **Israeli-native** | RTL-first, Hebrew-first, local context always wins. |

### Brand Name

- **Hebrew (default UI):** `רצף`
- **Latin (English locale / technical contexts):** `Retzef`
- Internal identifiers (`ordex_*` storage keys, `.ordex-*` classes, `ordex.app` domain) are legacy and intentionally unchanged.

---

## 2. Logo

### Parts

1. **Symbol** — a single continuous stroke rising in two equal steps. Stroke width 40, centerline radius 32 (source units), round caps/joins. Blue `#2361E8` with the last segment clipped to orange `#FF743D`; the color split never splits the silhouette.
2. **Wordmark** — "רצף" as outlined, heavy rounded letterforms (variant B: longer ף descender). It is **not a live font** — never retype it.

**Sources:** `design-system/retzef-brand-v2/sources/` (geometry defined once in `build.py`; regenerate exports instead of editing derivatives).
**Served assets:** `public/brand/` — `logo.svg`, `logo-white.svg`, `logo-ink.svg`, `symbol.svg`, `symbol-white.svg`, `symbol-ink.svg`, `icon-blue.svg`.

### In code

Always render through `BrandLogo` (`@/components/ui/BrandLogo`):

```tsx
<BrandLogo />                                  // full logo, color, 28px high
<BrandLogo variant="symbol" height={18} />     // symbol only
<BrandLogo tone="white" />                     // on primary / dark surfaces
```

### Usage Rules

- **Light background:** color logo. **Blue / dark background:** `tone="white"`. **Single-color print or low contrast:** `tone="ink"`.
- **App icons:** 16px uses the single-color icon (`icon-blue-mono-16`); 24px and up use the color icon.
- **Do not:** rotate, stretch, recolor, add gradients, shadows or 3D effects, or re-typeset the wordmark.

---

## 3. Color System

### Color Architecture

Colors are defined in three layers:

```
theme.css          → CSS variables (Single Source of Truth)
tailwind.config.ts → Maps Tailwind classes to CSS variables
Components         → Use Tailwind classes only (no raw hex)
```

**Rule: Never write raw hex values in component files. Always use a CSS variable or Tailwind token.** Literal hex for APIs that can't read CSS variables (Mapbox) comes from `lib/designTokens.ts`.

### Brand Palette (kit v2)

| Role | Hex | Token |
|---|---|---|
| Blue — message & action | `#2361E8` | `--color-primary-600` |
| Orange — continuation (decorative) | `#FF743D` | `--color-accent-500` |
| Ink — text | `#142B36` | `--color-text-primary` |
| Paper — app background | `#F8FAFF` | `--color-bg-secondary` |
| Muted — secondary text | `#536773` | `--color-text-secondary` |
| Line | `#E3E9EF` | `--color-border-secondary` |

Measured contrast: white on blue **5.32:1**, ink on paper **14.08:1**, muted on paper **5.66:1**.

---

### Primary Blue — Action & Brand

```css
--color-primary-50:  #edf2ff   /* Backgrounds, very light tints */
--color-primary-100: #eaf0ff   /* Hover backgrounds */
--color-primary-200: #c1d3f9   /* Borders, subtle accents */
--color-primary-500: #3d74eb   /* Lighter brand blue */
--color-primary-600: #2361e8   /* ← MAIN ACTION COLOR */
--color-primary-700: #1d50be   /* Hover state */
--color-primary-900: #153780   /* Deep brand blue */
```

**Tailwind usage:**
```tsx
className="bg-primary-600 hover:bg-primary-700 text-white"
className="text-primary-600 border-primary-200"
className="bg-primary-50 text-primary-600"
```

---

### Accent Orange — Continuation

Orange is a **brand element, not a text color or a sole status signal** (2.69:1 on white, 1.98:1 on blue).

```css
--color-accent-50:  #fff4ef   /* Soft tint backgrounds */
--color-accent-500: #ff743d   /* Decorative only — symbol, bars, highlights */
--color-accent-600: #b2512b   /* Text-safe orange, 5.12:1 on white */
```

**Tailwind usage:**
```tsx
className="text-accent-600"            // text and icons
className="bg-accent-600 text-white"   // filled chips/tabs with text
className="bg-accent-500"              // decorative fills without text
```

---

### Semantic Status Colors

```css
--color-success:   #059669   /* Completed, active, positive */
--color-warning:   #d97706   /* Pending, attention needed */
--color-danger:    #dc2626   /* Urgent, error, destructive */
--color-info:      var(--color-primary-600)   /* Informational */
--color-whatsapp:  #128c7e   /* WhatsApp brand — do not change */
```

---

### Neutrals & Surfaces

```css
/* Backgrounds */
--color-bg-primary:   #ffffff   /* Cards / surfaces */
--color-bg-secondary: #f8faff   /* App canvas (Retzef paper) */
--color-bg-tertiary:  #edf1f6   /* Secondary surfaces */

/* Text */
--color-text-primary:   #142b36   /* Main text (Retzef ink) */
--color-text-secondary: #536773   /* Secondary / muted text */
--color-text-tertiary:  #9ca3af   /* Placeholder, hints — not for body text */
--color-text-inverse:   #ffffff   /* Text on dark/brand surfaces */

/* Borders */
--color-border-primary:   rgba(83, 103, 115, 0.14)   /* Hairline dividers */
--color-border-secondary: #e3e9ef                    /* Retzef line */
```

---

### Entity Tone System

Tones are used for badges, status chips, and notices. Each tone has a background/text/border triplet.

```css
/* Info (blue) */
--tone-info-bg:       var(--color-primary-50)    /* #edf2ff */
--tone-info-text:     var(--color-primary-600)   /* #2361e8 */
--tone-info-border:   var(--color-primary-200)   /* #c1d3f9 */

/* Success (green) */
--tone-success-bg:    #ecfdf5
--tone-success-text:  var(--color-success)       /* #059669 */
--tone-success-border:#a7f3d0

/* Warning (amber) */
--tone-warning-bg:    #fffbeb
--tone-warning-text:  var(--color-warning)       /* #d97706 */
--tone-warning-border:#fcd34d

/* Accent (orange) */
--tone-accent-bg:     var(--color-accent-50)
--tone-accent-text:   var(--color-accent-600)   /* text-safe orange */
```

**Usage in components:**
```tsx
tone === 'info'    → 'border-[var(--tone-info-border)]    bg-[var(--tone-info-bg)]    text-[var(--tone-info-text)]'
tone === 'success' → 'border-[var(--tone-success-border)] bg-[var(--tone-success-bg)] text-[var(--tone-success-text)]'
tone === 'warning' → 'border-[var(--tone-warning-border)] bg-[var(--tone-warning-bg)] text-[var(--tone-warning-text)]'
tone === 'accent'  → 'border-[var(--tone-accent-border)]  bg-[var(--tone-accent-bg)]  text-[var(--tone-accent-text)]'
```

---

### Urgency Color System (Order Cards)

Used exclusively for order urgency indicators on ops/queue views.

```css
--urgency-1-color: #dc2626   /* Critical — red    */
--urgency-2-color: #ea580c   /* High     — orange */
--urgency-3-color: #d97706   /* Medium   — amber  */
--urgency-4-color: var(--color-primary-600)   /* Normal   — brand blue */
--urgency-5-color: #16a34a   /* Done     — green  */
```

---

### Dark Mode

Not supported. The product is light-only (`color-scheme: light only`); do not add `dark:` variants.

---

## 4. Typography

### Font Stack

```css
--font-sans:    'Public Sans', 'Heebo', Inter, system-ui, sans-serif   /* Primary — Hebrew-optimized */
--font-heading: 'Public Sans', 'Heebo', sans-serif                     /* Headings */
--font-display: 'Manrope', 'Heebo', sans-serif                         /* Dashboard / display contexts */
--font-mono:    'Fira Code', ui-monospace, SFMono-Regular, monospace   /* Code only */
```

**Hebrew support:** `Heebo` is the designated fallback for all Hebrew text. All UI must render correctly in RTL with Heebo.

---

### Type Scale

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `heading-lg` | 20px | 800 | 1.2 | -0.02em | Page titles, hero text |
| `heading-md` | 16px | 700 | 1.3 | -0.01em | Section headings, card titles |
| `body-strong` | 14px | 600 | 1.4 | 0 | Emphasized body, labels with context |
| `body` | 13px | 400 | 1.5 | 0 | Default body text |
| `caption` | 11px | 500 | 1.4 | 0 | Metadata, secondary info |
| `label` | 10px | 700 | 1.0 | 0.05em | ALLCAPS labels, status indicators |

**Fluid responsive overrides (apply automatically via CSS clamp):**
```css
heading-lg: clamp(20px, 5vw, 24px)
heading-md: clamp(16px, 4vw, 18px)
body-strong: clamp(15px, 3.5vw, 17px)
body:        clamp(14px, 3.2vw, 16px)
caption:     clamp(12px, 2.5vw, 13px)
label:       clamp(10px, 2.2vw, 11px)
```

---

### Typography Rules

- **Headings:** Use `font-heading` family, weights 700–800, tight letter-spacing (-0.01 to -0.02em)
- **Body text:** Use `font-sans`, weight 400–500, normal letter-spacing
- **Numbers/metrics:** Use `font-display` (Manrope) for dashboard KPI values — tighter, more geometric
- **Hebrew and English:** Both fonts coexist. Never use a font that doesn't include Hebrew glyphs as the primary font
- **All-caps labels:** Use `label` token only — do not manually uppercase `body` text

---

## 5. Shape & Geometry

### Border Radius

Retzef uses a **soft, modern rounding** style. Sharp corners are never used for interactive elements.

```css
--radius-sm:   8px    /* Small chips, tight UI elements */
--radius-md:   12px   /* Default — inputs, small cards */
--radius-lg:   16px   /* Buttons, medium cards */
--radius-xl:   20px   /* Large cards, modals */
--radius-2xl:  28px   /* Featured cards, hero elements */
--radius-full: 9999px /* Avatars, pills, toggle switches */
```

**Component mapping:**

| Component | Radius |
|---|---|
| Buttons | `rounded-xl` (20px) |
| Input fields | `rounded-xl` (20px) |
| Cards / panels | `rounded-xl` (20px) |
| Chips / badges | `rounded-lg` (16px) |
| Bottom sheets | `rounded-t-2xl` (28px top corners) |
| Avatars | `rounded-full` |
| Tooltips | `rounded-lg` (16px) |

---

### Spacing System

The base unit is **4px**. All spacing should be multiples of this base.

```css
1 unit  =  4px   (--spacing-1)
2 units =  8px   (--spacing-2)   ← base gap
3 units = 12px   (--spacing-3)
4 units = 16px   (--spacing-4)   ← standard padding
6 units = 24px   (--spacing-6)
8 units = 32px   (--spacing-8)
```

**Card internal padding:** `var(--pad-card)` → `clamp(1rem, 4vw, 1.5rem)`
**Section gutter:** `var(--app-shell-gutter)` → `clamp(10px, 2vw, 24px)`

---

## 6. Elevation & Shadows

Shadows should feel **light and precise** — never heavy or dramatic. The goal is separation, not drama.

```css
/* Default card */
--shadow-sm: 0 1px 3px 0 rgba(0,0,0,0.1), 0 1px 2px -1px rgba(0,0,0,0.1)

/* Elevated panel / hover state */
--shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)

/* Modal / floating element */
--shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)

/* Bottom sheet / drawer */
--shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)
```

**Colored shadow (brand buttons):**
```tsx
/* Primary CTA */
className="shadow-lg shadow-primary/30"

/* Success state */
className="shadow-lg shadow-green-500/30"

/* Danger state */
className="shadow-lg shadow-red-500/30"
```

**Rule:** Cards at rest use `shadow-sm` or no shadow (border only). Cards on hover transition to `shadow-lg` with `duration-300`.

---

## 7. Motion & Animation

### Timing Principles

All animations should feel **snappy, not sluggish**. Retzef is a task-management tool — interactions must be fast and responsive.

```css
--transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1)   /* Micro-interactions */
--transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1)   /* Default */
--transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1)   /* Entrances, sheet */
```

### Standard Transitions

```tsx
/* All interactive elements */
className="transition-all duration-200"

/* Press/tap feedback */
className="active:scale-[0.96] transition-transform duration-150"

/* Card hover elevation */
className="hover:shadow-lg transition-all duration-300"

/* Fade entrance */
className="animate-fade-in"   /* opacity 0→1, translateY 10px→0, 0.3s ease-out */
```

### Named Animations (Brand-Specific)

| Animation | Use case | Duration |
|---|---|---|
| `animate-fade-in` | Element entrance | 0.3s |
| `animate-fade-in-up` | Panel/modal entrance | 0.35s |
| `animate-slide-in-right` | Side panel, notifications | 0.3s |
| `animate-slide-in-bottom` | Bottom sheet | 0.4s |
| `animate-scale-in` | Dropdown, popover | 0.2s |
| `animate-card-success` | Order status advance (✓) | 1.2s |
| `animate-card-error` | Validation error shake | 0.5s |
| `animate-urgency-pulse` | Order requires action | 2.5s infinite |
| `animate-critical-ring` | Highest priority order | 1.8s infinite |
| `animate-status-glow` | Normal active status | 2.0s infinite |
| `animate-metric-flash` | KPI value update | 0.6s |
| `animate-dot-ping` | Live/realtime indicator | 1.5s infinite |

**Rule:** Never use urgency/pulse animations decoratively. They are functional signals for business-critical states only.

---

## 8. Components

### Buttons

```tsx
/* Primary CTA */
className="bg-primary-600 hover:bg-primary-700 text-white font-semibold
           px-4 py-2 rounded-xl shadow-lg shadow-primary/30
           transition-all duration-200 active:scale-[0.96]"

/* Secondary / ghost */
className="bg-transparent border border-primary-200 text-primary-600
           hover:bg-primary-50 font-medium px-4 py-2 rounded-xl
           transition-all duration-200 active:scale-[0.96]"

/* Destructive */
className="bg-danger hover:brightness-110 text-white font-semibold
           px-4 py-2 rounded-xl shadow-lg shadow-red-500/30
           transition-all duration-200 active:scale-[0.96]"

/* Neutral / slate */
className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium
           px-4 py-2 rounded-xl transition-all duration-200"
```

**Touch target minimum:** `min-h-[44px]` always. On touch devices: `min-h-[48px]`.

---

### Cards

```tsx
/* Standard card */
className="bg-white border border-[var(--card-border)] rounded-xl
           shadow-sm hover:shadow-lg transition-all duration-300 p-4"

/* Highlighted / active card */
className="bg-white border border-primary-200 rounded-xl
           shadow-sm ring-1 ring-primary-200 p-4"

/* Tone card (info) */
className="bg-[var(--tone-info-bg)] border border-[var(--tone-info-border)]
           rounded-xl p-4"
```

---

### Form Inputs

```tsx
className="w-full rounded-xl border border-slate-200
           bg-white px-4 py-3 text-sm
           focus:outline-none focus:ring-2 focus:ring-primary-600 focus:border-transparent
           placeholder:text-slate-400 transition-all duration-200"
```

---

### Status Chips / Badges

Always use the Entity Tone system. Do not create custom one-off colors for badge states.

```tsx
/* Pattern */
<span className="inline-flex items-center gap-1 px-2 py-1
                 rounded-full text-xs font-semibold border
                 border-[var(--tone-info-border)]
                 bg-[var(--tone-info-bg)]
                 text-[var(--tone-info-text)]">
  Label
</span>
```

---

## 9. Layout & Responsive Design

### Breakpoints

```css
xs:  475px   /* Small mobile */
sm:  640px   /* Mobile landscape */
md:  768px   /* Tablet */
lg:  1024px  /* Desktop */
xl:  1280px  /* Wide desktop */
2xl: 1536px  /* Ultra-wide */
```

### Mobile-First Philosophy

Retzef is **mobile-first operationally, desktop-first for management views**.

- **Mobile (/ops routes):** Single column, bottom sheets, large touch targets, minimal chrome
- **Desktop (/dashboard routes):** Multi-column grid, data-dense, keyboard-accessible

```
Mobile default: single column, full-width cards
Tablet (md+): 2-column grids for KPI cards
Desktop (xl+): 4-column KPI grid, side-by-side panels
```

### RTL Implementation

Retzef is **RTL-first**. All layouts must work correctly in right-to-left direction.

```tsx
/* Root layout */
<html dir="rtl" lang="he">

/* Use logical properties */
className="ms-auto"     // not ml-auto
className="ps-4"        // not pl-4
className="border-s"    // not border-l
className="rounded-se"  // not rounded-tr
```

**Rule:** Never use `left`/`right` CSS properties or Tailwind `l-`/`r-` utilities for layout positioning. Use `start`/`end` logical equivalents.

---

## 10. Gradients

The Retzef brand uses **flat color — no gradients**. The legacy tokens remain for existing consumers but resolve to flat values:

```css
--gradient-brand:        flat var(--color-primary-600)
--gradient-brand-subtle: #ffffff → #f8faff (near-flat surface tint)
--gradient-page-bg:      var(--color-bg-secondary)
```

**Do not** introduce new gradients in components.

---

## 11. Iconography

- **Icon library:** Lucide React (primary), supplemented by custom SVGs for brand-specific icons
- **Default size:** `icon-md` (24px)
- **Size tokens:** `icon-xs` (16px) · `icon-sm` (20px) · `icon-md` (24px) · `icon-lg` (32px) · `icon-xl` (40px)
- **Stroke style:** 1.5px stroke, round linecap — consistent with logo mark
- **Color:** Inherit from text color token, or use semantic color (e.g., `text-primary-600`, `text-danger`)

```tsx
import { ArrowUp, Package, Phone } from 'lucide-react'

<ArrowUp className="w-icon-md h-icon-md text-primary-600" />
<Package className="w-5 h-5 text-slate-500" />
```

---

## 12. Accessibility

### WCAG 2.1 AA Requirements

- **Color contrast:** All text/background pairs must meet 4.5:1 (normal text) or 3:1 (large text)
- **Touch targets:** Minimum 44×44px on all interactive elements (`min-h-[44px] min-w-[44px]`)
- **Focus visible:** All focusable elements must have `focus-visible:ring-2 focus-visible:ring-primary-600`
- **ARIA labels:** All icon-only buttons must have `aria-label` in Hebrew

### Contrast Pairing Rules

| Background | Required text token |
|---|---|
| `bg-white`, `bg-primary-50`, tone pastel backgrounds | `text-[var(--on-bright)]` or `text-slate-900` |
| `bg-primary-600`, `bg-slate-900`, dark gradients | `text-white` or `text-[var(--on-dark)]` |
| `bg-primary-700` (hover) | `text-white` always |
| Tone backgrounds (`--tone-*-bg`) | Only use matching `--tone-*-text` |

**Rule:** Never place `text-slate-900` on a `bg-primary-600` surface. Never place `text-white` on `bg-primary-50`.

---

## 13. Writing Style (Copy Guidelines)

### Voice

- **Direct:** "הוסף הזמנה" not "לחץ כאן כדי להוסיף הזמנה חדשה"
- **Action-first:** Start labels with a verb. "שמור", "בטל", "עדכן סטטוס"
- **No enterprise jargon:** "לקוח" not "אנטיטי", "הזמנה" not "טרנזקציה"
- **Hebrew-first:** All UI copy is Hebrew by default. English is used only for technical terms or proper nouns

### UI Copy Patterns

```
Empty states:   "אין הזמנות פעילות עדיין"
Error states:   "לא ניתן לטעון, נסה שוב"
Loading:        "טוען..."
Success:        "עודכן בהצלחה ✓"
Confirmation:   "האם למחוק הזמנה זו? פעולה זו אינה ניתנת לביטול."
```

### Numbers & Dates

- **Currency:** `₪1,234` (shekel symbol before, comma separator)
- **Dates:** `DD/MM/YY` or relative ("לפני 3 שעות")
- **Times:** 24-hour format (`14:30`)

---

## 14. Anti-Patterns (What NOT to Do)

```
❌ Hardcoded hex values in components:    className="text-[#2361e8]"
✓  Use token:                             className="text-primary-600"

❌ Mix primary color definitions:         primary: '#0055FF' in tailwind.config.ts
✓  Map to CSS variable only:             primary: { DEFAULT: 'var(--color-primary-600)' }

❌ Use left/right for layout in RTL:      className="ml-4 border-l"
✓  Use logical properties:               className="ms-4 border-s"

❌ Urgency animations for decoration:    className="animate-urgency-pulse" on a button
✓  Urgency animations are functional:   Only on order cards with genuinely urgent status

❌ text-slate-900 on dark surface:       className="bg-primary-600 text-slate-900"
✓  Use inverse text:                    className="bg-primary-600 text-white"

❌ New gradient inline:                  className="bg-[linear-gradient(135deg,#2361e8,#1d50be)]"
✓  Use gradient token:                  className="bg-[var(--gradient-brand)]"

❌ Skip touch target minimum:            className="p-1 text-xs" on a button
✓  Always ensure:                       className="min-h-[44px] px-3 py-2"

❌ Create one-off badge colors:          className="text-[#7a4b2c] bg-[#ffeedd]"
✓  Use tone system:                     tone="warning" on EntityBadge

❌ English-only copy in Hebrew UI:       "Save Order"
✓  Hebrew-first:                        "שמור הזמנה"
```

---

## 15. File Reference

| Resource | Path |
|---|---|
| CSS Variables (canonical source) | `shared/styles/theme.css` |
| Tailwind token mapping | `tailwind.config.ts` |
| Fluid spacing & ops layout | `shared/styles/ops-tokens.css` |
| App shell & global overrides | `styles/globals.css` |
| Logo component | `components/ui/BrandLogo.tsx` |
| Logo SVGs | `public/brand/` |
| Brand kit sources | `design-system/retzef-brand-v2/` |
| Entity Tone system | `components/shared/EntityPrimitives.tsx` |
| Order status display utils | `lib/server/` or `shared/` display utils |
| Urgency color definitions | `styles/globals.css` (`--urgency-1-color` → `--urgency-5-color`) |
| Design System Implementation Plan | `DESIGN_SYSTEM_AGENT_PROMPT.md` |
