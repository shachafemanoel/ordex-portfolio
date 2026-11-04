import { prisma } from '@/lib/db';
import {
  mapInstallationCard,
  OperationsInstallationDTO,
  UnscheduledOrderDTO,
} from '@/lib/mappers/installationCard';
import { InstallationTaskStatus, OrderStatus, TaskStatus } from '@prisma/client';
import { addDays, endOfDay, startOfDay } from 'date-fns';

export interface OperationsDashboardData {
  date: Date;
  kpis: {
    installationsForDate: { value: number; activeTeams: number };
    installationsTomorrow: { value: number };
    unscheduled: { value: number };
    openTasks: { value: number; urgent: number };
  };
  installations: OperationsInstallationDTO[];
  unscheduledOrders: UnscheduledOrderDTO[];
}

export async function getOperationsDashboardData(date?: Date): Promise<OperationsDashboardData> {
  const targetDate = date || new Date();
  const startOfTargetDate = startOfDay(targetDate);
  const endOfTargetDate = endOfDay(targetDate);

  const now = new Date();
  const tomorrowStart = startOfDay(addDays(now, 1));
  const tomorrowEnd = endOfDay(addDays(now, 1));

  // Execute queries independently and in parallel
  const [
    installationsForDate,
    installationsTomorrowCount,
    unscheduledOrders,
    unscheduledOrdersCount,
    openTasksCount,
    urgentTasksCount,
  ] = await Promise.all([
    // 1. Installations For Date
    prisma.installationTask.findMany({
      where: {
        scheduledDate: { gte: startOfTargetDate, lte: endOfTargetDate },
        status: { not: InstallationTaskStatus.CANCELLED },
      },
      include: {
        technician: { select: { name: true } },
        order: {
          select: {
            id: true,
            number: true,
            customerName: true,
            customer: { select: { name: true } },
            customerPhone: true,
            status: true,
            city: true,
            addressLine: true,
            addressRaw: true,
            lat: true,
            lng: true,
            totalCents: true,
            createdAt: true,
            scheduledAt: true,
            items: {
              select: {
                id: true,
                name: true,
                qty: true,
                priceCents: true,
                totalCents: true,
              },
            },
          },
        },
      },
      orderBy: { scheduledDate: 'asc' },
    }),

    // 2. Installations Tomorrow Count
    prisma.installationTask.count({
      where: {
        scheduledDate: { gte: tomorrowStart, lte: tomorrowEnd },
        status: { not: InstallationTaskStatus.CANCELLED },
      },
    }),

    // 3. Unscheduled Orders List
    prisma.order.findMany({
      where: {
        status: OrderStatus.AWAITING_INSTALL,
      },
      take: 50,
      orderBy: { updatedAt: 'asc' },
      select: {
        id: true,
        number: true,
        customerName: true,
        customerPhone: true,
        city: true,
        addressLine: true,
        lat: true,
        lng: true,
        priority: true,
        createdAt: true,
        status: true,
        totalCents: true,
        updatedAt: true,
        scheduledAt: true,
        items: {
          select: {
            id: true,
            name: true,
            qty: true,
            priceCents: true,
            totalCents: true,
          },
        },
      },
    }),

    // 4. Unscheduled Orders Count
    prisma.order.count({
      where: { status: OrderStatus.AWAITING_INSTALL },
    }),

    // 5. Open Tasks Count
    prisma.task.count({
      where: { status: TaskStatus.OPEN },
    }),

    // 6. Urgent Tasks Count
    prisma.task.count({
      where: { status: TaskStatus.OPEN, priority: 'URGENT' },
    }),
  ]);

  // 2. Active Teams (on the selected date) - Derived from fetched data
  const activeTechnicianIds = new Set(
    installationsForDate.map((t) => t.technicianId).filter(Boolean)
  );
  const activeTeamsCount = activeTechnicianIds.size;

  return {
    date: targetDate,
    kpis: {
      installationsForDate: { value: installationsForDate.length, activeTeams: activeTeamsCount },
      installationsTomorrow: { value: installationsTomorrowCount },
      unscheduled: { value: unscheduledOrdersCount },
      openTasks: { value: openTasksCount, urgent: urgentTasksCount },
    },

    installations: installationsForDate.map((task) => mapInstallationCard(task as any)),
    unscheduledOrders: unscheduledOrders.map((o) => ({
      id: o.id,
      number: o.number,
      customer: o.customerName || 'לקוח',
      location: o.city || 'לא צוין',
      priority: o.priority,
      daysWaiting: Math.floor((now.getTime() - o.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
      lat: o.lat ?? null,
      lng: o.lng ?? null,
      orderDetails: o,
    })),
  };
}
