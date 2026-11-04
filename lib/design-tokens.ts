/**
 * Design Token System for Ordex OMS
 *
 * This file provides a centralized system for managing design tokens
 * including colors, spacing, typography, border-radius, and shadows.
 *
 * Usage:
 * import { tokens, surface, text, interactive, focusRing } from '@/lib/design-tokens';
 */

// =============================================================================
// COLOR TOKENS
// =============================================================================

/**
 * Surface colors for backgrounds and containers.
 * Use semantic utility classes (defined in globals.css @layer utilities) so
 * Tailwind JIT always includes them regardless of where this file is imported.
 */
export const surface = {
  // Primary surfaces
  primary: 'bg-surface',
  secondary: 'bg-surface-muted',
  elevated: 'bg-surface',

  // Interactive surfaces
  hover: 'hover:bg-surface-muted',
  active: 'bg-primary-50',
  selected: 'bg-primary-50',

  // Semantic surfaces
  success: 'bg-[var(--color-success-50)]',
  warning: 'bg-[var(--color-warning-50)]',
  error: 'bg-[var(--color-danger-50)]',
  info: 'bg-[var(--color-primary-50)]',

  // Overlay
  overlay: 'bg-primary-900/50 backdrop-blur-sm',
} as const;

/**
 * Text colors for various content types.
 * Use semantic utility classes (text-fg, text-fg-muted, text-fg-subtle) defined
 * in globals.css so they're always present and token-linked.
 */
export const text = {
  // Primary text
  primary: 'text-fg',
  secondary: 'text-fg-muted',
  muted: 'text-fg-subtle',
  disabled: 'text-fg-subtle opacity-50',

  // Interactive text
  link: 'text-brand hover:text-brand-deep',

  // Semantic text
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-danger',
  info: 'text-info',

  // On colored backgrounds
  onPrimary: 'text-on-inverse',
  onSecondary: 'text-on-inverse',
  onSuccess: 'text-[var(--color-success-900)]',
  onWarning: 'text-[var(--color-warning-900)]',
  onError: 'text-[var(--color-danger-900)]',
  onInfo: 'text-[var(--color-primary-900)]',
} as const;

/**
 * Interactive element colors (buttons, inputs, etc.)
 */
export const interactive = {
  // Primary actions
  primary: 'bg-primary-500 hover:bg-primary-600 active:bg-primary-700',
  primaryText: 'text-brand hover:text-brand-deep',

  // Secondary actions
  secondary: 'bg-surface-muted hover:bg-surface-highlight',
  secondaryText: 'text-fg-muted hover:text-fg',

  // Destructive actions
  destructive: 'bg-danger-500 hover:bg-danger-600 active:bg-danger-700',
  destructiveText: 'text-danger hover:text-[var(--color-danger-700)]',

  // Ghost/subtle actions
  ghost: 'hover:bg-primary-50',
  ghostText: 'text-fg-muted hover:text-fg',
} as const;

/**
 * Border colors
 */
export const border = {
  default: 'border-subtle',
  strong: 'border-[var(--color-border-secondary)]',
  focus: 'border-[var(--color-border-focus)]',
  error: 'border-[var(--color-danger-500)]',
  success: 'border-[var(--color-success-500)]',
  dashed: 'border-dashed border-[var(--color-neutral-300)]',
  brutal: 'border-brutal',
} as const;

// =============================================================================
// FOCUS RING SYSTEM
// =============================================================================

/**
 * Focus ring styles for accessibility
 * Use these to ensure consistent, visible focus indicators across all interactive elements
 */
export const focusRing = {
  // Default focus ring
  default: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',

  // Inset focus ring (for elements where offset doesn't work well)
  inset: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500',

  // Subtle focus ring
  subtle: 'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-500/50',

  // Error state focus ring
  error: 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',

  // Within (for use with focus-within)
  within: 'focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-2',
} as const;

// =============================================================================
// SPACING TOKENS
// =============================================================================

/**
 * Standard spacing values using Tailwind's scale
 */
export const spacing = {
  // Component internal spacing
  xs: 'p-1',      // 4px
  sm: 'p-2',      // 8px
  md: 'p-3',      // 12px
  lg: 'p-4',      // 16px
  xl: 'p-6',      // 24px
  '2xl': 'p-8',   // 32px

  // Gap spacing
  gapXs: 'gap-1',
  gapSm: 'gap-2',
  gapMd: 'gap-3',
  gapLg: 'gap-4',
  gapXl: 'gap-6',
} as const;

// =============================================================================
// BORDER RADIUS TOKENS
// =============================================================================

/**
 * Standardized border radius values
 */
export const radius = {
  none: 'rounded-none',
  sm: 'rounded',        // 4px - small elements like badges
  md: 'rounded-lg',     // 8px - buttons, inputs
  lg: 'rounded-xl',     // 12px - cards, dropdowns
  xl: 'rounded-2xl',    // 16px - modals, large cards
  full: 'rounded-full', // circular - avatars, badges
  brutal: 'rounded-brutal',
} as const;

