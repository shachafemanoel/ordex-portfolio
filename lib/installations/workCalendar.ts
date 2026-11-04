import { prisma } from '@/lib/db';
import { invalidateOrderReadModels } from '@/lib/orders/invalidateOrderReadModels';
import { syncOrderOperationalState } from '@/lib/services/orders/statusRecalculation';
import {
  InstallationTaskStatus,
  type InstallationTimeSlot,
  OrderStatus,
} from '@prisma/client';
import { endOfDay, startOfDay } from 'date-fns';

const CALENDAR_BACKLOG_STATUSES = [
  OrderStatus.READY,
  OrderStatus.READY_FOR_INSTALL,
  OrderStatus.INSTALL_SCHEDULING,
  OrderStatus.AWAITING_INSTALL,
];

const ACTIVE_INSTALLATION_TASK_STATUSES = [
  InstallationTaskStatus.PENDING,
  InstallationTaskStatus.SCHEDULED,
  InstallationTaskStatus.APPLIED,
];

export type WorkCalendarTaskDto = {
  id: string;
  scheduledDate: string;
  timeSlot: InstallationTimeSlot | null;
  durationMinutes: number | null;
  status: InstallationTaskStatus;
  notes: string | null;
  order: {
    id: string;
    number: string;
    customerName: string | null;
    city: string | null;
    addressLine: string | null;
    addressRaw: string | null;
    status: string | null;
    scheduledAt: string | null;
  };
  technician: {
    id: string;
    name: string;
    email?: string | null;
  } | null;
};

export type WorkCalendarBacklogOrderDto = {
  id: string;
  number: string;
  customerName: string | null;
  city: string | null;
  addressLine: string | null;
  addressRaw: string | null;
  status: string | null;
  scheduledAt: string | null;
};

function deriveInstallationTimeSlot(input: {
  scheduledDate: Date;
  timeWindowStart?: string | null;
  timeWindowEnd?: string | null;
  timeSlot?: InstallationTimeSlot | null;
}): InstallationTimeSlot | null {
  if (input.timeSlot) {
    return input.timeSlot;
  }

  const sourceTime = input.timeWindowStart
    ? input.timeWindowStart
    : input.scheduledDate.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
  const [hoursRaw] = sourceTime.split(':');
  const hour = Number.parseInt(hoursRaw ?? '', 10);

  if (!Number.isFinite(hour)) return null;
  if (hour < 12) return 'MORNING';
  if (hour < 16) return 'AFTERNOON';
  return 'EVENING';
}

function mapInstallationTask(task: {
  id: string;
  scheduledDate: Date;
  timeSlot: InstallationTimeSlot | null;
  durationMinutes: number | null;
  status: InstallationTaskStatus;
  notes: string | null;
  technician: { id: string; name: string; email: string | null } | null;
  order: {
    id: string;
    number: string;
    customerName: string | null;
    customer: { name: string | null } | null;
    city: string | null;
    addressLine: string | null;
    addressRaw: string | null;
    status: string;
    scheduledAt: Date | null;
    timeWindowStart: string | null;
    timeWindowEnd: string | null;
  };
}): WorkCalendarTaskDto {
  return {
    id: task.id,
    scheduledDate: task.scheduledDate.toISOString(),
    timeSlot: deriveInstallationTimeSlot({
      scheduledDate: task.scheduledDate,
      timeWindowStart: task.order.timeWindowStart,
      timeWindowEnd: task.order.timeWindowEnd,
      timeSlot: task.timeSlot,
    }),
    durationMinutes: task.durationMinutes ?? null,
    status: task.status,
    notes: task.notes ?? null,
    order: {
      id: task.order.id,
      number: task.order.number,
      customerName: task.order.customerName ?? task.order.customer?.name ?? null,
      city: task.order.city,
      addressLine: task.order.addressLine,
      addressRaw: task.order.addressRaw,
      status: task.order.status,
      scheduledAt: task.order.scheduledAt?.toISOString() ?? null,
    },
    technician: task.technician
      ? {
          id: task.technician.id,
          name: task.technician.name,
          email: task.technician.email,
        }
      : null,
  };
}

