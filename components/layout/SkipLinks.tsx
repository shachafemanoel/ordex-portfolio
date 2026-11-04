'use client';

/**
 * Skip Links Component for Accessibility
 *
 * Provides keyboard navigation shortcuts to skip to main content areas.
 * These links are visually hidden until focused, allowing keyboard users
 * to quickly navigate the page without tabbing through the entire navigation.
 *
 * WCAG 2.1 AA Compliance:
 * - 2.4.1 Bypass Blocks
 * - 2.4.3 Focus Order
 */

import { focusRing } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';

interface SkipLink {
  id: string;
  label: string;
  href: string;
}

const defaultSkipLinks: SkipLink[] = [
  { id: 'main-content', label: 'דלג לתוכן הראשי', href: '#main-content' },
  { id: 'main-navigation', label: 'דלג לניווט', href: '#main-navigation' },
];

interface SkipLinksProps {
  links?: SkipLink[];
}

export function SkipLinks({ links = defaultSkipLinks }: SkipLinksProps) {
  return (
    <div className="relative z-[100]" suppressHydrationWarning>
      {links.map((link) => (
        <a
          key={link.id}
          href={link.href}
          className={cn(
            // Visually hidden by default
            'sr-only',
            // Become visible when focused
            'focus:not-sr-only focus:absolute focus:top-4 focus:start-4',
            // Styling
            'inline-block rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-on-dark',
            // Shadow and elevation
            'shadow-lg',
            // Focus ring
            focusRing.default,
            // Transition
            'transition-all duration-200'
          )}
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}

export default SkipLinks;
