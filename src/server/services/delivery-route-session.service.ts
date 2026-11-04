import { Prisma } from '@prisma/client';

import {
  deliveryRouteGroupSummarySchema,
  normalizeDeliveryRouteCoordinates,
  normalizeDeliverySessionStops,
  normalizeStringArray,
  startDeliveryRouteSessionSchema,
  type DeliveryRouteSessionData,
  type DeliverySessionStopSnapshot,
  type DeliveryRouteGroupSummarySnapshot,
  updateDeliveryRouteSessionSchema,
} from '@/lib/delivery-route-session';
import { prisma } from '@/lib/db';

const deliveryRouteSessionSelect = {
  id: true,
  workerId: true,
  routeDateKey: true,
  status: true,
  sourceRouteGroupId: true,
  routeLabel: true,
  routeColor: true,
  routeWorkerIndex: true,
  routeSummary: true,
  routeCoordinates: true,
  stopsSnapshot: true,
  queueOrderIds: true,
  completedOrderIds: true,
  deferredOrderIds: true,
  arrivedOrderIds: true,
  currentOrderId: true,
  lastKnownLat: true,
  lastKnownLng: true,
  lastLocationAccuracyM: true,
  lastLocationAt: true,
  startedAt: true,
  lastActivityAt: true,
  completedAt: true,
  releasedAt: true,
} satisfies Prisma.DeliveryRouteSessionSelect;

type DeliveryRouteSessionRecord = Prisma.DeliveryRouteSessionGetPayload<{
  select: typeof deliveryRouteSessionSelect;
}>;

const MISSING_DELIVERY_ROUTE_SESSION_STORAGE_MESSAGE =
  'חסרה מיגרציית DeliveryRouteSession במסד הנתונים. יש להחיל את prisma/migrations/20260324090000_add_delivery_route_sessions.';

function dedupeIds(value: string[]): string[] {
  return Array.from(new Set(value));
}

function normalizeRouteSummary(value: unknown): DeliveryRouteGroupSummarySnapshot | null {
  const parsed = deliveryRouteGroupSummarySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function buildQueue(
  stops: DeliverySessionStopSnapshot[],
  queueOrderIds: string[]
): DeliverySessionStopSnapshot[] {
  const stopById = new Map(stops.map((stop) => [stop.id, stop]));
  return queueOrderIds
    .map((orderId) => stopById.get(orderId) ?? null)
    .filter((stop): stop is DeliverySessionStopSnapshot => stop !== null);
}

function serializeDeliveryRouteSession(
  record: DeliveryRouteSessionRecord
): DeliveryRouteSessionData {
  const stops = normalizeDeliverySessionStops(record.stopsSnapshot);
  const queueOrderIds = normalizeStringArray(record.queueOrderIds);
  const completedOrderIds = normalizeStringArray(record.completedOrderIds);
  const deferredOrderIds = normalizeStringArray(record.deferredOrderIds);
  const arrivedOrderIds = normalizeStringArray(record.arrivedOrderIds);
  const queue = buildQueue(stops, queueOrderIds);
  const currentStop = queue[0] ?? null;

  return {
    id: record.id,
    status: record.status,
    routeDateKey: record.routeDateKey ?? null,
    routeGroup: {
      id: record.sourceRouteGroupId ?? record.id,
      label: record.routeLabel,
      color: record.routeColor ?? null,
      workerIndex: record.routeWorkerIndex ?? null,
      items: stops,
      routeCoordinates: normalizeDeliveryRouteCoordinates(record.routeCoordinates),
      summary: normalizeRouteSummary(record.routeSummary),
    },
    queueOrderIds,
    queue,
    completedOrderIds,
    deferredOrderIds,
    arrivedOrderIds,
    currentOrderId: record.currentOrderId ?? null,
    currentStop,
    lastKnownLocation:
      typeof record.lastKnownLat === 'number' && typeof record.lastKnownLng === 'number'
        ? {
            lat: record.lastKnownLat,
            lng: record.lastKnownLng,
            accuracyMeters: record.lastLocationAccuracyM ?? null,
            recordedAt: record.lastLocationAt?.toISOString() ?? null,
          }
        : null,
    startedAt: record.startedAt.toISOString(),
    lastActivityAt: record.lastActivityAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
    releasedAt: record.releasedAt?.toISOString() ?? null,
  };
}

function mapDeliveryRouteSessionStorageError(error: unknown): Error {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === 'P2021' || error.code === 'P2022')
  ) {
    return new Error(MISSING_DELIVERY_ROUTE_SESSION_STORAGE_MESSAGE);
  }

  const message = error instanceof Error ? error.message : String(error);
  if (/delivery_route_sessions|DeliveryRouteSessionStatus/i.test(message)) {
    return new Error(MISSING_DELIVERY_ROUTE_SESSION_STORAGE_MESSAGE);
  }

  return error instanceof Error ? error : new Error(message);
}

async function findActiveSessionRecord(workerId: string) {
  try {
    return prisma.deliveryRouteSession.findFirst({
      where: {
        workerId,
        status: 'ACTIVE',
      },
      orderBy: {
        startedAt: 'desc',
      },
      select: deliveryRouteSessionSelect,
    });
  } catch (error) {
    throw mapDeliveryRouteSessionStorageError(error);
  }
}

export async function getActiveDeliveryRouteSession(workerId: string) {
  const record = await findActiveSessionRecord(workerId);
  return record ? serializeDeliveryRouteSession(record) : null;
}

