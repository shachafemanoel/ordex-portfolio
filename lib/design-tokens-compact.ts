import { cn } from '@/lib/utils';

// Compact spacing utilities
export const spacing = {
  // Page containers
  page: {
    padding: 'p-4 lg:p-6',
    margin: 'mb-4',
  },

  // Sections
  section: {
    padding: 'p-3',
    margin: 'mb-3',
    gap: 'gap-3',
  },

  // Components
  card: {
    padding: 'p-3',
    header: 'p-3',
    content: 'p-3 pt-0',
    footer: 'p-3 pt-0',
  },

  table: {
    header: 'h-9 px-3',
    cell: 'px-3 py-2',
  },

  form: {
    field: 'mb-3',
    group: 'gap-3',
  },
};

// Typography scale
export const typography = {
  h1: 'text-xl font-semibold leading-tight',
  h2: 'text-lg font-semibold leading-tight',
  h3: 'text-base font-semibold leading-tight',
  h4: 'text-sm font-semibold leading-tight',

  body: 'text-sm leading-relaxed',
  small: 'text-xs leading-normal',
  tiny: 'text-[10px] leading-tight',

  label: 'text-sm font-medium',
  caption: 'text-xs text-gray-500',
};

// Grid layouts
export const grids = {
  twoColumn: 'grid grid-cols-1 lg:grid-cols-2 gap-3',
  threeColumn: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3',
  fourColumn: 'grid grid-cols-2 md:grid-cols-4 gap-2',

  formTwoColumn: 'grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-3',
  kpiInline: 'grid grid-cols-2 sm:grid-cols-4 gap-2',
};

// Component variants
export const variants = {
  card: {
    default: 'rounded-lg border border-gray-200 bg-white shadow-sm',
    compact: 'rounded-lg border border-gray-200 bg-white p-2',
    flat: 'rounded-lg bg-gray-50 border border-gray-100',
  },

  button: {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-2.5 text-base',
  },

  input: {
    default: 'h-9 px-3 text-sm',
    sm: 'h-8 px-2 text-xs',
  },
};

// Focus ring (consistent across app)
export const focusRing = {
  default: 'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
  inset: 'focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500',
  none: 'focus:outline-none',
};

// Helper to build compact page header
export function compactPageHeader(title: string, subtitle?: string) {
  return cn('mb-4 pb-3 border-b border-gray-200', 'space-y-0.5');
}

// Helper to build compact section
export function compactSection() {
  return cn('bg-white rounded-lg border border-gray-200 p-3', 'space-y-2');
}
