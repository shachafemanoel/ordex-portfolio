import {
  UNIFIED_ORDER_INCLUDE,
  getUnifiedOrder,
  mapOrderToUnified,
  upsertUnifiedOrder,
} from '@/lib/data/ordersRedis';
import { prisma } from '@/lib/db';
import { publishOpsRealtimeEvent } from '@/lib/ops/realtime';
import { MVP_FLOW_STATUSES, normalizeOrderStatus } from '@/lib/orderStatus';
import { buildOrderSnapshot } from '@/lib/orders/rules/orderSnapshot';
import { redis } from '@/lib/redis';
import { enqueueOpsReminderJobsForOrder } from '@/lib/services/ops/opsRemindersQueue';
import { computeDrillState } from '@/lib/services/orders-ops';
import { validateTransition } from '@/lib/status-machine';
import {
  OrderStatus,
  PaymentStatus,
  Prisma,
  PurchaseOrderStatus,
  TaskPriority,
  TaskStatus,
  TaskType,
} from '@prisma/client';

export interface StatusComputationSnapshot {
  orderId: string;
  previousStatus: OrderStatus;
  nextStatus: OrderStatus;
  changed: boolean;
  reason?: string;
  blockers?: string[];
}

interface OperationalSyncResult {
  orderId: string;
  previousStatus: OrderStatus;
  nextStatus: OrderStatus;
  opsLane: string;
  opsCurrentTask: string;
  changed: boolean;
}

type OpsDerivationOrder = Prisma.OrderGetPayload<{
  include: {
    customer: true;
    items: true;
    installationTasks: true;
    payments: true;
    shippingAddress: true;
    calendarEvents: true;
  };
}>;

const OPEN_PURCHASE_ORDER_STATUSES = new Set([
  'DRAFT',
  'SENT',
  'PARTIALLY_RECEIVED',
  'OPEN',
  'PARTIAL',
]);

function hasOpenPurchaseOrder(purchaseOrders: Array<{ status: string }>): boolean {
  return purchaseOrders.some((purchaseOrder) =>
    OPEN_PURCHASE_ORDER_STATUSES.has(String(purchaseOrder.status).toUpperCase())
  );
}

function isOpenPurchaseOrderStatus(status: string): boolean {
  return OPEN_PURCHASE_ORDER_STATUSES.has(String(status).toUpperCase());
}

type RelatedPurchaseOrder = {
  id: string;
  status: PurchaseOrderStatus;
  linkedOrderIds: string[] | null;
  reference: string | null;
  etaDate: Date | null;
};

async function findRelatedPurchaseOrders(orderId: string): Promise<RelatedPurchaseOrder[]> {
  const purchaseOrderDelegate = (prisma as any).purchaseOrder;

  if (purchaseOrderDelegate?.findMany) {
    try {
      return await purchaseOrderDelegate.findMany({
        where: { linkedOrderIds: { has: orderId } },
        select: { id: true, status: true, linkedOrderIds: true, reference: true, etaDate: true },
      });
    } catch (error) {
      console.warn(
        '[statusRecalculation] purchaseOrder delegate query failed, trying raw fallback',
        error
      );
    }
  }

  try {
    return (await prisma.$queryRaw<any[]>`
      SELECT
        id::text AS id,
        status::text AS status,
        linked_order_ids::text[] AS "linkedOrderIds",
        reference,
        eta_date AS "etaDate"
      FROM purchase_orders
      WHERE ${orderId}::uuid = ANY(COALESCE(linked_order_ids, ARRAY[]::uuid[]))
    `) as RelatedPurchaseOrder[];
  } catch (error) {
    console.warn(
      '[statusRecalculation] purchaseOrder delegate unavailable and fallback query failed',
      error
    );
    return [];
  }
}

function datesEqual(a: Date | null | undefined, b: Date | null | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.getTime() === b.getTime();
}