// =============================================================================
// SHADOW TOKENS
// =============================================================================

/**
 * Shadow elevation levels
 */
export const shadow = {
  none: 'shadow-none',
  sm: 'shadow-sm',
  md: 'shadow-md',
  lg: 'shadow-lg',
  xl: 'shadow-xl',
  '2xl': 'shadow-2xl',
  inner: 'shadow-inner',
  brutal: 'shadow-brutal',
  brutalSm: 'shadow-brutal-sm',
  brutalLg: 'shadow-brutal-lg',
} as const;

// =============================================================================
// Z-INDEX TOKENS
// =============================================================================

/**
 * Z-index layering scale for overlays and map UI
 */
export const zIndex = {
  map: 'z-0',
  markers: 'z-10',
  topBar: 'z-50',
  fab: 'z-[60]',
  bottomSheet: 'z-[70]',
  drawerOverlay: 'z-[90]',
  drawer: 'z-[100]',
} as const;

// =============================================================================
// TYPOGRAPHY TOKENS
// =============================================================================

/**
 * Typography styles for headings and body text
 */
export const typography = {
  // Headings
  h1: 'text-3xl font-bold tracking-tight',
  h2: 'text-2xl font-semibold tracking-tight',
  h3: 'text-xl font-semibold',
  h4: 'text-lg font-medium',

  // Body text
  bodyLg: 'text-base',
  body: 'text-sm',
  bodySm: 'text-xs',

  // Labels
  label: 'text-sm font-medium',
  labelSm: 'text-xs font-medium',

  // Section headers
  sectionHeader: 'text-xs font-semibold uppercase tracking-wider',

  // Truncation
  truncate: 'truncate',
  lineClamp2: 'line-clamp-2',
  lineClamp3: 'line-clamp-3',
} as const;

// =============================================================================
// TRANSITION TOKENS
// =============================================================================

/**
 * Standard transition values
 */
export const transition = {
  fast: 'transition-all duration-150 ease-in-out',
  default: 'transition-all duration-200 ease-in-out',
  slow: 'transition-all duration-300 ease-in-out',
  colors: 'transition-colors duration-200 ease-in-out',
  transform: 'transition-transform duration-200 ease-in-out',

  // Reduced motion support
  motionSafe: 'motion-safe:transition-all motion-safe:duration-200',
  motionReduce: 'motion-reduce:transition-none',
} as const;

// =============================================================================
// LAYOUT TOKENS
// =============================================================================

/**
 * Common layout patterns
 */
export const layout = {
  // Flex patterns
  flexCenter: 'flex items-center justify-center',
  flexBetween: 'flex items-center justify-between',
  flexStart: 'flex items-center justify-start',
  flexCol: 'flex flex-col',
  flexColCenter: 'flex flex-col items-center justify-center',

  // Grid patterns
  gridCols2: 'grid grid-cols-2 gap-4',
  gridCols3: 'grid grid-cols-3 gap-4',
  gridCols4: 'grid grid-cols-4 gap-4',

  // Container widths
  containerSm: 'max-w-sm mx-auto',
  containerMd: 'max-w-md mx-auto',
  containerLg: 'max-w-lg mx-auto',
  containerXl: 'max-w-xl mx-auto',
  container2xl: 'max-w-2xl mx-auto',
} as const;

// =============================================================================
// RTL SUPPORT - CSS LOGICAL PROPERTIES
// =============================================================================

/**
 * RTL-aware spacing using logical properties
 * These work correctly in both LTR and RTL layouts
 */
export const rtl = {
  // Padding
  paddingStart: 'ps-4',  // padding-inline-start
  paddingEnd: 'pe-4',    // padding-inline-end

  // Margin
  marginStart: 'ms-4',   // margin-inline-start
  marginEnd: 'me-4',     // margin-inline-end

  // Borders
  borderStart: 'border-s', // border-inline-start
  borderEnd: 'border-e',   // border-inline-end

  // Positioning
  start: 'start-0',      // inset-inline-start
  end: 'end-0',          // inset-inline-end

  // Text alignment
  textStart: 'text-start',
  textEnd: 'text-end',
} as const;

// =============================================================================
// COMPONENT PATTERNS
// =============================================================================

/**
 * Pre-composed component styles for common patterns
 */