export async function startDeliveryRouteSession(workerId: string, input: unknown) {
  const parsed = startDeliveryRouteSessionSchema.parse(input);
  const queueOrderIds = parsed.routeGroup.items.map((item) => item.id);
  const now = new Date();

  try {
    const [, record] = await prisma.$transaction(async (tx) => Promise.all([
      tx.deliveryRouteSession.updateMany({
        where: {
          workerId,
          status: 'ACTIVE',
        },
        data: {
          status: 'SUPERSEDED',
          releasedAt: now,
          lastActivityAt: now,
        },
      }),
      tx.deliveryRouteSession.create({
        data: {
          workerId,
          routeDateKey: parsed.routeDateKey ?? null,
          sourceRouteGroupId: parsed.routeGroup.id,
          routeLabel: parsed.routeGroup.label,
          routeColor: parsed.routeGroup.color ?? null,
          routeWorkerIndex: parsed.routeGroup.workerIndex ?? null,
          routeSummary: parsed.routeGroup.summary
            ? (parsed.routeGroup.summary as Prisma.InputJsonValue)
            : undefined,
          routeCoordinates: parsed.routeGroup.routeCoordinates.length
            ? (parsed.routeGroup.routeCoordinates as Prisma.InputJsonValue)
            : undefined,
          stopsSnapshot: parsed.routeGroup.items as Prisma.InputJsonValue,
          queueOrderIds: queueOrderIds as Prisma.InputJsonValue,
          completedOrderIds: [] as Prisma.InputJsonValue,
          deferredOrderIds: [] as Prisma.InputJsonValue,
          arrivedOrderIds: [] as Prisma.InputJsonValue,
          currentOrderId: queueOrderIds[0] ?? null,
          startedAt: now,
          lastActivityAt: now,
        },
        select: deliveryRouteSessionSelect,
      }),
    ]));

    return serializeDeliveryRouteSession(record);
  } catch (error) {
    throw mapDeliveryRouteSessionStorageError(error);
  }
}

export async function updateActiveDeliveryRouteSession(workerId: string, input: unknown) {
  const parsed = updateDeliveryRouteSessionSchema.parse(input);
  const session = await findActiveSessionRecord(workerId);

  if (!session) {
    throw new Error('לא נמצא מסלול פעיל לעובד הזה');
  }

  const now = new Date();
  const stops = normalizeDeliverySessionStops(session.stopsSnapshot);
  const stopIds = new Set(stops.map((stop) => stop.id));
  const queueOrderIds = normalizeStringArray(session.queueOrderIds).filter((orderId) =>
    stopIds.has(orderId)
  );
  const completedOrderIds = normalizeStringArray(session.completedOrderIds).filter((orderId) =>
    stopIds.has(orderId)
  );
  const deferredOrderIds = normalizeStringArray(session.deferredOrderIds).filter((orderId) =>
    stopIds.has(orderId)
  );
  const arrivedOrderIds = normalizeStringArray(session.arrivedOrderIds).filter((orderId) =>
    stopIds.has(orderId)
  );

  const ensureOrderInQueue = (orderId: string) => {
    if (!queueOrderIds.includes(orderId)) {
      throw new Error('העצירה לא זמינה במסלול הפעיל');
    }
  };

  const data: Prisma.DeliveryRouteSessionUpdateInput = {
    lastActivityAt: now,
  };

  switch (parsed.actionType) {
    case 'MARK_ARRIVED': {
      ensureOrderInQueue(parsed.orderId);
      data.arrivedOrderIds = dedupeIds([...arrivedOrderIds, parsed.orderId]) as Prisma.InputJsonValue;
      break;
    }
    case 'DEFER_STOP': {
      ensureOrderInQueue(parsed.orderId);
      const nextQueue = [...queueOrderIds.filter((orderId) => orderId !== parsed.orderId), parsed.orderId];
      data.queueOrderIds = nextQueue as Prisma.InputJsonValue;
      data.deferredOrderIds = dedupeIds([...deferredOrderIds, parsed.orderId]) as Prisma.InputJsonValue;
      data.arrivedOrderIds = arrivedOrderIds.filter((orderId) => orderId !== parsed.orderId) as Prisma.InputJsonValue;
      data.currentOrderId = nextQueue[0] ?? null;
      break;
    }
    case 'COMPLETE_STOP': {
      ensureOrderInQueue(parsed.orderId);
      const nextQueue = queueOrderIds.filter((orderId) => orderId !== parsed.orderId);
      data.queueOrderIds = nextQueue as Prisma.InputJsonValue;
      data.completedOrderIds = dedupeIds([...completedOrderIds, parsed.orderId]) as Prisma.InputJsonValue;
      data.deferredOrderIds = deferredOrderIds.filter((orderId) => orderId !== parsed.orderId) as Prisma.InputJsonValue;
      data.arrivedOrderIds = arrivedOrderIds.filter((orderId) => orderId !== parsed.orderId) as Prisma.InputJsonValue;
      data.currentOrderId = nextQueue[0] ?? null;

      if (nextQueue.length === 0) {
        data.status = 'COMPLETED';
        data.completedAt = now;
      }
      break;
    }
    case 'UPDATE_LOCATION': {
      data.lastKnownLat = parsed.location.lat;
      data.lastKnownLng = parsed.location.lng;
      data.lastLocationAccuracyM = parsed.location.accuracyMeters ?? null;
      data.lastLocationAt = parsed.location.recordedAt
        ? new Date(parsed.location.recordedAt)
        : now;
      break;
    }
    case 'RELEASE_SESSION': {
      data.status = 'RELEASED';
      data.releasedAt = now;
      data.currentOrderId = null;
      break;
    }
  }

  try {
    const updated = await prisma.deliveryRouteSession.update({
      where: {
        id: session.id,
      },
      data,
      select: deliveryRouteSessionSelect,
    });

    return serializeDeliveryRouteSession(updated);
  } catch (error) {
    throw mapDeliveryRouteSessionStorageError(error);
  }
}