function normalizeChecklistState(
  raw: Prisma.JsonValue | null
): Record<string, Record<string, boolean>> | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }

  const normalized: Record<string, Record<string, boolean>> = {};

  for (const [taskKey, steps] of Object.entries(raw as Record<string, unknown>)) {
    if (!steps || typeof steps !== 'object' || Array.isArray(steps)) {
      continue;
    }

    const stepState: Record<string, boolean> = {};
    for (const [stepKey, value] of Object.entries(steps as Record<string, unknown>)) {
      if (typeof value === 'boolean') {
        stepState[stepKey] = value;
      }
    }

    if (Object.keys(stepState).length > 0) {
      normalized[taskKey] = stepState;
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
}

async function closeOpenTasksForType(orderId: string, type: TaskType): Promise<void> {
  await prisma.task.updateMany({
    where: {
      orderId,
      type,
      status: TaskStatus.OPEN,
    },
    data: {
      status: TaskStatus.DONE,
    },
  });
}

async function upsertOpenTaskForOrder({
  orderId,
  type,
  dueAt,
  priority,
  notes,
  payload,
}: {
  orderId: string;
  type: TaskType;
  dueAt: Date;
  priority: TaskPriority;
  notes: string;
  payload: Prisma.InputJsonValue;
}): Promise<void> {
  const existingTask = await prisma.task.findFirst({
    where: {
      orderId,
      type,
      status: TaskStatus.OPEN,
    },
    select: {
      id: true,
      dueAt: true,
      priority: true,
      notes: true,
      payload: true,
    },
  });

  if (existingTask) {
    const updates: Prisma.TaskUpdateInput = {};

    if (!datesEqual(existingTask.dueAt, dueAt)) {
      updates.dueAt = dueAt;
    }
    if (existingTask.priority !== priority) {
      updates.priority = priority;
    }
    if ((existingTask.notes || '') !== notes) {
      updates.notes = notes;
    }
    updates.payload = payload;

    await prisma.task.update({
      where: { id: existingTask.id },
      data: updates,
    });
    return;
  }

  await prisma.task.create({
    data: {
      orderId,
      type,
      status: TaskStatus.OPEN,
      priority,
      dueAt,
      notes,
      payload,
    },
  });
}

async function syncOrderReminderTasks(input: {
  orderId: string;
  scheduledAt: Date | null;
  items: Array<
    Pick<
      OpsDerivationOrder['items'][number],
      'qty' | 'received' | 'receivedQuantity' | 'allocationStatus'
    >
  >;
  purchaseOrders: Array<{
    id: string;
    status: string;
    reference?: string | null;
    etaDate?: Date | null;
  }>;
}): Promise<void> {
  const { orderId, scheduledAt, items, purchaseOrders } = input;
  const now = new Date();

  const openPurchaseOrders = purchaseOrders.filter((po) => isOpenPurchaseOrderStatus(po.status));
  const pendingItems = items.filter((item) => !isReadyItem(item)).length;

  const shouldTrackStockReceipt = openPurchaseOrders.length > 0 && pendingItems > 0;

  if (shouldTrackStockReceipt) {
    const nextEta =
      openPurchaseOrders
        .map((po) => po.etaDate ?? null)
        .filter((value): value is Date => Boolean(value))
        .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

    const receiptDueAt = nextEta ?? new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const etaOverdue = Boolean(nextEta && nextEta.getTime() < now.getTime());
    const poRefs = openPurchaseOrders
      .map((po) => po.reference)
      .filter((value): value is string => Boolean(value));

    await upsertOpenTaskForOrder({
      orderId,
      type: TaskType.STOCK_RECEIPT,
      dueAt: receiptDueAt,
      priority: etaOverdue ? TaskPriority.URGENT : TaskPriority.MEDIUM,
      notes: etaOverdue
        ? `רכש באיחור${poRefs.length > 0 ? ` (${poRefs.join(', ')})` : ''} - נדרש מעקב קבלה`
        : nextEta
          ? `מעקב קבלת פריטים מרכש (ETA: ${nextEta.toLocaleDateString('he-IL')})`
          : 'מעקב קבלת פריטים מרכש (חסר ETA)',
      payload: {
        source: 'syncOrderOperationalState',
        flow: 'procurement',
        etaDate: nextEta ? nextEta.toISOString() : null,
        purchaseOrderRefs: poRefs,
        pendingItems,
      },
    });
  } else {
    await closeOpenTasksForType(orderId, TaskType.STOCK_RECEIPT);
  }

  if (scheduledAt) {
    const reminderDueAt = new Date(scheduledAt.getTime() - 24 * 60 * 60 * 1000);
    const dueAt = reminderDueAt.getTime() > now.getTime() ? reminderDueAt : now;

    await upsertOpenTaskForOrder({
      orderId,
      type: TaskType.INSTALL_REMINDER,
      dueAt,
      priority: dueAt.getTime() <= now.getTime() ? TaskPriority.HIGH : TaskPriority.MEDIUM,
      notes: `תזכורת לאספקה/התקנה עבור ${scheduledAt.toLocaleString('he-IL')}`,
      payload: {
        source: 'syncOrderOperationalState',
        flow: 'delivery_schedule',
        scheduledAt: scheduledAt.toISOString(),
      },
    });
  } else {
    await closeOpenTasksForType(orderId, TaskType.INSTALL_REMINDER);
  }
}

function isReadyItem(
  item: Pick<
    OpsDerivationOrder['items'][number],
    'qty' | 'received' | 'receivedQuantity' | 'allocationStatus'
  >
): boolean {
  const receivedQty = item.receivedQuantity ?? 0;
  return item.received || receivedQty >= item.qty || item.allocationStatus === 'ALLOCATED';
}

/**
 * Derive the canonical next status for an order based on business signals.
 * This is intentionally side‑effect free so it can be unit‑tested.
 */
export function deriveStatusFromSnapshot(
  order: Prisma.OrderGetPayload<{
    include: {
      customer: true;
      items: true;
      installationTasks: true;
      payments: true;
      shippingAddress: true;
    };
  }>,
  purchaseOrders: { id: string; status: string }[] = []
): { target: OrderStatus; reason?: string; blockers?: string[] } {
  const normalizedCurrent = normalizeOrderStatus(order.status);
  const blockers: string[] = [];
  const customerName = order.customerName || order.customer?.name || '';
  const customerPhone = order.customerPhone || order.customer?.phone || '';

  // Terminal states stay as‑is
  if (normalizedCurrent === 'CANCELLED' || normalizedCurrent === 'COMPLETED') {
    return { target: normalizedCurrent };
  }

  // 1) Required customer/contact data
  if (!customerName || !customerPhone) {
    blockers.push('missing_contact');
    return { target: 'CALL_BACK', reason: 'חסרים פרטי לקוח' };
  }

  // 2) Required address
  const hasAddress =
    Boolean(order.city) ||
    Boolean(
      order.shippingAddress &&
      order.shippingAddress.city &&
      order.shippingAddress.street &&
      order.shippingAddress.number
    );
  if (!hasAddress) {
    blockers.push('missing_address');
    return { target: 'CALL_BACK', reason: 'חסרה כתובת מלאה' };
  }

  // 3) Items and receipts
  const items = order.items || [];
  const totalQty = items.reduce((acc, item) => acc + (item.qty || 0), 0);
  const receivedQty = items.reduce(
    (acc, item) =>
      acc +
      Math.min(
        item.receivedQuantity ||
          (item.received || item.allocationStatus === 'ALLOCATED' ? item.qty : 0) ||
          0,
        item.qty || 0
      ),
    0
  );
  const allItemsReceived = totalQty > 0 && receivedQty >= totalQty;
  const anyItemsReceived = receivedQty > 0;
  const hasItems = totalQty > 0;
  const hasOpenPurchaseOrders = hasOpenPurchaseOrder(purchaseOrders);

  // 4) Scheduling
  const scheduledAt = order.scheduledAt || order.installationTasks?.[0]?.scheduledDate || null;
  const hasAssignee =
    Boolean(order.assignedUserId) ||
    Boolean(order.installationTasks?.[0]?.technicianId) ||
    Boolean(order.installerName);

  // Completion marker
  if (order.completedAt) {
    return { target: 'COMPLETED', reason: 'ההזמנה סומנה כהושלמה' };
  }

  if (normalizedCurrent === 'IN_TRANSIT' || normalizedCurrent === 'INSTALLATION') {
    return {
      target: normalizedCurrent,
      reason: 'האספקה כבר החלה ונמצאת בביצוע',
    };
  }

  const preserveAwaitingInstall =
    scheduledAt &&
    normalizedCurrent === 'AWAITING_INSTALL' &&
    order.fulfillmentType === 'INSTALLATION';

  if (scheduledAt && (normalizedCurrent === 'SCHEDULED' || preserveAwaitingInstall)) {
    return {
      target: normalizedCurrent === 'AWAITING_INSTALL' ? 'AWAITING_INSTALL' : 'SCHEDULED',
      reason:
        normalizedCurrent === 'AWAITING_INSTALL'
          ? 'מועד ההתקנה נשמר וההזמנה ממתינה לביצוע'
          : 'מועד האספקה נשמר וההזמנה נמצאת במסלול משלוח',
    };
  }

  // Determine target based on stock flow
  if (hasItems) {
    if (!allItemsReceived) {
      if (anyItemsReceived) {
        return {
          target: 'PARTIALLY_SUPPLIED',
          reason: scheduledAt ? 'סופק חלקית (המשלוח כבר תואם)' : 'סופק חלקית',
        };
      }
      // No receipts yet
      if (hasOpenPurchaseOrders) {
        return {
          target: 'AWAITING_STOCK',
          reason: scheduledAt
            ? 'ממתין לקבלת סחורה מהספק (המשלוח כבר תואם)'
            : 'ממתין לקבלת סחורה מהספק',
        };
      }
      return {
        target: 'PO_CREATED',
        reason: scheduledAt ? 'נדרשת הזמנת רכש לספק (המשלוח כבר תואם)' : 'נדרשת הזמנת רכש לספק',
      };
    }
  }

  // All items in stock
  if (allItemsReceived || !hasItems) {
    if (scheduledAt) {
      return {
        target: 'SCHEDULED',
        reason: hasAssignee ? 'נקבע מועד והוקצה מתקין/נהג' : 'נקבע מועד אספקה',
      };
    }

    return {
      target: 'READY_FOR_INSTALL',
      reason: 'כל הפריטים זמינים - יש לתאם התקנה/אספקה',
    };
  }

  // Default fallback
  return {
    target: normalizedCurrent === 'DRAFT' ? 'TO_DO' : normalizedCurrent,
    reason: 'ללא שינוי',
  };
}

/**
 * Recompute and persist the operational state after user actions.
 * Keeps status + ops lane/task synchronized in one place.
 */
export async function syncOrderOperationalState(
  orderId: string,
  options: { actorId?: string; reason?: string } = {}
): Promise<OperationalSyncResult | null> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      items: true,
      installationTasks: true,
      payments: true,
      shippingAddress: true,
      calendarEvents: true,
    },
  });

  if (!order) {
    return null;
  }

  const relatedPurchaseOrders = await findRelatedPurchaseOrders(orderId);

  const derived = deriveStatusFromSnapshot(order, relatedPurchaseOrders);
  const nextStatus = MVP_FLOW_STATUSES.has(order.status) ? order.status : derived.target;
  const reason = derived.reason;

  const snapshot = buildOrderSnapshot({
    ...order,
    status: nextStatus,
    relatedPurchaseOrders,
  });

  const drillState = computeDrillState({
    snapshot,
    opsChecklistState: normalizeChecklistState(order.opsChecklistState),
    opsSnoozeUntil: order.opsSnoozeUntil,
    opsSnoozeReason: order.opsSnoozeReason,
  });

  const statusChanged = order.status !== nextStatus;
  const opsStateChanged =
    order.opsLane !== drillState.lane ||
    order.opsCurrentTask !== drillState.currentTask.taskLabel ||
    order.deferBucket !== drillState.deferBucket;
  const now = new Date();
  const updateData: Prisma.OrderUpdateInput = {
    opsLane: drillState.lane,
    opsCurrentTask: drillState.currentTask.taskLabel,
    taskLabel: drillState.currentTask.taskLabel,
    opsStatus: drillState.currentTask.taskLabel,
    deferBucket: drillState.deferBucket,
    lastActionAt: now,
  };

  if (statusChanged) {
    updateData.status = nextStatus;
    updateData.statusV2 = normalizeOrderStatus(nextStatus);
    updateData.statusUpdatedAt = now;
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: updateData,
    });

    if (statusChanged) {
      await tx.statusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: nextStatus,
          changedBy: options.actorId || null,
          reason: options.reason || reason,
          metadata: {
            auto: true,
            source: 'syncOrderOperationalState',
            recomputedAt: now.toISOString(),
            opsStateChanged,
          },
        },
      });
    } else if (options.reason || opsStateChanged) {
      await tx.statusHistory.create({
        data: {
          orderId,
          fromStatus: order.status,
          toStatus: order.status,
          changedBy: options.actorId || null,
          reason: options.reason || 'עדכון מצב תפעולי',
          metadata: {
            auto: true,
            source: 'syncOrderOperationalState',
            eventOnly: true,
            opsStateChanged,
            previousOpsLane: order.opsLane,
            nextOpsLane: drillState.lane,
            previousTask: order.opsCurrentTask,
            nextTask: drillState.currentTask.taskLabel,
            recomputedAt: now.toISOString(),
          },
        },
      });
    }
  });

  const effectiveScheduledAt =
    order.scheduledAt || order.installationTasks?.[0]?.scheduledDate || null;
  try {
    await syncOrderReminderTasks({
      orderId,
      scheduledAt: effectiveScheduledAt,
      items: order.items,
      purchaseOrders: relatedPurchaseOrders,
    });
  } catch (error) {
    console.warn('[syncOrderOperationalState] Failed to synchronize reminder tasks', error);
  }

  try {
    await enqueueOpsReminderJobsForOrder(orderId, options.reason);
  } catch (error) {
    console.warn('[syncOrderOperationalState] Failed to enqueue ops reminders', error);
  }

  try {
    const unifiedSource = await prisma.order.findUnique({
      where: { id: orderId },
      include: UNIFIED_ORDER_INCLUDE,
    });
    if (unifiedSource) {
      await upsertUnifiedOrder(mapOrderToUnified(unifiedSource as any));
    }
  } catch (error) {
    console.warn('[syncOrderOperationalState] Failed to refresh Redis snapshot', error);
  }

  try {
    await publishOpsRealtimeEvent({
      type: 'order.updated',
      orderId,
      scopes: ['orders', 'today', 'deliveries'],
      payload: {
        orderId,
        status: nextStatus,
        previousStatus: order.status,
        opsLane: drillState.lane,
        taskLabel: drillState.currentTask.taskLabel,
        changed: statusChanged,
        reason: options.reason || reason || null,
      },
    });
    await publishOpsRealtimeEvent({
      type: 'timeline.updated',
      orderId,
      scopes: ['orders', 'today', 'deliveries'],
      payload: {
        orderId,
        reason: options.reason || reason || null,
        at: now.toISOString(),
      },
    });
  } catch (error) {
    console.warn('[syncOrderOperationalState] Failed to publish realtime event', error);
  }

  return {
    orderId,
    previousStatus: order.status,
    nextStatus,
    opsLane: drillState.lane,
    opsCurrentTask: drillState.currentTask.taskLabel,
    changed: statusChanged,
  };
}

