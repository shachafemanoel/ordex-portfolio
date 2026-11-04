/**
 * ActionableItemsService
 *
 * Unified service that aggregates all items requiring user action,
 * including tasks, orders needing attention, installations, deliveries, etc.
 */

import { prisma } from '@/lib/db';
import { translateOrderStatus } from '@/lib/i18n/domains/orderStatus';
import {
  buildDeliveryAttentionWhere,
  DELIVERY_FLOW_STATUSES,
  reconcileStaleDeliveries,
} from '@/lib/orders/staleDeliveryMonitor';
import { InstallationTaskStatus, OrderStatus, TaskStatus, TaskType } from '@prisma/client';
import { endOfDay, startOfDay } from 'date-fns';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type ActionableItemType =
  | 'TASK'
  | 'ORDER_ACTION'
  | 'INSTALLATION'
  | 'DELIVERY'
  | 'PAYMENT'
  | 'STOCK';

export type ActionableItemPriority = 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface ActionButton {
  id: string;
  label: string;
  type: 'primary' | 'secondary' | 'danger';
  action: 'navigate' | 'api_call' | 'snooze';
  endpoint?: string;
  href?: string;
  method?: 'POST' | 'PATCH' | 'DELETE';
  payload?: Record<string, unknown>;
}

export interface ActionableItem {
  id: string;
  type: ActionableItemType;
  priority: ActionableItemPriority;
  title: string;
  description?: string;
  dueAt?: Date | null;
  isOverdue: boolean;
  orderId?: string;
  orderNumber?: string;
  customerName?: string;
  customerPhone?: string;
  actions: ActionButton[];
  href?: string;
  icon?: string;
  meta?: Record<string, unknown>;
}

export interface TodayScheduleItem {
  id: string;
  type: 'INSTALLATION' | 'DELIVERY';
  time: Date;
  timeSlot?: string;
  customerName: string;
  location: string;
  address?: string;
  orderId: string;
  orderNumber: string;
  status: string;
  isOverdue?: boolean;
  technicianName?: string;
  lat?: number | null;
  lng?: number | null;
}

