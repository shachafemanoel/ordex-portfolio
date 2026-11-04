import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  HardDrive,
  HelpCircle,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Plug,
  Store,
  Tags,
  Users,
} from 'lucide-react';

export type AdminConsoleNavEntry = {
  id: string;
  href: string;
  title: string;
  description: string;
  emoji: string;
  icon: LucideIcon;
  badge?: string;
  badgeColor?: 'success' | 'warning' | 'danger' | 'info';
};

/** Single source for /admin hub + store settings shortcuts (emoji for hub page, Lucide for store UI). */
export const ADMIN_CONSOLE_NAV_ENTRIES: AdminConsoleNavEntry[] = [
  {
    id: 'hub',
    href: '/settings',
    title: 'מרכז ניהול',
    description: 'סקירה וכל כלי הניהול במקום אחד',
    emoji: '🧭',
    icon: LayoutDashboard,
  },
  {
    id: 'store-settings',
    href: '/settings',
    title: 'הגדרות חנות',
    description: 'מסך מלא: שם החנות, כתובות, מוצא למסלולים וברירות מחדל תפעוליות',
    emoji: '🏪',
    icon: Store,
    badge: 'מאוחד',
    badgeColor: 'success',
  },
  {
    id: 'templates',
    href: '/settings/templates',
    title: 'תבניות הודעה',
    description: 'עריכת תבניות WhatsApp ו-Email',
    emoji: '💬',
    icon: MessageSquare,
  },
  {
    id: 'announcements',
    href: '/settings/announcements',
    title: 'הודעות מערכת',
    description: 'ניהול הודעות מתפרצות למשתמשים',
    emoji: '📢',
    icon: Megaphone,
  },
  {
    id: 'help',
    href: '/settings/help',
    title: 'קטעי עזרה',
    description: 'ניהול טקסטים ועזרה במערכת',
    emoji: '❓',
    icon: HelpCircle,
  },
  {
    id: 'labels',
    href: '/settings/labels',
    title: 'תוויות ממשק',
    description: 'שינוי טקסטים בממשק המשתמש',
    emoji: '🏷️',
    icon: Tags,
  },
  {
    id: 'users',
    href: '/settings/users',
    title: 'ניהול משתמשים',
    description: 'הוספת, עריכת ונהול הרשאות משתמשים',
    emoji: '👥',
    icon: Users,
    badge: 'RBAC',
    badgeColor: 'info',
  },
  {
    id: 'integrations',
    href: '/settings/integrations',
    title: 'אינטגרציות',
    description: 'חיבור לחנות WooCommerce',
    emoji: '🔌',
    icon: Plug,
    badge: 'חדש',
    badgeColor: 'success',
  },
  {
    id: 'notifications',
    href: '/notifications',
    title: 'יומן התראות',
    description: 'צפייה ביומן התראות שנשלחו',
    emoji: '📧',
    icon: Bell,
  },
  {
    id: 'backup',
    href: '/settings/backup',
    title: 'גיבוי ושחזור',
    description: 'ניהול גיבויים ושחזור מערכת',
    emoji: '💾',
    icon: HardDrive,
    badge: 'קריטי',
    badgeColor: 'warning',
  },
];