/**
 * Recalculate order status and persist (Prisma + Redis).
 */
export async function recalculateOrderStatus(
  orderId: string,
  options: { actorId?: string; reason?: string } = {}
): Promise<StatusComputationSnapshot | null> {
  let order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      items: true,
      installationTasks: true,
      payments: true,
      shippingAddress: true,
    },
  });

  let usingRedisOnly = false;

  // Fallback to Redis snapshot if Prisma row is missing (Redis is source of truth)
  if (!order) {
    const unified = await getUnifiedOrder(orderId);
    if (!unified) return null;
    usingRedisOnly = true;
    order = {
      id: unified.id,
      status: unified.status as OrderStatus,
      totalCents: unified.totalAmountCents,
      paidAmountCents: 0,
      paymentStatus: PaymentStatus.PENDING,
      customerName: unified.customer?.name ?? '',
      customerPhone: unified.customer?.phone ?? '',
      city: unified.shippingAddress?.city ?? '',
      scheduledAt: unified.installation?.scheduledAt
        ? new Date(unified.installation.scheduledAt)
        : null,
      assignedUserId: unified.assignedUserId ?? null,
      completedAt: null,
      items: (unified.items || []).map((i: any, idx: number) => ({
        id: i.id ?? `idx-${idx}`,
        qty: i.qty ?? i.quantity ?? 0,
        receivedQuantity: i.receivedQuantity ?? (i.received ? i.qty : 0) ?? 0,
        received: Boolean(i.received),
      })),
      installationTasks: unified.installation
        ? [
            {
              id: unified.installation.id,
              scheduledDate: unified.installation.scheduledAt
                ? new Date(unified.installation.scheduledAt)
                : null,
              technicianId: unified.installation.installerId ?? null,
            },
          ]
        : [],
      payments: [],
      shippingAddress: {
        id: unified.shippingAddressId,
        city: unified.shippingAddress?.city ?? '',
        street: unified.shippingAddress?.street ?? '',
        number: '',
        createdAt: new Date(),
        updatedAt: new Date(),
        customerId: unified.customerId,
        type: 'SHIPPING' as any,
        demo: false,
        floor: null,
        lat: unified.shippingAddress?.lat ?? null,
        lng: unified.shippingAddress?.lng ?? null,
      } as any,
    } as any;
  }
  if (!order) {
    return null;
  }

  const purchaseOrders = await findRelatedPurchaseOrders(orderId);

  const currentStatus = normalizeOrderStatus(order.status);
  const { target, reason, blockers } = deriveStatusFromSnapshot(order, purchaseOrders);
  const nextStatus = MVP_FLOW_STATUSES.has(currentStatus) ? currentStatus : normalizeOrderStatus(target);

  if (nextStatus === currentStatus) {
    return {
      orderId,
      previousStatus: currentStatus,
      nextStatus,
      changed: false,
      reason,
      blockers,
    };
  }

  const validation = validateTransition(currentStatus, nextStatus);
  if (!validation.allowed) {
    // Do not perform invalid jumps; return info for debugging
    return {
      orderId,
      previousStatus: currentStatus,
      nextStatus: currentStatus,
      changed: false,
      reason: `Transition blocked: ${validation.reason}`,
      blockers,
    };
  }

  let updated: any = order;

  if (usingRedisOnly) {
    // Update Redis snapshot only
    try {
      await upsertUnifiedOrder({
        ...(await getUnifiedOrder(orderId))!,
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      });
      // Log to Redis history stream for visibility
      if (redis) {
        await redis.xAdd(`ordex:order:${orderId}:history`, '*', {
          status: nextStatus,
          note: options.reason || reason || 'עדכון אוטומטי',
          userId: options.actorId || '',
          timestamp: String(Date.now()),
        });
      }
    } catch (err) {
      console.warn('[recalculateOrderStatus] Failed Redis-only status update', err);
      console.error(err);
    }
  } else {
    updated = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: nextStatus,
        statusV2: nextStatus,
        statusUpdatedAt: new Date(),
      },
    });

    await prisma.statusHistory.create({
      data: {
        orderId,
        fromStatus: currentStatus,
        toStatus: nextStatus,
        changedBy: options.actorId || null,
        reason: options.reason || reason || 'עדכון אוטומטי',
        metadata: {
          auto: true,
          blockers,
          recomputedAt: new Date().toISOString(),
        },
      },
    });

    try {
      const unifiedSource = await prisma.order.findUnique({
        where: { id: orderId },
        include: UNIFIED_ORDER_INCLUDE,
      });
      if (unifiedSource) {
        await upsertUnifiedOrder(mapOrderToUnified(unifiedSource as any));
      }
    } catch (err) {
      console.warn('[recalculateOrderStatus] Failed to refresh Redis snapshot', err);
      console.error(err);
    }
  }

  return {
    orderId,
    previousStatus: currentStatus,
    nextStatus,
    changed: true,
    reason,
    blockers,
  };
}