export interface ActionableDashboardData {
  actionableItems: ActionableItem[];
  todaySchedule: TodayScheduleItem[];
  stats: {
    urgent: number;
    total: number;
    overdue: number;
    todayInstallations: number;
    todayDeliveries: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Priority Mapping
// ─────────────────────────────────────────────────────────────────────────────

const TASK_PRIORITY_MAP: Record<string, ActionableItemPriority> = {
  URGENT: 'URGENT',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
};

const ORDER_STATUS_PRIORITY: Partial<Record<OrderStatus, ActionableItemPriority>> = {
  RECEIVED: 'MEDIUM',
  PROCESSING: 'MEDIUM',
  READY: 'HIGH',
  IN_TRANSIT: 'HIGH',
  INSTALLATION: 'HIGH',
};

const STARTABLE_DELIVERY_STATUSES = new Set<OrderStatus>([
  OrderStatus.READY,
  OrderStatus.READY_FOR_INSTALL,
  OrderStatus.INSTALL_SCHEDULING,
  OrderStatus.AWAITING_INSTALL,
  OrderStatus.SCHEDULED,
]);

// ─────────────────────────────────────────────────────────────────────────────
// Action Builders
// ─────────────────────────────────────────────────────────────────────────────

function buildTaskActions(taskId: string, orderId?: string): ActionButton[] {
  const actions: ActionButton[] = [];

  if (orderId) {
    actions.push({
      id: 'open-order',
      label: 'פתח הזמנה',
      type: 'secondary',
      action: 'navigate',
      href: `/orders/${orderId}`,
    });
  }

  actions.push({
    id: 'complete',
    label: 'בוצע',
    type: 'primary',
    action: 'api_call',
    endpoint: `/api/tasks/${taskId}`,
    method: 'PATCH',
    payload: { status: 'DONE' },
  });

  actions.push({
    id: 'snooze',
    label: 'תזכיר אותי',
    type: 'secondary',
    action: 'snooze',
  });

  return actions;
}

function buildOrderActions(orderId: string, status: OrderStatus): ActionButton[] {
  const actions: ActionButton[] = [
    {
      id: 'open-order',
      label: 'פתח הזמנה',
      type: 'primary',
      action: 'navigate',
      href: `/orders/${orderId}`,
    },
  ];

  // Add status-specific actions
  if (status === 'RECEIVED') {
    actions.push({
      id: 'mark-processing',
      label: 'העבר לטיפול',
      type: 'primary',
      action: 'api_call',
      endpoint: `/api/orders/${orderId}/status`,
      method: 'PATCH',
      payload: { status: 'PROCESSING' },
    });
  }

  if (status === 'PROCESSING') {
    actions.push({
      id: 'mark-ready',
      label: 'מוכן',
      type: 'primary',
      action: 'api_call',
      endpoint: `/api/orders/${orderId}/status`,
      method: 'PATCH',
      payload: { status: 'READY' },
    });
  }

  if (status === 'READY') {
    actions.push({
      id: 'schedule',
      label: 'קבע התקנה',
      type: 'secondary',
      action: 'navigate',
      href: `/calendar?orderId=${orderId}`,
    });
  }

  actions.push({
    id: 'snooze',
    label: 'תזכיר אותי',
    type: 'secondary',
    action: 'snooze',
  });

  return actions;
}

function buildInstallationActions(
  installationId: string,
  orderId: string,
  lat?: number | null,
  lng?: number | null
): ActionButton[] {
  const actions: ActionButton[] = [
    {
      id: 'open-order',
      label: 'פתח הזמנה',
      type: 'secondary',
      action: 'navigate',
      href: `/orders/${orderId}`,
    },
  ];

  // Add navigation if coordinates available
  if (lat && lng) {
    actions.push({
      id: 'navigate',
      label: 'נווט',
      type: 'primary',
      action: 'navigate',
      href: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    });
  }

  actions.push({
    id: 'mark-complete',
    label: 'סמן הושלם',
    type: 'primary',
    action: 'api_call',
    endpoint: `/api/installations/${installationId}/complete`,
    method: 'POST',
  });

  return actions;
}

function buildDeliveryActions(
  orderId: string,
  status: OrderStatus,
  lat?: number | null,
  lng?: number | null
): ActionButton[] {
  const actions: ActionButton[] = [
    {
      id: 'open-delivery',
      label: 'פתח במשלוחים',
      type: 'primary',
      action: 'navigate',
      href: `/deliveries?orderId=${orderId}`,
    },
  ];

  if (lat && lng) {
    actions.push({
      id: 'navigate',
      label: 'נווט',
      type: 'secondary',
      action: 'navigate',
      href: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    });
  }

  actions.push({
    id: STARTABLE_DELIVERY_STATUSES.has(status) ? 'start-delivery' : 'mark-delivered',
    label: STARTABLE_DELIVERY_STATUSES.has(status) ? 'העבר למשלוח' : 'סמן כנמסר',
    type: 'primary',
    action: 'api_call',
    endpoint: `/api/orders/${orderId}/delivery-tasks`,
    method: 'POST',
    payload: {
      actionType: STARTABLE_DELIVERY_STATUSES.has(status) ? 'MARK_PICKED' : 'MARK_DELIVERED',
    },
  });

  return actions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Task Type Labels
// ─────────────────────────────────────────────────────────────────────────────

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  CALL_BACK: 'חזרה ללקוח',
  INSTALL_REMINDER: 'תזכורת התקנה',
  STOCK_RECEIPT: 'קבלת סחורה',
  OTHER: 'משימה',
};

const TASK_TYPE_ICONS: Record<TaskType, string> = {
  CALL_BACK: 'phone',
  INSTALL_REMINDER: 'wrench',
  STOCK_RECEIPT: 'package',
  OTHER: 'file',
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Service
// ─────────────────────────────────────────────────────────────────────────────

export async function getActionableDashboardData(userId: string): Promise<ActionableDashboardData> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const reconciledDeliveries = await reconcileStaleDeliveries(now);
  const reconciledDeliveryIds = new Set(reconciledDeliveries.map((item) => item.id));

  // Get user role to determine scope
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  const hasGlobalVisibility = ['ADMIN', 'OPERATIONS'].includes(user?.role || '');

  // Build task filter - admin/manager sees all, others see assigned
  const taskWhere: any = {
    status: TaskStatus.OPEN,
  };
  if (!hasGlobalVisibility) {
    taskWhere.assigneeId = userId;
  }

  // Build order filter for orders requiring action
  const actionableOrderStatuses: OrderStatus[] = [
    'RECEIVED',
    'PROCESSING',
    'READY',
    'IN_TRANSIT',
    'INSTALLATION',
  ];

  const orderWhere: any = {
    status: { in: actionableOrderStatuses },
    deletedAt: null,
  };
  if (!hasGlobalVisibility) {
    orderWhere.OR = [{ createdByUserId: userId }, { assignedUserId: userId }];
  }

  const deliveryAttentionWhere: any = {
    AND: [buildDeliveryAttentionWhere(now)],
  };
  if (!hasGlobalVisibility) {
    deliveryAttentionWhere.AND.push({
      OR: [{ createdByUserId: userId }, { assignedUserId: userId }],
    });
  }

  const todayDeliveryWhere: any = {
    deletedAt: null,
    completedAt: null,
    status: { in: DELIVERY_FLOW_STATUSES },
    scheduledAt: { gte: todayStart, lte: todayEnd },
  };
  if (!hasGlobalVisibility) {
    todayDeliveryWhere.OR = [{ createdByUserId: userId }, { assignedUserId: userId }];
  }

  // Execute all queries in parallel
  const [tasks, orders, todayInstallations, todayDeliveries, deliveryAttentionOrders] =
    await Promise.all([
      // 1. Open Tasks
      prisma.task.findMany({
        where: taskWhere,
        orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }],
        take: 20,
        include: {
          order: {
            select: {
              id: true,
              number: true,
              customerName: true,
              customerPhone: true,
            },
          },
        },
      }),

      // 2. Orders Requiring Action
      prisma.order.findMany({
        where: orderWhere,
        orderBy: [{ updatedAt: 'asc' }],
        take: 15,
        select: {
          id: true,
          number: true,
          status: true,
          customerName: true,
          customerPhone: true,
          updatedAt: true,
          createdAt: true,
        },
      }),

      // 3. Today's Installations
      prisma.installationTask.findMany({
        where: {
          scheduledDate: { gte: todayStart, lte: todayEnd },
          status: { notIn: [InstallationTaskStatus.CANCELLED, InstallationTaskStatus.COMPLETED] },
        },
        orderBy: { scheduledDate: 'asc' },
        include: {
          technician: { select: { name: true } },
          order: {
            select: {
              id: true,
              number: true,
              customerName: true,
              customerPhone: true,
              city: true,
              addressLine: true,
              lat: true,
              lng: true,
              status: true,
            },
          },
        },
      }),

      // 4. Today's Deliveries
      prisma.order.findMany({
        where: todayDeliveryWhere,
        orderBy: [{ urgent: 'desc' }, { scheduledAt: 'asc' }],
        select: {
          id: true,
          number: true,
          customerName: true,
          customerPhone: true,
          city: true,
          addressLine: true,
          lat: true,
          lng: true,
          status: true,
          scheduledAt: true,
        },
      }),

      // 5. Deliveries requiring immediate treatment
      prisma.order.findMany({
        where: deliveryAttentionWhere,
        orderBy: [{ scheduledAt: 'asc' }],
        take: 15,
        select: {
          id: true,
          number: true,
          customerName: true,
          customerPhone: true,
          city: true,
          addressLine: true,
          lat: true,
          lng: true,
          status: true,
          scheduledAt: true,
        },
      }),
    ]);