function mapBacklogOrder(order: {
  id: string;
  number: string;
  customerName: string | null;
  customer: { name: string | null } | null;
  city: string | null;
  addressLine: string | null;
  addressRaw: string | null;
  status: string;
  scheduledAt: Date | null;
}): WorkCalendarBacklogOrderDto {
  return {
    id: order.id,
    number: order.number,
    customerName: order.customerName ?? order.customer?.name ?? null,
    city: order.city,
    addressLine: order.addressLine,
    addressRaw: order.addressRaw,
    status: order.status,
    scheduledAt: order.scheduledAt?.toISOString() ?? null,
  };
}

export async function listWorkCalendarData(input: { dateFrom: Date; dateTo: Date }) {
  const [tasks, backlog] = await Promise.all([
    prisma.installationTask.findMany({
      where: {
        scheduledDate: {
          gte: startOfDay(input.dateFrom),
          lte: endOfDay(input.dateTo),
        },
        status: { not: InstallationTaskStatus.CANCELLED },
      },
      include: {
        technician: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        order: {
          select: {
            id: true,
            number: true,
            customerName: true,
            customer: { select: { name: true } },
            city: true,
            addressLine: true,
            addressRaw: true,
            status: true,
            scheduledAt: true,
            timeWindowStart: true,
            timeWindowEnd: true,
          },
        },
      },
      orderBy: [{ scheduledDate: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.order.findMany({
      where: {
        deletedAt: null,
        completedAt: null,
        status: { in: CALENDAR_BACKLOG_STATUSES },
        installationTasks: {
          none: {
            status: {
              in: ACTIVE_INSTALLATION_TASK_STATUSES,
            },
          },
        },
      },
      select: {
        id: true,
        number: true,
        customerName: true,
        customer: { select: { name: true } },
        city: true,
        addressLine: true,
        addressRaw: true,
        status: true,
        scheduledAt: true,
      },
      orderBy: [{ updatedAt: 'asc' }, { createdAt: 'asc' }],
      take: 80,
    }),
  ]);

  return {
    tasks: tasks.map(mapInstallationTask),
    backlog: backlog.map(mapBacklogOrder),
  };
}

export async function updateInstallationTaskStatus(input: {
  taskId: string;
  status: InstallationTaskStatus;
  actorId?: string;
}) {
  const now = new Date();

  const task = await prisma.installationTask.findUnique({
    where: { id: input.taskId },
    select: {
      id: true,
      orderId: true,
      scheduledDate: true,
      durationMinutes: true,
    },
  });

  if (!task) {
    throw new Error('Task not found');
  }

  await prisma.$transaction(async (tx) => {
    await tx.installationTask.update({
      where: { id: input.taskId },
      data: { status: input.status },
    });

    if (input.status === InstallationTaskStatus.COMPLETED) {
      await tx.order.update({
        where: { id: task.orderId },
        data: {
          completedAt: now,
          status: OrderStatus.COMPLETED,
        },
      });
      return;
    }

    if (input.status === InstallationTaskStatus.CANCELLED) {
      await tx.order.update({
        where: { id: task.orderId },
        data: {
          scheduledAt: null,
          scheduledEnd: null,
          timeWindowStart: null,
          timeWindowEnd: null,
          completedAt: null,
          status: OrderStatus.READY_FOR_INSTALL,
        },
      });
      return;
    }

    await tx.order.update({
      where: { id: task.orderId },
      data: {
        completedAt: null,
      },
    });
  });

  await syncOrderOperationalState(task.orderId, {
    actorId: input.actorId,
    reason:
      input.status === InstallationTaskStatus.COMPLETED
        ? 'התקנה הושלמה ביומן העבודה'
        : input.status === InstallationTaskStatus.CANCELLED
          ? 'משימת התקנה בוטלה ביומן העבודה'
          : 'משימת התקנה עודכנה ביומן העבודה',
  });
  await invalidateOrderReadModels(task.orderId);

  return task.orderId;
}
