import type { Config } from 'tailwindcss';
// @ts-ignore - ESM module resolution
import plugin from 'tailwindcss/plugin.js';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './features/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './shared/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      /* ========================================
         FONT FAMILIES (Unified)
         ======================================== */
      fontFamily: {
        sans: ['"Public Sans"', 'Heebo', 'Inter', 'system-ui', 'sans-serif'], // Primary (Hebrew optimized fallback)
        mono: ['"Fira Code"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
        heading: ['"Public Sans"', 'Heebo', 'sans-serif'],
        /** Dashboard / display — matches Stitch “Kinetic Azure” (Manrope loaded in app/layout) */
        display: ['Manrope', 'Heebo', 'sans-serif'],
        // Legacy support
        hebrew: ['Heebo', 'sans-serif'],
        english: ['"Public Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },

      /* ========================================
         COLORS (Semantic Token Set)
         ======================================== */
      colors: {
        // Semantic Status Colors (Strict)
        status: {
          green: { DEFAULT: '#22c55e', bg: '#f0fdf4', text: '#14532d' }, 
          blue: { DEFAULT: '#3b82f6', bg: '#eff6ff', text: '#1e3a8a' }, 
          amber: { DEFAULT: '#f97316', bg: '#fff7ed', text: '#9a3412' }, 
          red: { DEFAULT: '#ef4444', bg: '#fef2f2', text: '#7f1d1d' }, 
          gray: { DEFAULT: '#94a3b8', bg: '#f1f5f9', text: '#334155' }, 
        },

        // OrdeX Brand - New Primary (Electric Blue)
        primary: {
          DEFAULT: 'var(--color-primary-600)',
          50: 'var(--color-primary-50)',
          100: 'var(--color-primary-100)',
          200: 'var(--color-primary-200)',
          500: 'var(--color-primary-500)',
          600: 'var(--color-primary-600)',
          700: 'var(--color-primary-700)',
          900: 'var(--color-primary-900)',
        },

        // OrdeX Brand - Accent Orange
        accent: {
          DEFAULT: 'var(--color-accent-500)',
          500: 'var(--color-accent-500)',
          600: 'var(--color-accent-600)',
        },

        // OrdeX Backgrounds
        background: {
          light: 'var(--color-bg-secondary)',
          dark: 'var(--color-bg-inverse)',
          DEFAULT: 'var(--color-bg-secondary)',
        },

        surface: {
          light: 'var(--color-bg-primary)',
          dark: 'var(--color-bg-inverse)',
          DEFAULT: 'var(--color-bg-primary)',
          /* Pair with text-on-bright / text-on-dark */
          bright: 'var(--color-bg-primary)',
          muted: 'var(--color-bg-secondary)',
          inverse: 'var(--color-bg-inverse)',
        },

        // OrdeX Text
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary: 'var(--color-text-tertiary)',
          inverse: 'var(--color-text-inverse)',
        },

        /* Contrast text — pair with matching surface utilities */
        on: {
          bright: 'var(--on-bright)',
          'bright-muted': 'var(--on-bright-muted)',
          'bright-subtle': 'var(--on-bright-subtle)',
          dark: 'var(--on-dark)',
          'dark-muted': 'var(--on-dark-muted)',
          'dark-subtle': 'var(--on-dark-subtle)',
        },

        /* Stitch / login shell palette (CSS vars in globals.css) */
        ordex: {
          bg: 'var(--ordex-bg)',
          'bg-soft': 'var(--ordex-bg-soft)',
          border: 'var(--ordex-border)',
          primary: {
            DEFAULT: 'var(--ordex-primary)',
            soft: 'var(--ordex-primary-soft)',
          },
          accent: 'var(--ordex-accent)',
          danger: 'var(--ordex-danger)',
          'text-main': 'var(--ordex-text-main)',
          'text-muted': 'var(--ordex-text-muted)',
        },

        // Legacy / Mapping
        gray: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
          950: '#020617',
        },

        // Legacy Status Colors (Mapped to new Semantic)
        success: {
          DEFAULT: '#22c55e',
          50: '#f0fdf4',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        warning: {
          DEFAULT: '#f97316',
          50: '#fff7ed',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
        },
        danger: {
          DEFAULT: '#ef4444',
          50: '#fef2f2',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
        },
        info: { DEFAULT: '#3b82f6', 50: '#eff6ff', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8' },

        // OrdeX Lane Colors (Mobile UI)
        lane: {
          blue: {
            DEFAULT: '#3b82f6',
            bg: '#eff6ff',
            border: '#bfdbfe',
            text: '#1e40af',
          },
          amber: {
            DEFAULT: '#f97316',
            bg: '#fff7ed',
            border: '#fed7aa',
            text: '#9a3412',
          },
          indigo: {
            DEFAULT: 'var(--color-primary-600)',
            bg: '#f0f4ff',
            border: '#b8c8ff',
            text: '#003bab',
          },
          green: {
            DEFAULT: '#22c55e',
            bg: '#f0fdf4',
            border: '#bbf7d0',
            text: '#14532d',
          },
          red: {
            DEFAULT: '#ef4444',
            bg: '#fef2f2',
            border: '#fecaca',
            text: '#b91c1c',
          },
          slate: {
            DEFAULT: '#64748b',
            bg: '#f8fafc',
            border: '#e2e8f0',
            text: '#475569',
          },
        },

        // Urgency semantic colors
        urgency: {
          critical: { DEFAULT: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
          high:     { DEFAULT: '#ea580c', bg: '#fff7ed', border: '#fed7aa' },
          medium:   { DEFAULT: '#d97706', bg: '#fffbeb', border: '#fde68a' },
          normal:   { DEFAULT: 'var(--color-primary-600)', bg: '#f0f4ff', border: '#b8c8ff' },
          done:     { DEFAULT: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
        },

        // Component Mappings
        'bg-primary': 'var(--color-bg-primary)',
        'bg-secondary': 'var(--color-bg-secondary)',
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'border-primary': 'var(--color-border-primary)',
        input: '#b8c8ff',
        ring: 'var(--color-primary-600)',
      },

      /* ========================================
         SPACING (mapped to CSS variables)
         ======================================== */
      spacing: {
        0: 'var(--spacing-0)',
        px: 'var(--spacing-px)',
        0.5: 'var(--spacing-0-5)',
        1: 'var(--spacing-1)',
        1.5: 'var(--spacing-1-5)',
        2: 'var(--spacing-2)',
        2.5: 'var(--spacing-2-5)',
        3: 'var(--spacing-3)',
        3.5: 'var(--spacing-3-5)',
        4: 'var(--spacing-4)',
        5: 'var(--spacing-5)',
        6: 'var(--spacing-6)',
        7: 'var(--spacing-7)',
        8: 'var(--spacing-8)',
        9: 'var(--spacing-9)',
        10: 'var(--spacing-10)',
        11: 'var(--spacing-11)',
        12: 'var(--spacing-12)',
        14: 'var(--spacing-14)',
        16: 'var(--spacing-16)',
        20: 'var(--spacing-20)',
        24: 'var(--spacing-24)',
        // Legacy aliases
        xs: 'var(--spacing-1)',
        sm: 'var(--spacing-2)',
        md: 'var(--spacing-3)',
        lg: 'var(--spacing-4)',
        xl: 'var(--spacing-5)',
        '2xl': 'var(--spacing-6)',
        '3xl': 'var(--spacing-8)',
        '4xl': 'var(--spacing-10)',
        '5xl': 'var(--spacing-12)',
      },

      /* ========================================
         BORDER RADIUS (mapped to CSS variables)
         ======================================== */
      borderRadius: {
        none: 'var(--radius-none)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        '2xl': 'var(--radius-2xl)',
        '3xl': 'var(--radius-3xl)',
        full: 'var(--radius-full)',
        DEFAULT: 'var(--radius-md)',
        // Fluid viewport-relative radii
        'fluid-sm': 'var(--radius-fluid-sm)',
        'fluid-md': 'var(--radius-fluid-md)',
        'fluid-lg': 'var(--radius-fluid-lg)',
        'fluid-xl': 'var(--radius-fluid-xl)',
      },

      /* ========================================
         SHADOWS (mapped to CSS variables)
         ======================================== */
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
        '2xl': 'var(--shadow-2xl)',
        inner: 'var(--shadow-inner)',
        DEFAULT: 'var(--shadow-sm)',
        // OrdeX Mobile shadows
        'ordex-sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'ordex-md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'ordex-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },

      /* ========================================
         FONT SIZES (mapped to CSS variables)
         ======================================== */
      fontSize: {
        xs: 'var(--font-size-xs)',
        sm: 'var(--font-size-sm)',
        base: 'var(--font-size-base)',
        lg: 'var(--font-size-lg)',
        xl: 'var(--font-size-xl)',
        '2xl': 'var(--font-size-2xl)',
        '3xl': 'var(--font-size-3xl)',
        '4xl': 'var(--font-size-4xl)',
        '5xl': 'var(--font-size-5xl)',
        // OrdeX Mobile typography
        'heading-lg': ['20px', { lineHeight: '1.2', letterSpacing: '-0.02em', fontWeight: '800' }],
        'heading-md': ['16px', { lineHeight: '1.3', letterSpacing: '-0.01em', fontWeight: '700' }],
        'body-strong': ['14px', { lineHeight: '1.4', fontWeight: '600' }],
        body: ['13px', { lineHeight: '1.5', fontWeight: '400' }],
        caption: ['11px', { lineHeight: '1.4', fontWeight: '500' }],
        label: ['10px', { lineHeight: '1', letterSpacing: '0.05em', fontWeight: '700' }],
      },

      /* ========================================
         SCREENS (breakpoints)
         ======================================== */
      screens: {
        xs: '475px',
      },

      /* ========================================
         ICON SIZES (CSS variable driven)
         ======================================== */
      width: {
        'icon-xs': 'var(--icon-xs)',
        'icon-sm': 'var(--icon-sm)',
        'icon-md': 'var(--icon-md)',
        'icon-lg': 'var(--icon-lg)',
        'icon-xl': 'var(--icon-xl)',
      },
      height: {
        'icon-xs': 'var(--icon-xs)',
        'icon-sm': 'var(--icon-sm)',
        'icon-md': 'var(--icon-md)',
        'icon-lg': 'var(--icon-lg)',
        'icon-xl': 'var(--icon-xl)',
      },

      /* ========================================
         FLUID GAP / SPACING TOKENS
         Expose CSS variables as Tailwind gap/p classes
         ======================================== */
      gap: {
        'responsive':    'var(--app-shell-gap)',
        'responsive-xs': 'var(--gap-xs)',
        'responsive-sm': 'var(--gap-sm)',
        'responsive-md': 'var(--gap-md)',
        'responsive-lg': 'var(--gap-lg)',
        'responsive-xl': 'var(--gap-xl)',
      },
      padding: {
        'card':      'var(--pad-card)',
        'section-x': 'var(--pad-section-x)',
        'section-y': 'var(--pad-section-y)',
        'gutter':    'var(--app-shell-gutter)',
      },

      /* ========================================
         ANIMATIONS (keep existing)
         ======================================== */
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(16px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-in-bottom': {
          '0%': { opacity: '0', transform: 'translateY(100%)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'card-success': {
          '0%': { boxShadow: '0 0 0 0 rgba(34,197,94,0.4)' },
          '40%': { boxShadow: '0 0 0 8px rgba(34,197,94,0.15)', transform: 'scale(1.02)' },
          '100%': { boxShadow: '0 0 0 0 rgba(34,197,94,0)', transform: 'scale(1)' },
        },
        'card-error': {
          '0%, 100%': { transform: 'translateX(0)' },
          '15%': { transform: 'translateX(-4px)' },
          '30%': { transform: 'translateX(4px)' },
          '45%': { transform: 'translateX(-3px)' },
          '60%': { transform: 'translateX(3px)' },
          '75%': { transform: 'translateX(-1px)' },
          '90%': { transform: 'translateX(1px)' },
        },
        'card-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        'card-move': {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '30%': { transform: 'scale(0.95)', opacity: '0.7' },
          '60%': { transform: 'scale(1.03)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'status-glow': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(59,130,246,0.3)' },
          '50%': { boxShadow: '0 0 12px 4px rgba(59,130,246,0.15)' },
        },
        /* Urgency pulse — draws eye to action-required items */
        'urgency-pulse': {
          '0%, 100%': {
            boxShadow: '0 0 0 0 rgba(249,115,22,0.0), 0 2px 8px rgba(0,0,0,0.06)',
          },
          '50%': {
            boxShadow: '0 0 0 4px rgba(249,115,22,0.14), 0 4px 16px rgba(249,115,22,0.12)',
          },
        },
        /* Critical ring — stronger pulse for highest priority */
        'critical-ring': {
          '0%, 100%': {
            boxShadow: '0 0 0 0 rgba(220,38,38,0.0)',
          },
          '50%': {
            boxShadow: '0 0 0 5px rgba(220,38,38,0.18), 0 4px 14px rgba(220,38,38,0.15)',
          },
        },
        /* Dot ping — indicator dot that bounces */
        'dot-ping': {
          '0%, 100%': { transform: 'scale(1)', opacity: '1' },
          '50%': { transform: 'scale(1.5)', opacity: '0.7' },
        },
        /* Entrance for bottom sheet / drawer on mobile */
        'sheet-up': {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        /* Metric counter flash when value updates */
        'metric-flash': {
          '0%': { color: 'inherit' },
          '30%': { color: 'var(--color-primary-600)', transform: 'scale(1.05)' },
          '100%': { color: 'inherit', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out forwards',
        'fade-in-up': 'fade-in-up 0.35s cubic-bezier(0.22,1,0.36,1) forwards',
        'slide-in-right': 'slide-in-right 0.3s ease-out forwards',
        'slide-in-bottom': 'slide-in-bottom 0.4s cubic-bezier(0.22,1,0.36,1) forwards',
        'scale-in': 'scale-in 0.2s ease-out forwards',
        'card-success': 'card-success 1.2s ease-out forwards',
        'card-error': 'card-error 0.5s ease-out forwards',
        'card-pulse': 'card-pulse 1.5s ease-in-out infinite',
        'card-move': 'card-move 0.8s ease-out forwards',
        'status-glow': 'status-glow 2s ease-in-out infinite',
        'urgency-pulse': 'urgency-pulse 2.5s ease-in-out infinite',
        'critical-ring': 'critical-ring 1.8s ease-in-out infinite',
        'dot-ping': 'dot-ping 1.5s ease-in-out infinite',
        'sheet-up': 'sheet-up 0.4s cubic-bezier(0.22,1,0.36,1) forwards',
        'metric-flash': 'metric-flash 0.6s ease-out forwards',
      },
    },
  },

  /* ========================================
     PLUGINS
     ======================================== */
  plugins: [
    // Logical Properties Plugin for RTL support
    plugin(function ({ addUtilities }) {
      addUtilities({
        // Margin Inline (horizontal in logical terms)
        '.ms-0': { 'margin-inline-start': '0' },
        '.ms-1': { 'margin-inline-start': 'var(--spacing-1)' },
        '.ms-2': { 'margin-inline-start': 'var(--spacing-2)' },
        '.ms-3': { 'margin-inline-start': 'var(--spacing-3)' },
        '.ms-4': { 'margin-inline-start': 'var(--spacing-4)' },
        '.ms-5': { 'margin-inline-start': 'var(--spacing-5)' },
        '.ms-6': { 'margin-inline-start': 'var(--spacing-6)' },
        '.ms-8': { 'margin-inline-start': 'var(--spacing-8)' },
        '.ms-auto': { 'margin-inline-start': 'auto' },

        '.me-0': { 'margin-inline-end': '0' },
        '.me-1': { 'margin-inline-end': 'var(--spacing-1)' },
        '.me-2': { 'margin-inline-end': 'var(--spacing-2)' },
        '.me-3': { 'margin-inline-end': 'var(--spacing-3)' },
        '.me-4': { 'margin-inline-end': 'var(--spacing-4)' },
        '.me-5': { 'margin-inline-end': 'var(--spacing-5)' },
        '.me-6': { 'margin-inline-end': 'var(--spacing-6)' },
        '.me-8': { 'margin-inline-end': 'var(--spacing-8)' },
        '.me-auto': { 'margin-inline-end': 'auto' },

        // Padding Inline
        '.ps-0': { 'padding-inline-start': '0' },
        '.ps-1': { 'padding-inline-start': 'var(--spacing-1)' },
        '.ps-2': { 'padding-inline-start': 'var(--spacing-2)' },
        '.ps-3': { 'padding-inline-start': 'var(--spacing-3)' },
        '.ps-4': { 'padding-inline-start': 'var(--spacing-4)' },
        '.ps-5': { 'padding-inline-start': 'var(--spacing-5)' },
        '.ps-6': { 'padding-inline-start': 'var(--spacing-6)' },
        '.ps-8': { 'padding-inline-start': 'var(--spacing-8)' },

        '.pe-0': { 'padding-inline-end': '0' },
        '.pe-1': { 'padding-inline-end': 'var(--spacing-1)' },
        '.pe-2': { 'padding-inline-end': 'var(--spacing-2)' },
        '.pe-3': { 'padding-inline-end': 'var(--spacing-3)' },
        '.pe-4': { 'padding-inline-end': 'var(--spacing-4)' },
        '.pe-5': { 'padding-inline-end': 'var(--spacing-5)' },
        '.pe-6': { 'padding-inline-end': 'var(--spacing-6)' },
        '.pe-8': { 'padding-inline-end': 'var(--spacing-8)' },

        // Inset (positioning)
        '.start-0': { 'inset-inline-start': '0' },
        '.start-1': { 'inset-inline-start': 'var(--spacing-1)' },
        '.start-2': { 'inset-inline-start': 'var(--spacing-2)' },
        '.start-4': { 'inset-inline-start': 'var(--spacing-4)' },
        '.start-auto': { 'inset-inline-start': 'auto' },

        '.end-0': { 'inset-inline-end': '0' },
        '.end-1': { 'inset-inline-end': 'var(--spacing-1)' },
        '.end-2': { 'inset-inline-end': 'var(--spacing-2)' },
        '.end-4': { 'inset-inline-end': 'var(--spacing-4)' },
        '.end-auto': { 'inset-inline-end': 'auto' },

        // Text Alignment
        '.text-start': { 'text-align': 'start' },
        '.text-end': { 'text-align': 'end' },

        // Border Inline
        '.border-s': { 'border-inline-start-width': '1px' },
        '.border-e': { 'border-inline-end-width': '1px' },
        '.border-s-0': { 'border-inline-start-width': '0' },
        '.border-e-0': { 'border-inline-end-width': '0' },
      });
    }),
  ],
};

export default config;
