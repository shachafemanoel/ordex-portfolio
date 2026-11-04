import { prisma } from '@/lib/db';
import { getStatusLabel, normalizeOrderStatus } from '@/lib/orderStatus';
import { DomainError } from '@/lib/server/errors';
import { AllocationStatus, PurchaseOrderStatus, TaskType } from '@prisma/client';

export type OpsTimelineStageKey = 'INTAKE' | 'PROCUREMENT' | 'RECEIPT' | 'SCHEDULING';
export type OpsTimelineStageState = 'DONE' | 'IN_PROGRESS' | 'PENDING' | 'SKIPPED';

export interface OpsTimelineEvent {
  id: string;
  at: string;
  stage: OpsTimelineStageKey;
  type: 'STATUS_CHANGE' | 'PURCHASE_ORDER' | 'TASK' | 'ALLOCATION' | 'SCHEDULE' | 'SYSTEM';
  title: string;
  description?: string;
  actorName?: string;
  metadata?: Record<string, unknown>;
}

export interface OpsTimelineStageSummary {
  key: OpsTimelineStageKey;
  label: string;
  state: OpsTimelineStageState;
  startedAt: string | null;
  completedAt: string | null;
  latestEventAt: string | null;
  totalEvents: number;
  nextAction: string | null;
}

export interface OpsActivityTimeline {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  version: string;
  currentStage: OpsTimelineStageKey;
  stages: OpsTimelineStageSummary[];
  events: OpsTimelineEvent[];
}

const PROCUREMENT_STATUS_SET = new Set(['PO_CREATED', 'AWAITING_STOCK']);

const RECEIPT_STATUS_SET = new Set(['PARTIALLY_SUPPLIED', 'READY_FOR_INSTALL', 'READY']);

const SCHEDULING_STATUS_SET = new Set([
  'INSTALL_SCHEDULING',
  'SCHEDULED',
  'AWAITING_INSTALL',
  'IN_TRANSIT',
  'INSTALLATION',
  'INSTALLED',
  'SUPPLIED',
  'COMPLETED',
  'CLOSED',
]);

const OPEN_PO_STATUSES = new Set<PurchaseOrderStatus>(['DRAFT', 'SENT', 'PARTIALLY_RECEIVED']);

const STAGE_LABELS: Record<OpsTimelineStageKey, string> = {
  INTAKE: 'קליטה',
  PROCUREMENT: 'רכש',
  RECEIPT: 'קבלה',
  SCHEDULING: 'תיאום',
};

function isReadyItem(item: {
  qty: number;
  received: boolean;
  receivedQuantity: number;
  allocationStatus: AllocationStatus;
}): boolean {
  return (
    item.received || item.receivedQuantity >= item.qty || item.allocationStatus === 'ALLOCATED'
  );
}

function mapStatusToStage(statusRaw: string): OpsTimelineStageKey {
  const status = normalizeOrderStatus(statusRaw);
  if (PROCUREMENT_STATUS_SET.has(status)) return 'PROCUREMENT';
  if (RECEIPT_STATUS_SET.has(status)) return 'RECEIPT';
  if (SCHEDULING_STATUS_SET.has(status)) return 'SCHEDULING';
  return 'INTAKE';
}

