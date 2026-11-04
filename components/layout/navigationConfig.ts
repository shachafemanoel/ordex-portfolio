import { LucideIcon, ShoppingCart, Store, Users } from 'lucide-react';

import { Role } from '@/lib/auth/types';

export interface NavItemConfig {
  path: string;
  label: string;
  labelKey?: string;
  icon: LucideIcon;
  activeIcon?: LucideIcon;
  roles: Role[];
  badge?: string | number;
  description?: string;
  descriptionKey?: string;
  subItems?: NavItemConfig[];
}

export interface NavSection {
  id: string;
  label: string;
  labelKey?: string;
  icon: LucideIcon;
  items: NavItemConfig[];
  collapsible?: boolean;
}

// The MVP covers the internal order flow only. Dashboards, deliveries, calendar, tasks and
// installations are frozen and stay out of the navigation until they are picked up again.
export const navigationSections: NavSection[] = [
  {
    id: 'ops',
    label: 'תפעול',
    labelKey: 'nav.section.ops',
    icon: ShoppingCart,
    items: [
      {
        path: '/orders',
        label: 'הזמנות',
        labelKey: 'nav.orders',
        icon: ShoppingCart,
        roles: ['ADMIN', 'OPERATIONS'],
        description: 'רשימת הזמנות פעילות',
      },
    ],
  },
  {
    id: 'management',
    label: 'ניהול',
    labelKey: 'nav.section.management',
    icon: Store,
    items: [
      {
        path: '/customers',
        label: 'לקוחות',
        labelKey: 'nav.customers',
        icon: Users,
        roles: ['ADMIN', 'OPERATIONS'],
        description: 'ניהול לקוחות',
      },
      {
        path: '/store',
        label: 'החנות',
        labelKey: 'nav.store',
        icon: Store,
        roles: ['ADMIN', 'OPERATIONS'],
      },
    ],
  },
];

export const roleLabels: Partial<Record<Role, string>> = {
  ADMIN: 'מנהל',
  OPERATIONS: 'עובד כללי',
  // Legacy aliases
  SALES: 'עובד כללי',
  PURCHASING: 'עובד כללי',
  INSTALLER: 'עובד כללי',
  VIEWER: 'עובד כללי',
};

export const roleLabelKeys: Partial<Record<Role, string>> = {
  ADMIN: 'role.admin',
  OPERATIONS: 'role.worker',
};

export function getRoleLabel(role: Role, translate?: (key: string) => string): string {
  // Normalize legacy roles to OPERATIONS label
  const effectiveRole: Role = role === 'ADMIN' ? 'ADMIN' : 'OPERATIONS';
  const key = roleLabelKeys[effectiveRole];
  if (translate && key) return translate(key);
  return roleLabels[effectiveRole] || role;
}

/** Only these two roles are available for assignment in the UI */
export const ASSIGNABLE_ROLES: Role[] = ['ADMIN', 'OPERATIONS'];
