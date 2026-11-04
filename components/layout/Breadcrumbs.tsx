'use client';

/**
 * Breadcrumbs Navigation Component
 * Provides contextual navigation hierarchy
 */

import { ChevronLeftIcon, HomeIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment } from 'react';

interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

interface BreadcrumbsProps {
  customItems?: BreadcrumbItem[];
  className?: string;
}

// Path to label mapping
const pathLabels: Record<string, string> = {
  '/dashboard': 'משימות היום',
  '/orders': 'הזמנות',
  '/orders/new': 'הזמנה חדשה',
  '/customers': 'לקוחות',
  '/purchase-orders': 'הזמנות רכש',
  '/suppliers': 'ספקים',
  '/skus': 'מק"טים',
  '/reports': 'דוחות',
  '/reports/status': 'דוח סטטוסים',
  '/reports/waiting-stock': 'ממתין למלאי',
  '/reports/waiting-installation': 'ממתין להתקנה',
  '/reports/history': 'היסטוריה',
  '/map': 'מפה',
  '/calendar': 'יומן',
  '/settings': 'הגדרות',
  '/settings/users': 'ניהול משתמשים',
  '/settings/integrations': 'אינטגרציות',
  '/notifications': 'התראות',
};

export function Breadcrumbs({ customItems, className = '' }: BreadcrumbsProps) {
  const pathname = usePathname();

  // Generate breadcrumbs from pathname
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    if (customItems) {
      return [{ label: 'ראשי', href: '/dashboard', icon: HomeIcon }, ...customItems];
    }

    const items: BreadcrumbItem[] = [{ label: 'ראשי', href: '/dashboard', icon: HomeIcon }];

    if (pathname === '/' || pathname === '/dashboard') {
      return items;
    }

    const segments = pathname.split('/').filter(Boolean);
    let currentPath = '';

    segments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const isLast = index === segments.length - 1;

      // Check if it's a dynamic segment (UUID, number, etc.)
      const isDynamic =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment) ||
        /^\d+$/.test(segment);

      if (isDynamic) {
        items.push({
          label: `#${segment.substring(0, 8)}`,
          href: isLast ? undefined : currentPath,
        });
      } else {
        items.push({
          label: pathLabels[currentPath] || segment.replace(/-/g, ' '),
          href: isLast ? undefined : currentPath,
        });
      }
    });

    return items;
  };

  const breadcrumbs = generateBreadcrumbs();

  // Don't show breadcrumbs on root
  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center space-x-1 space-x-reverse text-sm ${className}`}
    >
      <ol className="flex items-center space-x-1 space-x-reverse">
        {breadcrumbs.map((item, index) => {
          const isLast = index === breadcrumbs.length - 1;
          const Icon = item.icon;

          return (
            <Fragment key={item.href || item.label}>
              <li className="flex items-center">
                {item.href ? (
                  <Link
                    href={item.href}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                  >
                    {Icon && <Icon className="w-4 h-4" />}
                    <span className={index === 0 ? 'sr-only sm:not-sr-only' : ''}>
                      {item.label}
                    </span>
                  </Link>
                ) : (
                  <span className="flex items-center gap-1.5 px-2 py-1 font-medium text-gray-900">
                    {Icon && <Icon className="w-4 h-4" />}
                    {item.label}
                  </span>
                )}
              </li>

              {!isLast && (
                <li>
                  <ChevronLeftIcon className="w-4 h-4 text-gray-400" />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Breadcrumb with custom items example:
 *
 * <Breadcrumbs
 *   customItems={[
 *     { label: 'הזמנות', href: '/orders' },
 *     { label: `הזמנה #${orderNumber}` }
 *   ]}
 * />
 */
