import { prisma } from '@/lib/db';
import { InstallationTaskStatus, OrderStatus, Prisma, ShipmentStatus } from '@prisma/client';
import { startOfDay } from 'date-fns';

export const DELIVERY_FLOW_STATUSES: OrderStatus[] = [
  OrderStatus.READY,
  OrderStatus.READY_FOR_INSTALL,
  OrderStatus.INSTALL_SCHEDULING,
  OrderStatus.AWAITING_INSTALL,
  OrderStatus.SCHEDULED,
  OrderStatus.IN_TRANSIT,
  OrderStatus.INSTALLATION,
];

export const AUTO_RESCHEDULE_DELIVERY_STATUSES: OrderStatus[] = [
  OrderStatus.READY,
  OrderStatus.READY_FOR_INSTALL,
  OrderStatus.INSTALL_SCHEDULING,
  OrderStatus.AWAITING_INSTALL,
  OrderStatus.SCHEDULED,
];

export const DELIVERY_FLOW_STATUS_SET = new Set<OrderStatus>(DELIVERY_FLOW_STATUSES);

export interface ReconciledDeliveryRecord {
  id: string;
  number: string;
  customerName: string;
  status: OrderStatus;
  previousScheduledAt: Date;
  rescheduledAt: Date;
}

export function buildRolledDeliveryTime(previousScheduledAt: Date, now: Date = new Date()): Date {
  const rolled = new Date(previousScheduledAt);
  rolled.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());

  if (rolled.getTime() > now.getTime()) {
    return new Date(now);
  }

  return rolled;
}

export function buildDeliveryAttentionWhere(now: Date = new Date()): Prisma.OrderWhereInput {
  return {
    deletedAt: null,
    completedAt: null,
    status: { in: DELIVERY_FLOW_STATUSES },
    scheduledAt: { not: null, lte: now },
    OR: [{ opsSnoozeUntil: null }, { opsSnoozeUntil: { lte: now } }],
  };
}

export async function reconcileStaleDeliveries(
  now: Date = new Date()
): Promise<ReconciledDeliveryRecord[]> {
  const todayStart = startOfDay(now);
  const candidates = await prisma.order.findMany({
    where: {
      deletedAt: null,
      completedAt: null,
      status: { in: AUTO_RESCHEDULE_DELIVERY_STATUSES },
      scheduledAt: { not: null, lt: todayStart },
      OR: [{ opsSnoozeUntil: null }, { opsSnoozeUntil: { lte: now } }],
    },
    select: {
      id: true,
      number: true,
      status: true,
      scheduledAt: true,
      customerName: true,
      customer: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { scheduledAt: 'asc' },
    take: 100,
  });

  if (!candidates.length) {
    return [];
  }

  const reconciled: ReconciledDeliveryRecord[] = candidates
    .filter(
      (
        candidate
      ): candidate is typeof candidate & {
        scheduledAt: Date;
      } => candidate.scheduledAt instanceof Date
    )
    .map((candidate) => ({
      id: candidate.id,
      number: candidate.number,
      customerName: candidate.customerName?.trim() || candidate.customer?.name?.trim() || 'לקוח',
      status: candidate.status,
      previousScheduledAt: candidate.scheduledAt,
      rescheduledAt: buildRolledDeliveryTime(candidate.scheduledAt, now),
    }));

  if (!reconciled.length) {
    return [];
  }

  await prisma.$transaction(async (tx) => {
    for (const candidate of reconciled) {
      await tx.order.update({
        where: { id: candidate.id },
        data: {
          scheduledAt: candidate.rescheduledAt,
          urgent: true,
          priority: 'HIGH',
          opsLane: 'NEEDS_ACTION',
          opsSnoozeUntil: null,
          opsSnoozeReason: null,
        },
      });

      await tx.installationTask.updateMany({
        where: {
          orderId: candidate.id,
          scheduledDate: { lt: todayStart },
          status: {
            in: [InstallationTaskStatus.PENDING, InstallationTaskStatus.SCHEDULED],
          },
        },
        data: {
          scheduledDate: candidate.rescheduledAt,
        },
      });

      await tx.shipment.updateMany({
        where: {
          orderId: candidate.id,
          scheduledAt: { lt: todayStart },
          status: {
            in: [ShipmentStatus.PENDING, ShipmentStatus.SCHEDULED],
          },
        },
        data: {
          scheduledAt: candidate.rescheduledAt,
        },
      });
    }
  });

  return reconciled;
}
