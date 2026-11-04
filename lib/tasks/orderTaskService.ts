import { prisma } from '@/lib/db';
import { Prisma, Task, TaskPriority, TaskStatus, TaskType } from '@prisma/client';

type TaskTypeInput = TaskType | string;

interface ChecklistItem {
  id: string;
  label?: string;
  required?: boolean;
  checked?: boolean;
  [key: string]: unknown;
}

function normalizeTaskType(type: TaskTypeInput): TaskType {
  const normalized = String(type || '').toUpperCase() as keyof typeof TaskType;
  return TaskType[normalized] ?? TaskType.OTHER;
}

function defaultTaskTitle(type: TaskType): string {
  switch (type) {
    case TaskType.CALL_BACK:
      return 'חזרה ללקוח';
    case TaskType.STOCK_RECEIPT:
      return 'קליטת מלאי';
    case TaskType.INSTALL_REMINDER:
      return 'תזכורת התקנה';
    default:
      return 'משימת הזמנה';
  }
}

function toPayloadObject(payload: Prisma.JsonValue | null): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }
  return payload as Record<string, unknown>;
}

function readChecklist(payload: Prisma.JsonValue | null): ChecklistItem[] {
  const payloadObj = toPayloadObject(payload);
  const checklist = payloadObj.checklist;
  if (!Array.isArray(checklist)) {
    return [];
  }
  return checklist
    .filter((item) => typeof item === 'object' && item !== null)
    .map((item) => item as ChecklistItem);
}

function withChecklist(
  payload: Prisma.JsonValue | null,
  checklist: ChecklistItem[]
): Prisma.InputJsonValue {
  const payloadObj = toPayloadObject(payload);
  return {
    ...payloadObj,
    checklist,
  } as Prisma.InputJsonValue;
}

export async function getActiveTask(orderId: string) {
  return prisma.task.findFirst({
    where: {
      orderId,
      status: TaskStatus.OPEN,
    },
    orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function ensureActiveTask(orderId: string, order?: unknown) {
  const active = await getActiveTask(orderId);
  if (active) {
    return active;
  }

  if (!order) {
    const orderExists = await prisma.order.count({ where: { id: orderId } });
    if (orderExists === 0) {
      throw new Error('Order not found');
    }
  }

  return setActiveTask(orderId, TaskType.OTHER);
}

export async function setActiveTask(
  orderId: string,
  type: TaskTypeInput,
  options: { createdByUserId?: string; note?: string } = {}
) {
  const normalizedType = normalizeTaskType(type);

  await prisma.task.updateMany({
    where: {
      orderId,
      status: TaskStatus.OPEN,
    },
    data: {
      status: TaskStatus.CANCELED,
    },
  });

  const createdTask = await prisma.task.create({
    data: {
      orderId,
      type: normalizedType,
      status: TaskStatus.OPEN,
      priority: TaskPriority.MEDIUM,
      notes: options.note ?? null,
      aiTitleHe: defaultTaskTitle(normalizedType),
      payload: { checklist: [] } as Prisma.InputJsonValue,
      assigneeId: options.createdByUserId ?? null,
    },
  });

  await logTaskEvent(orderId, createdTask.id, 'TASK_CHANGED', {
    actorUserId: options.createdByUserId,
    message: `סוג משימה שונה ל: ${normalizedType}`,
  });

  return createdTask;
}

export async function upsertChecklistState(
  taskId: string,
  patches: { itemId: string; checked: boolean }[] = []
) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    throw new Error('Task not found');
  }

  const checklist = readChecklist(task.payload);

  for (const patch of patches) {
    const target = checklist.find((item) => item.id === patch.itemId);
    if (target) {
      target.checked = patch.checked;
    } else {
      checklist.push({
        id: patch.itemId,
        checked: patch.checked,
      });
    }
  }

  return prisma.task.update({
    where: { id: taskId },
    data: {
      payload: withChecklist(task.payload, checklist),
    },
  });
}

export async function completeTask(
  orderId: string,
  payload: {
    taskId: string;
    performedByUserId: string;
    actionChoice?: string;
    override?: { enabled: boolean; reason: string };
  }
) {
  const task = await prisma.task.findUnique({
    where: { id: payload.taskId },
  });

  if (!task || task.orderId !== orderId) {
    throw new Error('Task not found');
  }

  if (task.status !== TaskStatus.OPEN) {
    throw new Error('Task is already completed');
  }

  const checklist = readChecklist(task.payload);
  const missingRequired = checklist.filter((item) => item.required && !item.checked);

  if (missingRequired.length > 0 && !payload.override?.enabled) {
    return {
      success: false,
      blocked: true,
      missingItems: missingRequired.map((item) => item.label || item.id),
      completedTask: null,
      nextTask: null,
    };
  }

  const payloadObj = toPayloadObject(task.payload);

  const completedTask = await prisma.task.update({
    where: { id: task.id },
    data: {
      status: TaskStatus.DONE,
      payload: {
        ...payloadObj,
        completedAt: new Date().toISOString(),
        completedBy: payload.performedByUserId,
        actionChoice: payload.actionChoice ?? null,
        overrideReason: payload.override?.reason ?? null,
      } as Prisma.InputJsonValue,
    },
  });

  await logTaskEvent(orderId, task.id, 'TASK_COMPLETED', {
    actorUserId: payload.performedByUserId,
    message: `משימה הושלמה: ${task.aiTitleHe || task.type}`,
    data: {
      actionChoice: payload.actionChoice ?? null,
      usedOverride: Boolean(payload.override?.enabled),
    },
  });

  return {
    success: true,
    blocked: false,
    missingItems: [] as string[],
    completedTask,
    nextTask: null as Task | null,
  };
}

export async function logTaskEvent(
  orderId: string,
  taskId: string | null,
  type: string,
  options: { actorUserId?: string; message: string; data?: unknown }
) {
  return prisma.auditEvent.create({
    data: {
      orderId,
      action: type,
      actorId: options.actorUserId ?? null,
      payload: {
        taskId,
        message: options.message,
        data: options.data ?? null,
      } as Prisma.InputJsonValue,
    },
  });
}