function mapTaskToStage(taskType: TaskType): OpsTimelineStageKey {
  if (taskType === 'STOCK_RECEIPT') return 'RECEIPT';
  if (taskType === 'INSTALL_REMINDER') return 'SCHEDULING';
  return 'INTAKE';
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function minDate(dates: Array<Date | null>): Date | null {
  const valid = dates.filter((date): date is Date => Boolean(date));
  if (valid.length === 0) return null;
  return valid.reduce((min, current) => (current.getTime() < min.getTime() ? current : min));
}

function maxDate(dates: Array<Date | null>): Date | null {
  const valid = dates.filter((date): date is Date => Boolean(date));
  if (valid.length === 0) return null;
  return valid.reduce((max, current) => (current.getTime() > max.getTime() ? current : max));
}

function normalizeStageState(input: {
  intakeDone: boolean;
  procurementStarted: boolean;
  procurementDone: boolean;
  procurementSkipped: boolean;
  receiptStarted: boolean;
  receiptDone: boolean;
  schedulingStarted: boolean;
  schedulingDone: boolean;
}): Record<OpsTimelineStageKey, OpsTimelineStageState> {
  return {
    INTAKE: input.intakeDone ? 'DONE' : 'PENDING',
    PROCUREMENT: input.procurementSkipped
      ? 'SKIPPED'
      : input.procurementDone
        ? 'DONE'
        : input.procurementStarted
          ? 'IN_PROGRESS'
          : 'PENDING',
    RECEIPT: input.receiptDone
      ? 'DONE'
      : input.receiptStarted || input.procurementStarted || input.procurementSkipped
        ? 'IN_PROGRESS'
        : 'PENDING',
    SCHEDULING: input.schedulingDone
      ? 'DONE'
      : input.schedulingStarted || input.receiptDone
        ? 'IN_PROGRESS'
        : 'PENDING',
  };
}

function currentStageFromStates(
  states: Record<OpsTimelineStageKey, OpsTimelineStageState>
): OpsTimelineStageKey {
  const order: OpsTimelineStageKey[] = ['INTAKE', 'PROCUREMENT', 'RECEIPT', 'SCHEDULING'];

  for (const stage of order) {
    if (states[stage] === 'IN_PROGRESS' || states[stage] === 'PENDING') {
      return stage;
    }
  }

  return 'SCHEDULING';
}

function nextActionForStage(
  stage: OpsTimelineStageKey,
  state: OpsTimelineStageState,
  hasSchedule: boolean
): string | null {
  if (state === 'DONE' || state === 'SKIPPED') return null;
  if (stage === 'PROCUREMENT') return 'לעדכן מקור פריט או ליצור הזמנת רכש';
  if (stage === 'RECEIPT') return 'לאשר קליטת פריטים שהגיעו';
  if (stage === 'SCHEDULING') {
    return hasSchedule ? 'לעדכן פרטי שיבוץ במידת הצורך' : 'לתאם משלוח/התקנה ללקוח';
  }
  return 'להשלים פרטי הזמנה בסיסיים';
}

export async function getOrderActivityTimeline(orderId: string): Promise<OpsActivityTimeline> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      number: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      scheduledAt: true,
      items: {
        select: {
          id: true,
          sku: true,
          name: true,
          qty: true,
          received: true,
          receivedQuantity: true,
          allocationStatus: true,
          updatedAt: true,
        },
      },
      installationTasks: {
        select: {
          id: true,
          status: true,
          createdAt: true,
          scheduledDate: true,
        },
      },
    },
  });

  if (!order) {
    throw new DomainError('order_not_found', 404, { orderId });
  }

  const itemIds = order.items.map((item) => item.id);

  const [statusHistory, purchaseOrders, tasks, auditLogs] = await Promise.all([
    prisma.statusHistory.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
      include: {
        changedByUser: {
          select: { id: true, name: true, email: true },
        },
      },
    }),
    prisma.purchaseOrder.findMany({
      where: { linkedOrderIds: { has: orderId } },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        reference: true,
        status: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        sentAt: true,
        etaDate: true,
        items: {
          select: {
            id: true,
            qtyOrdered: true,
            qtyReceived: true,
          },
        },
      },
    }),
    prisma.task.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        type: true,
        status: true,
        dueAt: true,
        notes: true,
        createdAt: true,
      },
    }),
    prisma.auditEvent.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        action: true,
        actorId: true,
        payload: true,
        diff: true,
        meta: true,
        createdAt: true,
      },
    }),
  ]);

  const actorIds = Array.from(
    new Set(auditLogs.map((entry) => entry.actorId).filter((id): id is string => Boolean(id)))
  );
  const actors =
    actorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
  const actorNameById = new Map(
    actors.map((actor) => [actor.id, actor.name || actor.email || actor.id])
  );

  const events: OpsTimelineEvent[] = [];

  for (const entry of statusHistory) {
    const stage = mapStatusToStage(entry.toStatus);
    const fromLabel = entry.fromStatus
      ? getStatusLabel(normalizeOrderStatus(entry.fromStatus))
      : null;
    const toLabel = getStatusLabel(normalizeOrderStatus(entry.toStatus));

    events.push({
      id: `status:${entry.id}`,
      at: entry.createdAt.toISOString(),
      stage,
      type: 'STATUS_CHANGE',
      title: `שינוי סטטוס: ${toLabel}`,
      description: entry.reason || (fromLabel ? `${fromLabel} → ${toLabel}` : toLabel),
      actorName: entry.changedByUser?.name || entry.changedByUser?.email || undefined,
      metadata: {
        fromStatus: entry.fromStatus,
        toStatus: entry.toStatus,
      },
    });
  }

  for (const po of purchaseOrders) {
    events.push({
      id: `po:create:${po.id}`,
      at: po.createdAt.toISOString(),
      stage: 'PROCUREMENT',
      type: 'PURCHASE_ORDER',
      title: `נוצרה הזמנת רכש ${po.reference}`,
      description: `${po.items.length} פריטים`,
      metadata: {
        purchaseOrderId: po.id,
        reference: po.reference,
        status: po.status,
      },
    });

    if (po.sentAt) {
      events.push({
        id: `po:sent:${po.id}`,
        at: po.sentAt.toISOString(),
        stage: 'PROCUREMENT',
        type: 'PURCHASE_ORDER',
        title: `הזמנת רכש ${po.reference} נשלחה לספק`,
        description: po.etaDate ? `ETA: ${po.etaDate.toLocaleDateString('he-IL')}` : undefined,
        metadata: {
          purchaseOrderId: po.id,
          reference: po.reference,
          status: 'SENT',
          etaDate: po.etaDate?.toISOString() ?? null,
        },
      });
    }

    if (po.status === 'PARTIALLY_RECEIVED' || po.status === 'RECEIVED') {
      events.push({
        id: `po:receive:${po.id}`,
        at: po.updatedAt.toISOString(),
        stage: 'RECEIPT',
        type: 'PURCHASE_ORDER',
        title:
          po.status === 'RECEIVED'
            ? `התקבלה הזמנת רכש ${po.reference}`
            : `קבלה חלקית להזמנת רכש ${po.reference}`,
        description: po.status === 'RECEIVED' ? 'כלל הפריטים התקבלו' : 'בוצעה קבלה חלקית',
        metadata: {
          purchaseOrderId: po.id,
          reference: po.reference,
          status: po.status,
        },
      });
    }
  }

  for (const task of tasks) {
    events.push({
      id: `task:${task.id}`,
      at: task.createdAt.toISOString(),
      stage: mapTaskToStage(task.type),
      type: 'TASK',
      title: `נוצרה משימה: ${task.type}`,
      description: task.notes || undefined,
      metadata: {
        taskType: task.type,
        taskStatus: task.status,
        dueAt: task.dueAt?.toISOString() ?? null,
      },
    });
  }

  for (const log of auditLogs) {
    if (log.action !== 'ORDER_ITEM_ALLOCATION_UPDATED') {
      continue;
    }

    const payload = asObject(log.payload);
    const before = asObject(log.diff); // In AuditEvent, diff might be 'before' or 'diff'
    // Correctly extract before/after from diff if it's structured that way
    // or from payload if it's there. Based on orders.ts, it follows a specific structure.
    const diff = asObject(log.diff);
    const beforeObj = diff?.before ? asObject(diff.before) : null;
    const afterObj = diff?.after ? asObject(diff.after) : null;

    const entity = typeof payload?.entity === 'string' ? payload.entity : 'order';
    const entityId = typeof payload?.entityId === 'string' ? payload.entityId : orderId;

    const afterStatus =
      typeof afterObj?.allocationStatus === 'string' ? afterObj.allocationStatus : null;
    const beforeStatus =
      typeof beforeObj?.allocationStatus === 'string' ? beforeObj.allocationStatus : null;

    const stage: OpsTimelineStageKey = afterStatus === 'ALLOCATED' ? 'RECEIPT' : 'PROCUREMENT';
    const title =
      afterStatus === 'ALLOCATED'
        ? 'פריט סומן כזמין'
        : afterStatus === 'ON_ORDER'
          ? 'פריט סומן לרכש'
          : 'עודכנה הקצאת פריט';

    events.push({
      id: `audit:${log.id}`,
      at: log.createdAt.toISOString(),
      stage,
      type: 'ALLOCATION',
      title,
      description:
        beforeStatus && afterStatus ? `${beforeStatus} → ${afterStatus}` : afterStatus || undefined,
      actorName: log.actorId ? actorNameById.get(log.actorId) : undefined,
      metadata: {
        action: log.action,
        entity,
        entityId,
        beforeStatus,
        afterStatus,
        extra: asObject(log.meta),
      },
    });
  }

  if (order.scheduledAt) {
    events.push({
      id: `schedule:order:${order.id}`,
      at: order.scheduledAt.toISOString(),
      stage: 'SCHEDULING',
      type: 'SCHEDULE',
      title: 'נקבע מועד תיאום',
      description: order.scheduledAt.toLocaleString('he-IL'),
      metadata: {
        scheduledAt: order.scheduledAt.toISOString(),
      },
    });
  }

  for (const installTask of order.installationTasks) {
    if (!installTask.scheduledDate) continue;
    events.push({
      id: `schedule:task:${installTask.id}`,
      at: installTask.scheduledDate.toISOString(),
      stage: 'SCHEDULING',
      type: 'SCHEDULE',
      title: 'שיבוץ משימת התקנה',
      description: installTask.scheduledDate.toLocaleString('he-IL'),
      metadata: {
        installationTaskId: installTask.id,
        installationTaskStatus: installTask.status,
      },
    });
  }

  events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const totalItems = order.items.length;
  const readyItems = order.items.filter(isReadyItem).length;
  const allItemsReady = totalItems === 0 ? true : readyItems === totalItems;
  const anyItemsReady = readyItems > 0;
  const anyOnOrder = order.items.some((item) => item.allocationStatus === 'ON_ORDER');
  const hasSchedule = Boolean(
    order.scheduledAt || order.installationTasks.some((task) => Boolean(task.scheduledDate))
  );
  const hasPurchaseOrders = purchaseOrders.length > 0;
  const hasOpenPurchaseOrders = purchaseOrders.some((po) => OPEN_PO_STATUSES.has(po.status));
  const statusSignals = statusHistory.map((entry) => normalizeOrderStatus(entry.toStatus));

  const states = normalizeStageState({
    intakeDone: true,
    procurementStarted:
      hasPurchaseOrders ||
      anyOnOrder ||
      statusSignals.some((status) => PROCUREMENT_STATUS_SET.has(status)),
    procurementDone:
      (hasPurchaseOrders && !hasOpenPurchaseOrders && !anyOnOrder) ||
      (!hasPurchaseOrders && !anyOnOrder && allItemsReady),
    procurementSkipped: !hasPurchaseOrders && !anyOnOrder && allItemsReady,
    receiptStarted:
      anyItemsReady ||
      purchaseOrders.some((po) => po.status === 'PARTIALLY_RECEIVED' || po.status === 'RECEIVED') ||
      statusSignals.some((status) => RECEIPT_STATUS_SET.has(status)),
    receiptDone: allItemsReady,
    schedulingStarted:
      hasSchedule || statusSignals.some((status) => SCHEDULING_STATUS_SET.has(status)),
    schedulingDone: hasSchedule,
  });

  const eventsByStage = events.reduce(
    (acc, event) => {
      acc[event.stage].push(event);
      return acc;
    },
    {
      INTAKE: [] as OpsTimelineEvent[],
      PROCUREMENT: [] as OpsTimelineEvent[],
      RECEIPT: [] as OpsTimelineEvent[],
      SCHEDULING: [] as OpsTimelineEvent[],
    }
  );

  const firstPOCreatedAt = minDate(purchaseOrders.map((po) => po.createdAt));
  const lastPOUpdatedAt = maxDate(purchaseOrders.map((po) => po.updatedAt));
  const readyItemUpdatedAt = maxDate(order.items.filter(isReadyItem).map((item) => item.updatedAt));
  const earliestReadyItemUpdateAt = minDate(
    order.items.filter(isReadyItem).map((item) => item.updatedAt)
  );
  const scheduleDate = minDate([
    order.scheduledAt,
    ...order.installationTasks.map((task) => task.scheduledDate),
  ]);

  const stages: OpsTimelineStageSummary[] = (
    ['INTAKE', 'PROCUREMENT', 'RECEIPT', 'SCHEDULING'] as OpsTimelineStageKey[]
  ).map((stageKey) => {
    const stageEvents = eventsByStage[stageKey]
      .slice()
      .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    const firstEventAt = toDate(stageEvents[0]?.at);
    const lastEventAt = toDate(stageEvents[stageEvents.length - 1]?.at);

    const fallbackStartedAt =
      stageKey === 'INTAKE'
        ? order.createdAt
        : stageKey === 'PROCUREMENT'
          ? firstPOCreatedAt
          : stageKey === 'RECEIPT'
            ? earliestReadyItemUpdateAt
            : scheduleDate;

    const fallbackCompletedAt =
      stageKey === 'INTAKE'
        ? order.createdAt
        : stageKey === 'PROCUREMENT'
          ? lastPOUpdatedAt
          : stageKey === 'RECEIPT'
            ? readyItemUpdatedAt
            : scheduleDate;

    const state = states[stageKey];
    const startedAt = minDate([firstEventAt, fallbackStartedAt]);
    const completedAt =
      state === 'DONE'
        ? maxDate([lastEventAt, fallbackCompletedAt])
        : state === 'SKIPPED'
          ? null
          : null;

    return {
      key: stageKey,
      label: STAGE_LABELS[stageKey],
      state,
      startedAt: startedAt?.toISOString() ?? null,
      completedAt: completedAt?.toISOString() ?? null,
      latestEventAt: lastEventAt?.toISOString() ?? null,
      totalEvents: stageEvents.length,
      nextAction: nextActionForStage(stageKey, state, hasSchedule),
    };
  });

  return {
    orderId: order.id,
    orderNumber: order.number,
    orderStatus: order.status,
    version: order.updatedAt.toISOString(),
    currentStage: currentStageFromStates(states),
    stages,
    events,
  };
}
