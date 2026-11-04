import { prisma } from '@/lib/db';
import {
  buildDeliveryAttentionWhere,
  reconcileStaleDeliveries,
} from '@/lib/orders/staleDeliveryMonitor';
import { staleOrderSlaWhere } from '@/lib/orders/staleOrderSla';
import { InstallationTaskStatus, OrderStatus } from '@prisma/client';
import { addHours, differenceInHours } from 'date-fns';

export type SmartNotification = {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  category: 'calendar' | 'deliveries' | 'installations' | 'inventory' | 'orders' | 'payments';
  actionLabel?: string;
  actionUrl?: string;
  metadata?: Record<string, any>;
  timestamp: string;
};

export async function buildSmartNotifications(): Promise<SmartNotification[]> {
  const now = new Date();
  const next24h = addHours(now, 24);
  const next72h = addHours(now, 72);
  const reconciledDeliveries = await reconcileStaleDeliveries(now);
  const reconciledByOrderId = new Map(reconciledDeliveries.map((item) => [item.id, item]));

  const [
    overdueInstallations,
    upcomingInstallations,
    unassignedUpcomingInstallations,
    unscheduledCalendarBacklog,
    deliveryAttentionOrders,
    staleOrders,
    unassignedOrders,
    unpaidOrders,
  ] = await Promise.all([
    prisma.installationTask.findMany({
      where: {
        scheduledDate: { lt: now },
        status: { in: [InstallationTaskStatus.PENDING, InstallationTaskStatus.SCHEDULED] },
      },
      select: {
        id: true,
        scheduledDate: true,
        status: true,
        technician: { select: { name: true } },
        order: {
          select: {
            id: true,
            number: true,
            customerName: true,
            customer: { select: { name: true } },
            status: true,
          },
        },
      },
      orderBy: { scheduledDate: 'asc' },
      take: 10,
    }),
    prisma.installationTask.findMany({
      where: {
        scheduledDate: { gte: now, lte: next24h },
        status: { in: [InstallationTaskStatus.PENDING, InstallationTaskStatus.SCHEDULED] },
      },
      select: {
        id: true,
        scheduledDate: true,
        status: true,
        technician: { select: { name: true } },
        order: {
          select: {
            id: true,
            number: true,
            customerName: true,
            customer: { select: { name: true } },
            status: true,
          },
        },
      },
      orderBy: { scheduledDate: 'asc' },
      take: 10,
    }),
    prisma.installationTask.findMany({
      where: {
        scheduledDate: { gte: now, lte: next72h },
        technicianId: null,
        status: { in: [InstallationTaskStatus.PENDING, InstallationTaskStatus.SCHEDULED] },
      },
      select: {
        id: true,
        scheduledDate: true,
        order: {
          select: {
            id: true,
            number: true,
            customerName: true,
            customer: { select: { name: true } },
          },
        },
      },
      orderBy: { scheduledDate: 'asc' },
      take: 6,
    }),
    prisma.order.count({
      where: {
        deletedAt: null,
        completedAt: null,
        scheduledAt: null,
        status: {
          in: [
            OrderStatus.READY,
            OrderStatus.READY_FOR_INSTALL,
            OrderStatus.INSTALL_SCHEDULING,
            OrderStatus.AWAITING_INSTALL,
          ],
        },
        installationTasks: {
          none: {
            status: {
              in: [
                InstallationTaskStatus.PENDING,
                InstallationTaskStatus.SCHEDULED,
                InstallationTaskStatus.APPLIED,
              ],
            },
          },
        },
      },
    }),
    prisma.order.findMany({
      where: buildDeliveryAttentionWhere(now),
      select: {
        id: true,
        number: true,
        customerName: true,
        customer: { select: { name: true } },
        status: true,
        scheduledAt: true,
      },
      orderBy: { scheduledAt: 'asc' },
      take: 10,
    }),
    prisma.order.findMany({
      where: staleOrderSlaWhere(now),
      select: {
        id: true,
        number: true,
        customerName: true,
        customer: { select: { name: true } },
        createdAt: true,
        status: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 10,
    }),
    prisma.order.findMany({
      where: {
        assignedUserId: null,
        deletedAt: null,
        completedAt: null,
      },
      select: {
        id: true,
        number: true,
        customerName: true,
        customer: { select: { name: true } },
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 10,
    }),
    prisma.order.findMany({
      where: {
        paymentStatus: { not: 'PAID' },
        updatedAt: { lt: addHours(now, -168) }, // 7 days
        deletedAt: null,
        completedAt: { not: null },
      },
      select: {
        id: true,
        number: true,
        customerName: true,
        customer: { select: { name: true } },
        totalCents: true,
        paymentStatus: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'asc' },
      take: 10,
    }),
  ]);

  const notifications: SmartNotification[] = [];

  overdueInstallations.forEach((task) => {
    const customerName = task.order.customerName ?? task.order.customer?.name ?? 'ללא שם';
    notifications.push({
      id: `calendar-overdue-${task.id}`,
      severity: 'critical',
      category: 'calendar',
      title: `משימת יומן באיחור עבור ${customerName}`,
      message: `הזמנה #${task.order.number} נקבעה ל-${task.scheduledDate.toLocaleString('he-IL')} ועדיין לא הושלמה.`,
      actionLabel: 'פתח יומן',
      actionUrl: '/orders/calendar',
      metadata: { orderId: task.order.id, taskId: task.id, status: task.status },
      timestamp: task.scheduledDate.toISOString(),
    });
  });

  upcomingInstallations.forEach((task) => {
    const customerName = task.order.customerName ?? task.order.customer?.name ?? 'לקוח';
    notifications.push({
      id: `calendar-upcoming-${task.id}`,
      severity: 'info',
      category: 'calendar',
      title: `התקנה קרובה ל-${customerName}`,
      message: task.technician?.name
        ? `הזמנה #${task.order.number} מתוכננת ל-${task.scheduledDate.toLocaleString('he-IL')} עם ${task.technician.name}.`
        : `הזמנה #${task.order.number} מתוכננת ל-${task.scheduledDate.toLocaleString('he-IL')} ועדיין ללא שיבוץ טכנאי.`,
      actionLabel: 'פתח יומן',
      actionUrl: '/orders/calendar',
      metadata: { orderId: task.order.id, taskId: task.id, status: task.status },
      timestamp: task.scheduledDate.toISOString(),
    });
  });

  if (unassignedUpcomingInstallations.length > 0) {
    const nextTask = unassignedUpcomingInstallations[0];
    const nextCustomer = nextTask.order.customerName ?? nextTask.order.customer?.name ?? 'לקוח';
    notifications.push({
      id: 'calendar-unassigned-upcoming',
      severity: 'warning',
      category: 'calendar',
      title: 'יש משימות יומן ללא טכנאי משויך',
      message: `${unassignedUpcomingInstallations.length} משימות ב-72 השעות הקרובות ללא הקצאה. הקרובה ביותר היא הזמנה #${nextTask.order.number} עבור ${nextCustomer}.`,
      actionLabel: 'שבץ ביומן',
      actionUrl: '/orders/calendar',
      metadata: { count: unassignedUpcomingInstallations.length, taskId: nextTask.id },
      timestamp: nextTask.scheduledDate.toISOString(),
    });
  }

  if (unscheduledCalendarBacklog >= 3) {
    notifications.push({
      id: 'calendar-backlog-unscheduled',
      severity: 'warning',
      category: 'calendar',
      title: 'יש עומס הזמנות שממתינות ליומן',
      message: `${unscheduledCalendarBacklog} הזמנות מוכנות עדיין לא שובצו ביומן העבודה.`,
      actionLabel: 'פתח יומן',
      actionUrl: '/orders/calendar',
      metadata: { count: unscheduledCalendarBacklog },
      timestamp: now.toISOString(),
    });
  }

  deliveryAttentionOrders.forEach((order) => {
    const customerName = order.customerName ?? order.customer?.name ?? 'לקוח';
    const reconciled = reconciledByOrderId.get(order.id);
    const scheduledAt = order.scheduledAt ?? reconciled?.rescheduledAt ?? now;

    notifications.push({
      id: `delivery-attention-${order.id}`,
      severity: 'critical',
      category: 'deliveries',
      title: `משלוח תקוע עבור ${customerName}`,
      message: reconciled
        ? `הזמנה #${order.number} הייתה מתוזמנת ל-${reconciled.previousScheduledAt.toLocaleString('he-IL')} והועברה אוטומטית להיום בעדיפות גבוהה.`
        : `הזמנה #${order.number} מתוזמנת ל-${scheduledAt.toLocaleString('he-IL')} ועדיין לא טופלה. נדרש טיפול מיידי.`,
      actionLabel: 'פתח משלוחים',
      actionUrl: `/deliveries?orderId=${order.id}`,
      metadata: {
        orderId: order.id,
        status: order.status,
        autoRescheduled: Boolean(reconciled),
      },
      timestamp: scheduledAt.toISOString(),
    });
  });

  staleOrders.forEach((order) => {
    const hours = differenceInHours(now, order.createdAt);
    notifications.push({
      id: `stale-order-${order.id}`,
      severity: hours > 96 ? 'critical' : 'warning',
      category: 'orders',
      title: `הזמנה #${order.number} תקועה`,
      message: `הזמנה במצב ${order.status} יותר מ-${hours} שעות, עבור ${order.customerName ?? (order as any).customer?.name ?? 'לקוח'}`,
      actionLabel: 'בצע פעולה',
      actionUrl: `/orders/${order.id}`,
      metadata: { orderId: order.id, status: order.status },
      timestamp: order.createdAt.toISOString(),
    });
  });

  // Low stock logic removed (SKU table deleted)

  if (unassignedOrders.length >= 3) {
    notifications.push({
      id: 'unassigned-orders',
      severity: 'warning',
      category: 'orders',
      title: 'הזמנות ללא משוייך',
      message: `${unassignedOrders.length} הזמנות פעילות ללא אחריות. שייך איש צוות לטיפול.`,
      actionLabel: 'הצג רשימה',
      actionUrl: '/orders?filter=unassigned',
      metadata: { count: unassignedOrders.length },
      timestamp: now.toISOString(),
    });
  }

  unpaidOrders.forEach((order) => {
    notifications.push({
      id: `unpaid-${order.id}`,
      severity: 'warning',
      category: 'payments',
      title: `תשלום שלא הושלם`,
      message: `הזמנה #${order.number} (${(order.totalCents / 100).toLocaleString('he-IL', { style: 'currency', currency: 'ILS' })}) עדיין בסטטוס תשלום ${order.paymentStatus}.`,
      actionLabel: 'עקוב אחר גבייה',
      actionUrl: `/orders/${order.id}`,
      metadata: { orderId: order.id },
      timestamp: order.updatedAt.toISOString(),
    });
  });

  return notifications.sort((a, b) => {
    const severityRank = { critical: 0, warning: 1, info: 2 };
    if (severityRank[a.severity] !== severityRank[b.severity]) {
      return severityRank[a.severity] - severityRank[b.severity];
    }
    return b.timestamp.localeCompare(a.timestamp);
  });
}