  // ─────────────────────────────────────────────────────────────────────────
  // Transform Tasks to ActionableItems
  // ─────────────────────────────────────────────────────────────────────────

  const taskItems: ActionableItem[] = tasks.map((task) => {
    const isOverdue = task.dueAt ? task.dueAt < now : false;
    const priority = TASK_PRIORITY_MAP[task.priority] || 'MEDIUM';

    return {
      id: `task-${task.id}`,
      type: 'TASK' as const,
      priority: isOverdue ? 'URGENT' : priority,
      title: TASK_TYPE_LABELS[task.type] || 'משימה',
      description: task.notes || undefined,
      dueAt: task.dueAt,
      isOverdue,
      orderId: task.order?.id,
      orderNumber: task.order?.number,
      customerName: task.order?.customerName || undefined,
      customerPhone: task.order?.customerPhone || undefined,
      actions: buildTaskActions(task.id, task.order?.id),
      href: task.order ? `/orders/${task.order.id}` : '/tasks',
      icon: TASK_TYPE_ICONS[task.type] || 'file',
      meta: { taskId: task.id, taskType: task.type },
    };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Transform Orders to ActionableItems
  // ─────────────────────────────────────────────────────────────────────────

  const deliveryAttentionOrderIds = new Set(deliveryAttentionOrders.map((order) => order.id));

  const orderItems: ActionableItem[] = orders
    .filter((order) => !deliveryAttentionOrderIds.has(order.id))
    .map((order) => {
      const daysSinceUpdate = Math.floor(
        (now.getTime() - order.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      const isOverdue = daysSinceUpdate > 3; // Consider overdue if no action for 3+ days

      // Use i18n domain for status label
      const statusLabel = translateOrderStatus(order.status, { locale: 'he' });

      return {
        id: `order-${order.id}`,
        type: 'ORDER_ACTION' as const,
        priority: ORDER_STATUS_PRIORITY[order.status] || 'MEDIUM',
        title: statusLabel,
        description: order.customerName
          ? `${order.customerName} - הזמנה #${order.number}`
          : `הזמנה #${order.number}`,
        dueAt: null,
        isOverdue,
        orderId: order.id,
        orderNumber: order.number,
        customerName: order.customerName || undefined,
        customerPhone: order.customerPhone || undefined,
        actions: buildOrderActions(order.id, order.status),
        href: `/orders/${order.id}`,
        icon: order.status === 'PROCESSING' ? 'hourglass_empty' : 'shopping-cart',
        meta: { orderStatus: order.status, daysSinceUpdate },
      };
    });

  const deliveryItems: ActionableItem[] = deliveryAttentionOrders.map((order) => {
    const scheduledAt = order.scheduledAt ?? now;
    const customerName = order.customerName || 'לקוח';
    const autoRescheduled = reconciledDeliveryIds.has(order.id);

    return {
      id: `delivery-${order.id}`,
      type: 'DELIVERY' as const,
      priority: 'URGENT',
      title: autoRescheduled ? 'משלוח שהועבר אוטומטית להיום' : 'משלוח תקוע',
      description: autoRescheduled
        ? `${customerName} - הזמנה #${order.number} הועברה מהמועד הקודם לטיפול מיידי היום`
        : `${customerName} - הזמנה #${order.number} ממתינה לביצוע מאז ${scheduledAt.toLocaleTimeString(
            'he-IL',
            {
              hour: '2-digit',
              minute: '2-digit',
            }
          )}`,
      dueAt: scheduledAt,
      isOverdue: true,
      orderId: order.id,
      orderNumber: order.number,
      customerName,
      customerPhone: order.customerPhone || undefined,
      actions: buildDeliveryActions(order.id, order.status, order.lat, order.lng),
      href: `/deliveries?orderId=${order.id}`,
      icon: 'local_shipping',
      meta: { orderStatus: order.status, autoRescheduled },
    };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Transform Today's Schedule
  // ─────────────────────────────────────────────────────────────────────────

  const scheduleItems: TodayScheduleItem[] = [
    // Installations
    ...todayInstallations.map((inst) => ({
      id: `inst-${inst.id}`,
      type: 'INSTALLATION' as const,
      time: inst.scheduledDate,
      timeSlot: inst.timeSlot || undefined,
      customerName: inst.order.customerName || 'לקוח',
      location: inst.order.city || 'לא צוין',
      address: inst.order.addressLine || undefined,
      orderId: inst.order.id,
      orderNumber: inst.order.number,
      status: inst.status,
      // Match delivery schedule logic: overdue once scheduled time is reached (<=), not only after (<).
      isOverdue: inst.scheduledDate <= now,
      technicianName: inst.technician?.name || undefined,
      lat: inst.order.lat,
      lng: inst.order.lng,
    })),
    // Deliveries
    ...todayDeliveries.map((delivery) => ({
      id: `delivery-${delivery.id}`,
      type: 'DELIVERY' as const,
      time: delivery.scheduledAt ?? now,
      customerName: delivery.customerName || 'לקוח',
      location: delivery.city || 'לא צוין',
      address: delivery.addressLine || undefined,
      orderId: delivery.id,
      orderNumber: delivery.number,
      status: delivery.status,
      isOverdue:
        Boolean(delivery.scheduledAt && delivery.scheduledAt <= now) ||
        reconciledDeliveryIds.has(delivery.id),
      lat: delivery.lat,
      lng: delivery.lng,
    })),
  ].sort((a, b) => {
    if (Boolean(a.isOverdue) !== Boolean(b.isOverdue)) {
      return a.isOverdue ? -1 : 1;
    }
    return a.time.getTime() - b.time.getTime();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Combine and Sort All Actionable Items
  // ─────────────────────────────────────────────────────────────────────────

  const allItems = [...deliveryItems, ...taskItems, ...orderItems];

  // Sort by priority (URGENT > HIGH > MEDIUM > LOW), then by overdue, then by due date
  const priorityOrder: Record<ActionableItemPriority, number> = {
    URGENT: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  };

  allItems.sort((a, b) => {
    // Overdue items first
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    // Then by priority
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    // Then by due date (earliest first)
    if (a.dueAt && b.dueAt) return a.dueAt.getTime() - b.dueAt.getTime();
    if (a.dueAt) return -1;
    if (b.dueAt) return 1;
    return 0;
  });

  // Calculate stats
  const stats = {
    urgent: allItems.filter((i) => i.priority === 'URGENT').length,
    total: allItems.length,
    overdue: allItems.filter((i) => i.isOverdue).length,
    todayInstallations: todayInstallations.length,
    todayDeliveries: todayDeliveries.length,
  };

  return {
    actionableItems: allItems,
    todaySchedule: scheduleItems,
    stats,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Snooze/Reminder Helper
// ─────────────────────────────────────────────────────────────────────────────

export interface SnoozeRequest {
  itemId: string;
  itemType: ActionableItemType;
  snoozeUntil: Date;
  userId: string;
  orderId?: string;
}

export async function snoozeItem(
  request: SnoozeRequest
): Promise<{ success: boolean; taskId?: string }> {
  const { itemId, itemType, snoozeUntil, userId, orderId } = request;

  // Create a new task as a reminder
  const task = await prisma.task.create({
    data: {
      type: 'OTHER',
      priority: 'MEDIUM',
      status: TaskStatus.OPEN,
      assigneeId: userId,
      orderId: orderId || null,
      dueAt: snoozeUntil,
      notes: `תזכורת: ${itemType === 'TASK' ? 'משימה' : 'הזמנה'} ${itemId.replace(/^(task-|order-)/, '')}`,
    },
  });

  return { success: true, taskId: task.id };
}

// ─────────────────────────────────────────────────────────────────────────────
// Workflow Stats (Supply Chain Logic)
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkflowStats {
  payment_needed: number;
  purchasing_needed: number;
  scheduling_needed: number;
  execution_needed: number;
}

export async function getWorkflowStats(userId: string): Promise<WorkflowStats> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  const hasGlobalVisibility = ['ADMIN', 'OPERATIONS'].includes(user?.role || '');

  // Base filter for user visibility
  const baseWhere: any = { deletedAt: null };
  if (!hasGlobalVisibility) {
    baseWhere.OR = [{ createdByUserId: userId }, { assignedUserId: userId }];
  }

  // Define buckets based on status
  // 1. Payment/Call needed: Received
  const paymentStatuses: OrderStatus[] = ['RECEIVED'];

  // 2. Purchasing needed: Processing
  const purchasingStatuses: OrderStatus[] = ['PROCESSING'];

  // 3. Scheduling needed: Ready
  const schedulingStatuses: OrderStatus[] = ['READY'];

  // 4. Execution needed: In Transit, Installation
  const executionStatuses: OrderStatus[] = ['IN_TRANSIT', 'INSTALLATION'];

  // Count everything in one go using groupBy if possible, or multiple count queries.
  // GroupBy is efficient but limited in filtering complexity in Prisma sometimes.
  // We'll use count queries for simplicity and robustness.

  const [paymentCount, purchasingCount, schedulingCount, executionCount] = await Promise.all([
    prisma.order.count({
      where: {
        ...baseWhere,
        status: { in: paymentStatuses },
      },
    }),
    prisma.order.count({
      where: {
        ...baseWhere,
        status: { in: purchasingStatuses },
      },
    }),
    prisma.order.count({
      where: {
        ...baseWhere,
        status: { in: schedulingStatuses },
      },
    }),
    prisma.order.count({
      where: {
        ...baseWhere,
        status: { in: executionStatuses },
      },
    }),
  ]);

  return {
    payment_needed: paymentCount,
    purchasing_needed: purchasingCount,
    scheduling_needed: schedulingCount,
    execution_needed: executionCount,
  };
}