export const components = {
  // Card styles
  card: `${surface.primary} ${radius.lg} ${shadow.md} ${border.default} border`,
  cardHover: `${surface.primary} ${radius.lg} ${shadow.md} ${border.default} border ${transition.default} hover:${shadow.lg}`,

  // Button base
  buttonBase: `${layout.flexCenter} ${radius.md} ${typography.label} ${transition.colors} ${focusRing.default}`,

  // Input base
  inputBase: `${radius.md} ${border.default} border ${surface.primary} ${text.primary} ${focusRing.default} ${transition.colors}`,

  // Badge
  badge: `inline-flex items-center ${radius.full} px-2.5 py-0.5 ${typography.bodySm} font-medium`,

  // Avatar
  avatar: `${radius.full} ${layout.flexCenter} font-semibold`,

  // Menu item
  menuItem: `${layout.flexStart} ${spacing.sm} ${radius.md} ${typography.body} ${transition.colors} ${focusRing.default}`,

  // Brutalist patterns
  brutalCard: 'border-brutal shadow-brutal bg-white rounded-brutal',
  brutalButton: 'btn-brutal',
  brutalButtonPrimary: 'btn-brutal-primary',
} as const;

// =============================================================================
// MOBILE OPTIMIZATION TOKENS
// =============================================================================

/**
 * Mobile-optimized touch targets and interactions
 * Following WCAG 2.1 AAA guidelines (44x44px minimum)
 */
export const mobile = {
  // Touch targets
  touchTarget: {
    sm: 'min-h-[44px] min-w-[44px]',
    md: 'min-h-[48px] min-w-[48px]',
    lg: 'min-h-[56px] min-w-[56px]',
  },

  // Safe area spacing (for devices with notches/rounded corners)
  safeArea: {
    top: 'pt-safe',
    bottom: 'pb-safe',
    left: 'pl-safe',
    right: 'pr-safe',
  },

  // Mobile-friendly spacing
  spacing: {
    compact: 'p-3',  // 12px - compact mobile spacing
    comfortable: 'p-4', // 16px - comfortable mobile spacing
    spacious: 'p-6',  // 24px - spacious mobile spacing
  },

  // Touch-optimized interactions
  interaction: {
    tapHighlight: 'active:bg-neutral-100',
    touchAction: 'touch-manipulation',
    userSelect: 'select-none',
  },

  // Mobile z-index layers
  zIndex: {
    bottomNav: 'z-50',
    fab: 'z-40',
    modal: 'z-50',
    toast: 'z-60',
    dropdown: 'z-30',
  },

  // Responsive text sizes
  text: {
    xs: 'text-xs sm:text-sm',
    sm: 'text-sm sm:text-base',
    base: 'text-base sm:text-lg',
    lg: 'text-lg sm:text-xl',
    xl: 'text-xl sm:text-2xl',
  },
} as const;

// =============================================================================
// STATUS COLORS
// =============================================================================

/**
 * Order status colors matching the OMS status machine
 */
export const statusColors = {
  TO_DO: {
    bg: 'bg-[var(--color-status-to-do)]/10',
    text: 'text-[var(--color-status-to-do)]',
    border: 'border-[var(--color-status-to-do)]/20',
  },
  CALL_BACK: {
    bg: 'bg-[var(--color-status-call-back)]/10',
    text: 'text-[var(--color-status-call-back)]',
    border: 'border-[var(--color-status-call-back)]/20',
  },
  CANCELLED: {
    bg: 'bg-[var(--color-status-cancelled)]/10',
    text: 'text-[var(--color-status-cancelled)]',
    border: 'border-[var(--color-status-cancelled)]/20',
  },
  PO_CREATED: {
    bg: 'bg-[var(--color-status-po-created)]/10',
    text: 'text-[var(--color-status-po-created)]',
    border: 'border-[var(--color-status-po-created)]/20',
  },
  AWAITING_STOCK: {
    bg: 'bg-[var(--color-status-awaiting-stock)]/10',
    text: 'text-[var(--color-status-awaiting-stock)]',
    border: 'border-[var(--color-status-awaiting-stock)]/20',
  },
  PARTIALLY_SUPPLIED: {
    bg: 'bg-[var(--color-status-partially-supplied)]/10',
    text: 'text-[var(--color-status-partially-supplied)]',
    border: 'border-[var(--color-status-partially-supplied)]/20',
  },
  INSTALL_SCHEDULING: {
    bg: 'bg-[var(--color-status-install-scheduling)]/10',
    text: 'text-[var(--color-status-install-scheduling)]',
    border: 'border-[var(--color-status-install-scheduling)]/20',
  },
  AWAITING_INSTALL: {
    bg: 'bg-[var(--color-status-awaiting-install)]/10',
    text: 'text-[var(--color-status-awaiting-install)]',
    border: 'border-[var(--color-status-awaiting-install)]/20',
  },
  SUPPLIED: {
    bg: 'bg-[var(--color-status-supplied)]/10',
    text: 'text-[var(--color-status-supplied)]',
    border: 'border-[var(--color-status-supplied)]/20',
  },
} as const;

// =============================================================================
// EXPORTS
// =============================================================================

/**
 * Combined tokens object for convenience
 */
export const tokens = {
  surface,
  text,
  interactive,
  border,
  focusRing,
  spacing,
  radius,
  shadow,
  typography,
  transition,
  layout,
  rtl,
  mobile,
  components,
  statusColors,
} as const;

export default tokens;
