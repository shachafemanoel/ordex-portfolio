'use client';

import { navigationSections } from '@/components/layout/navigationConfig';
import { usePersonalization } from '@/contexts/PersonalizationContext';
import { useUITranslation } from '@/lib/i18n/hooks/useTranslation';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface BottomNavProps {
  isVisible?: boolean;
}

// Primary nav paths shown in mobile bottom bar (max 5 for comfortable touch targets)
// These are the main pages users navigate between on mobile
const MOBILE_NAV_PATHS = ['/orders', '/customers', '/store'] as const;

export function BottomNav({ isVisible = true }: BottomNavProps) {
  const pathname = usePathname();
  const { t } = useUITranslation();
  const { role } = usePersonalization();

  const mobileItems = MOBILE_NAV_PATHS.map((path) => {
    const item = navigationSections
      .flatMap((section) => section.items)
      .find((entry) => entry.path === path);
    if (!item || !item.roles.includes(role)) return null;

    return {
      path: item.path,
      icon: item.icon,
      label: item.labelKey ? t(item.labelKey) : item.label,
    };
  }).filter((item): item is NonNullable<typeof item> => item !== null);

  if (mobileItems.length === 0) return null;

  const isActive = (path: string) => {
    // Exact match for /orders to avoid matching /orders/calendar etc.
    if (path === '/orders') return pathname === '/orders';
    return pathname.startsWith(path);
  };

  return (
    <nav
      className={cn(
        'fixed bottom-6 left-1/2 z-[var(--z-fixed)] w-[calc(100%-2.5rem)] max-w-sm -translate-x-1/2 lg:hidden',
        // An open modal sheet owns the bottom of the screen; its actions must not sit under the bar.
        '[body:has([data-app-modal])_&]:hidden',
        'transition-transform transition-opacity duration-500',
        'glass-dock rounded-[28px] shadow-[0_8px_32px_rgba(0,31,63,0.12),0_2px_8px_rgba(0,31,63,0.06)]',
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0 pointer-events-none'
      )}
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex h-[62px] items-center justify-around px-1">
        {mobileItems.map(({ path, icon: Icon, label }, idx) => {
          const active = isActive(path);
          return (
            <Link
              key={path}
              href={path}
              className={cn(
                'relative flex flex-1 flex-col items-center justify-center gap-1 py-2 transition-all duration-200 animate-fade-in-up active:scale-90',
                active ? 'text-primary-600' : 'text-fg-subtle'
              )}
              style={{ animationDelay: `${idx * 50 + 150}ms` }}
            >
              <div className={cn(
                'relative flex h-9 w-9 items-center justify-center rounded-[14px] transition-all duration-200',
                active
                  ? 'bg-primary-600/10 scale-105'
                  : 'bg-transparent'
              )}>
                <Icon
                  className={cn('h-[22px] w-[22px] transition-all duration-200', active ? 'text-primary-600' : 'text-fg-subtle')}
                  strokeWidth={active ? 2.5 : 1.75}
                />
              </div>
              <span className={cn(
                'text-[9.5px] font-semibold tracking-tight transition-all duration-200 leading-none',
                active ? 'text-primary-600 opacity-100' : 'text-fg-subtle opacity-55'
              )}>
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
