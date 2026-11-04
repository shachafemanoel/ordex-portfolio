# Ordex Design System: Master

## 1. Core Identity

- **Vibe**: Professional, Clean, "App-like", SaaS, Trustworthy.
- **Primary Color**: Deep Blue/Purple (Indigo/Violet mix) for a modern tech feel.
- **Surface**: Clean White (#FFFFFF) with subtle gray backgrounds (#F8FAFC) for depth.

## 2. Color Palette (Tailwind)

### Primary

- `primary`: `blue-600` (#2563EB) -> Actionable elements.
- `primary-foreground`: `white` (#FFFFFF).
- `secondary`: `slate-100` (#F1F5F9).

### Semantic

- `success`: `emerald-600` (Completed, Paid, In Stock).
- `warning`: `amber-500` (Pending, Low Stock).
- `danger`: `rose-600` (Overdue, Error, Cancelled).
- `info`: `sky-500` (Processing, In Transit).

### Neutrals

- `background`: `slate-50` (App Background).
- `surface`: `white` (Cards, Sidebar).
- `border`: `slate-200`.
- `text-main`: `slate-900`.
- `text-muted`: `slate-500`.

## 3. Typography

- **Font Family**: Inter (or system-ui backup).
- **Headings**: `font-extrabold tracking-tight` (e.g., `text-3xl`).
- **Body**: `text-sm` for density, `text-base` for readability.
- **Labels**: `text-xs font-semibold uppercase tracking-wider text-muted-foreground`.

## 4. Component Patterns

### A. The "Smart Card" (Central Info Element)

- **Container**: `bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200`.
- **Header**: Flex row with Icon (p-2 bg-primary/10 text-primary rounded-lg) + Title.
- **Content**: Large number/metric centered or grid of key data.
- **Footer**: Action link or status indicator.

### B. Module Header ("App Header")

- **Layout**: Flex column.
- **Top**: Page Title (H1) + User Actions.
- **Bottom**: Scrollable Pills (`QuickNav`) for distinct modes (e.g., "Calendar View", "List View").

### C. Floating Action Bar

- Sticky bottom or top-right container for primary actions ("New Order", "Export").

## 5. Layout Structure

- **Global**: Sidebar (Fixed Left) + Main Content (Fluid Right).
- **Page**: `max-w-[1920px] mx-auto p-6 md:p-8 space-y-8`.
- **Grid System**: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6`.

## 6. Anti-Patterns (Do NOT Use)

- ❌ **Double Navigation**: Do not link to the same page from Sidebar AND a secondary Sub-menu unless context differs.
- ❌ **Generic "Dashboard"**: Avoid a single dashboard for everyone. Use dedicated "Index Screens" per role.
- ❌ **Inconsistent Spacing**: Stick to `gap-4`, `gap-6`, `gap-8`.
- ❌ **Drab Gray**: Don't use `gray-400` for everything. Use semantic colors for status.
