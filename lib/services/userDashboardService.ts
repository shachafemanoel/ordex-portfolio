import { prisma } from '@/lib/db';
import { OrderStatus, TaskStatus } from '@prisma/client';

const TASK_TYPE_LABELS: Record<string, string> = {
  CALL_BACK: 'חזרה ללקוח',
  INSTALL_REMINDER: 'תיאום התקנה',
};


export function mapTaskToDashboardItem(t: any) {
  return {
    id: t.id,
    title: (t.type && TASK_TYPE_LABELS[t.type]) || t.type || 'משימה',
    description: t.notes,
    priority: t.priority,
    dueAt: t.dueAt,
    orderNumber: t.order?.number,
    customerName: t.order?.customerName,
    type: t.type, // Keep original type too if needed
  };
}

export async function getUserDashboardData(userId: string) {
  // 1. Get User Profile for Greeting
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, role: true },
  });

  // 2. My Active Orders (Created by me OR Assigned to me) - OR ALL if Admin/Manager
  const hasGlobalVisibility = ['ADMIN', 'OPERATIONS'].includes(user?.role || '');

  const activeOrdersWhere: any = {
    status: {
      notIn: [OrderStatus.CANCELLED, OrderStatus.DRAFT],
    },
  };

  if (!hasGlobalVisibility) {
    activeOrdersWhere.AND = [
      {
        OR: [{ createdByUserId: userId }, { assignedUserId: userId }],
      },
    ];
  }

  const activeOrders = await prisma.order.findMany({
    where: activeOrdersWhere,
    orderBy: { updatedAt: 'desc' },
    take: 5,
    include: {
      customer: { select: { name: true } },
    },
  });

  // 3. My Open Tasks (or ALL if Admin)
  const tasksWhere: any = {
    status: TaskStatus.OPEN,
  };

  if (!hasGlobalVisibility) {
    tasksWhere.assigneeId = userId;
  }

  const myTasks = await prisma.task.findMany({
    where: tasksWhere,
    orderBy: [{ priority: 'desc' }, { dueAt: 'asc' }],
    take: 10,
    include: {
      order: {
        select: {
          number: true,
          customerName: true,
        },
      },
    },
  });

  // 4. Counts
  const activeOrdersCount = await prisma.order.count({
    where: activeOrdersWhere,
  });

  const openTasksCount = await prisma.task.count({
    where: tasksWhere,
  });

  return {
    user,
    stats: {
      activeOrders: activeOrdersCount,
      openTasks: openTasksCount,
    },
    activeOrders: activeOrders.map((o) => ({
      id: o.id,
      orderNumber: o.number,
      customerName: o.customer?.name || o.customerName || 'לקוח מזדמן',
      total: (o.totalCents || 0) / 100,
      status: o.status,
      statusLabel: o.status,
      createdAt: o.createdAt,
    })),
    tasks: myTasks.map(mapTaskToDashboardItem),
  };
}
