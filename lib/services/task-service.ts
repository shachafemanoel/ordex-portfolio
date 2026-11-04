import { prisma } from '@/lib/db';
import { Prisma, TaskPriority, TaskStatus, TaskType, UserRole } from '@prisma/client';

export interface CreateTaskInput {
  orderId: string;
  type: TaskType;
  priority?: TaskPriority;
  assigneeId?: string | null;
  dueAt?: Date;
  notes?: string | null;
  payload?: Prisma.InputJsonValue;
}

async function findAssigneeForRole(role: UserRole): Promise<string | null> {
  try {
    const user = await (prisma as any).user?.findFirst?.({
      where: { role, isActive: true },
      select: { id: true },
      orderBy: { updatedAt: 'desc' },
    });

    return user?.id ?? null;
  } catch {
    return null;
  }
}

export class TaskService {
  static async createTask(input: CreateTaskInput) {
    const existing = await prisma.task.findFirst({
      where: {
        orderId: input.orderId,
        type: input.type,
        status: TaskStatus.OPEN,
      },
    });

    if (existing) {
      return prisma.task.update({
        where: { id: existing.id },
        data: {
          assigneeId: input.assigneeId ?? existing.assigneeId,
          dueAt: input.dueAt ?? existing.dueAt,
          notes: input.notes ?? existing.notes,
          priority: input.priority ?? existing.priority,
          payload: input.payload ?? existing.payload ?? Prisma.JsonNull,
        },
      });
    }

    return prisma.task.create({
      data: {
        orderId: input.orderId,
        type: input.type,
        status: TaskStatus.OPEN,
        priority: input.priority ?? TaskPriority.MEDIUM,
        assigneeId: input.assigneeId ?? null,
        dueAt: input.dueAt,
        notes: input.notes ?? null,
        payload: input.payload ?? ({ checklist: [] } as Prisma.InputJsonValue),
      },
    });
  }

  static async completeTasksForOrder(orderId: string, type: TaskType) {
    return prisma.task.updateMany({
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
}

export async function createTaskWithRoleAssignment(input: CreateTaskInput, role: UserRole) {
  const assigneeId = input.assigneeId ?? (await findAssigneeForRole(role));
  return TaskService.createTask({
    ...input,
    assigneeId,
  });
}
