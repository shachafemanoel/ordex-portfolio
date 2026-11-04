import { logger } from '@/lib/logger';
import { HebrewFormatters } from '@/src/lib/data/hebrew-formatters';
import { getRecentOpsCards } from '@/src/server/services/ops-queues.service';

const timeout = (ms: number) =>
  new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms));

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([promise, timeout(ms)]) as Promise<T>;
}

export type DashboardHomeQuickActionIconKey = 'orders' | 'deliveries' | 'calendar' | 'operations';

export type DashboardHomeViewModelJson = {
  userName: string;
  dateLabel: string;
  quickActions: ReadonlyArray<{
    href: string;
    label: string;
    description: string;
    iconKey: DashboardHomeQuickActionIconKey;
  }>;
  activityItems: ReadonlyArray<{
    id: string;
    title: string;
    subtitle: string;
    timeLabel: string;
    statusLabel?: string;
    dueLabel?: string;
    tone: 'critical' | 'warning' | 'info';
    href: string;
  }>;
};

/**
 * Loads the lightweight operational dashboard home view-model.
 * The dashboard now focuses only on the workday shell: greeting, quick actions, and active tasks.
 */
export async function loadDashboardHomeViewModelJson(
  userFullName: string | null | undefined
): Promise<DashboardHomeViewModelJson> {
  let recentOpsCards: Awaited<ReturnType<typeof getRecentOpsCards>> = [];

  try {
    recentOpsCards = await withTimeout(getRecentOpsCards(8), 10000);
  } catch (error) {
    logger.error('Failed to fetch recent ops cards:', error);
  }

  const firstName = userFullName?.split(' ')[0] || 'צוות רצף';
  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 12 ? `בוקר טוב, ${firstName}` :
    hour < 17 ? `צהריים טובים, ${firstName}` :
    `ערב טוב, ${firstName}`;
  const userName = greeting;
  const dateLabel = now.toLocaleDateString('he-IL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const quickActions: DashboardHomeViewModelJson['quickActions'] = [
    {
      href: '/orders',
      label: 'הזמנות',
      description: 'לוח ההזמנות הפעיל, חיפוש מהיר וסינון לפי טיפול',
      iconKey: 'orders',
    },
    {
      href: '/deliveries',
      label: 'משלוחים',
      description: 'מסלולים, שיוך צוותים ומעקב מסירות',
      iconKey: 'deliveries',
    },
    {
      href: '/orders/calendar',
      label: 'יומן התקנות',
      description: 'חלונות תיאום לפי תאריך וצוות',
      iconKey: 'calendar',
    },
    {
      href: '/dashboard/operations',
      label: 'לוח תפעול',
      description: 'מוקד לעומסי תפעול, פתוחים וחריגים',
      iconKey: 'operations',
    },
  ];

  const activityItems: DashboardHomeViewModelJson['activityItems'] = recentOpsCards
    .slice(0, 6)
    .map((item) => {
      const nextActionDate =
        item.nextActionAt && !Number.isNaN(new Date(item.nextActionAt).getTime())
          ? new Date(item.nextActionAt)
          : null;

      return {
        id: item.id,
        title: item.summary,
        subtitle: item.customerName || item.derivedTask.taskTitleHe,
        timeLabel: nextActionDate
          ? `הפעולה הבאה ${HebrewFormatters.formatRelativeTime(nextActionDate)}`
          : `סטטוס: ${item.derivedTask.statusLabelHe}`,
        statusLabel: item.derivedTask.statusLabelHe,
        dueLabel: nextActionDate
          ? `יעד ${nextActionDate.toLocaleTimeString('he-IL', {
              hour: '2-digit',
              minute: '2-digit',
            })}`
          : undefined,
        tone: item.isUrgent
          ? ('critical' as const)
          : item.derivedTask.taskColor === 'ORANGE'
            ? ('warning' as const)
            : ('info' as const),
        href: `/orders/${item.id}`,
      };
    });

  return {
    userName,
    dateLabel,
    quickActions,
    activityItems,
  };
}
