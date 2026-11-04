import { randomUUID } from 'crypto';
import { InstallationTaskStatus, OrderStatus, Prisma } from '@prisma/client';
import { describe, expect, it, beforeEach, vi } from 'vitest';

type DeepPartial<T> = {
  [K in keyof T]?: DeepPartial<T[K]>;
};

type StoredOrder = {
  id: string;
  number: string;
  status: OrderStatus;
  scheduledAt: Date | null;
  assignedUserId: string | null;
  completedAt: Date | null;
};

type StoredTask = {
  id: string;
  orderId: string;
  scheduledDate: Date;
  timeSlot: any;
  durationMinutes: number | null;
  technicianId: string | null;
  status: InstallationTaskStatus;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type StoredTechnician = { id: string; name: string; email: string };

type PrismaMock = ReturnType<typeof createPrismaMock>;

const prismaMock = vi.hoisted(() => createPrismaMock());

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));

const { installationTaskService } = await import('@/lib/services/installations/InstallationTaskService');

describe('InstallationTaskService synchronization', () => {
  let orderId: string;
  let technicianId: string;

  beforeEach(() => {
    prismaMock.$reset();
    orderId = prismaMock.__seedOrder();
    technicianId = prismaMock.__seedTechnician();
  });

  it('creates a task and syncs schedule and assignment to the order', async () => {
    const scheduledDate = new Date('2024-05-01T10:00:00Z');

    const task = await installationTaskService.createTask({
      orderId,
      scheduledDate,
      technicianId,
      durationMinutes: 90,
      notes: 'Initial install',
    });

    expect(task.order?.scheduledAt?.toISOString()).toBe(scheduledDate.toISOString());
    expect(task.order?.status).toBe(OrderStatus.SCHEDULED);
    const persistedOrder = await prismaMock.order.findUnique({ where: { id: orderId } });
    expect(persistedOrder?.assignedUserId).toBe(technicianId);
  });

  it('reschedules a task and updates the order in the same transaction', async () => {
    const initialDate = new Date('2024-05-01T10:00:00Z');
    const updatedDate = new Date('2024-05-03T14:00:00Z');

    const created = await installationTaskService.createTask({
      orderId,
      scheduledDate: initialDate,
      technicianId,
    });

    const updated = await installationTaskService.updateTask(created.id, {
      scheduledDate: updatedDate,
      technicianId: null,
    });

    expect(updated?.order?.scheduledAt?.toISOString()).toBe(updatedDate.toISOString());
    expect(updated?.order?.assignedUserId).toBeNull();
    expect(updated?.order?.status).toBe(OrderStatus.SCHEDULED);
  });

  it('marks an order as completed when the task is completed', async () => {
    const created = await installationTaskService.createTask({
      orderId,
      scheduledDate: new Date('2024-05-01T10:00:00Z'),
      technicianId,
    });

    const completed = await installationTaskService.updateTask(created.id, {
      status: InstallationTaskStatus.COMPLETED,
    });

    expect(completed?.order?.status).toBe(OrderStatus.COMPLETED);
    const persistedOrder = await prismaMock.order.findUnique({ where: { id: orderId } });
    expect(persistedOrder?.completedAt).toBeInstanceOf(Date);
  });

  it('returns the order to ready for install when a task is cancelled or removed', async () => {
    const created = await installationTaskService.createTask({
      orderId,
      scheduledDate: new Date('2024-05-01T10:00:00Z'),
      technicianId,
    });

    const cancelled = await installationTaskService.updateTask(created.id, {
      status: InstallationTaskStatus.CANCELLED,
    });

    expect(cancelled?.order?.status).toBe(OrderStatus.READY_FOR_INSTALL);
    expect(cancelled?.order?.scheduledAt).toBeNull();

    await installationTaskService.deleteTask(created.id);
    const persistedOrder = await prismaMock.order.findUnique({ where: { id: orderId } });
    expect(persistedOrder?.status).toBe(OrderStatus.READY_FOR_INSTALL);
    expect(persistedOrder?.scheduledAt).toBeNull();
  });
});

function createPrismaMock() {
  const store: {
    orders: Map<string, StoredOrder>;
    tasks: Map<string, StoredTask>;
    technicians: Map<string, StoredTechnician>;
  } = {
    orders: new Map(),
    tasks: new Map(),
    technicians: new Map(),
  };

  function applySelect<T extends Record<string, any>>(entity: T, select?: Prisma.OrderSelect | Prisma.InstallationTaskSelect) {
    if (!entity) return entity;
    if (!select) return { ...entity } as T;
    const result: Record<string, any> = {};
    for (const [key, enabled] of Object.entries(select)) {
      if (enabled) {
        result[key] = (entity as any)[key];
      }
    }
    return result;
  }

  function buildTaskReturn(task: StoredTask, include?: Prisma.InstallationTaskInclude) {
    const result: any = { ...task };
    if (include?.order?.select) {
      const order = store.orders.get(task.orderId);
      result.order = order ? applySelect(order as any, include.order.select as any) : null;
    }
    if (include?.technician?.select) {
      const tech = task.technicianId ? store.technicians.get(task.technicianId) : null;
      result.technician = tech ? applySelect(tech as any, include.technician.select as any) : null;
    }
    return result;
  }

  const client: any = {
    __seedOrder(overrides: DeepPartial<StoredOrder> = {}) {
      const id = overrides.id ?? randomUUID();
      const order: StoredOrder = {
        id,
        number: overrides.number ?? 'ORD-' + id.slice(0, 6),
        status: overrides.status ?? OrderStatus.READY_FOR_INSTALL,
        scheduledAt: overrides.scheduledAt ?? null,
        assignedUserId: overrides.assignedUserId ?? null,
        completedAt: overrides.completedAt ?? null,
      };
      store.orders.set(id, order);
      return id;
    },
    __seedTechnician(overrides: Partial<StoredTechnician> = {}) {
      const id = overrides.id ?? randomUUID();
      const technician: StoredTechnician = {
        id,
        name: overrides.name ?? 'Technician ' + id.slice(0, 4),
        email: overrides.email ?? `${id.slice(0, 4)}@example.com`,
      };
      store.technicians.set(id, technician);
      return id;
    },
    $reset() {
      store.orders.clear();
      store.tasks.clear();
      store.technicians.clear();
    },
    $transaction<T>(cb: any): Promise<T> {
      if (typeof cb === 'function') {
        return Promise.resolve(cb(client));
      }
      return Promise.all(cb) as any;
    },
    order: {
      findUnique: async ({ where, select }: any) => {
        const order = store.orders.get(where.id);
        return order ? applySelect(order as any, select) : null;
      },
      update: async ({ where, data, select }: any) => {
        const order = store.orders.get(where.id);
        if (!order) throw new Error('Order not found');
        for (const [key, value] of Object.entries(data ?? {})) {
          if (value === undefined) continue;
          if (value instanceof Date) {
            (order as any)[key] = new Date(value);
          } else {
            (order as any)[key] = value;
          }
        }
        return applySelect(order as any, select);
      },
    },
    installationTask: {
      findMany: async ({ where, include, orderBy }: any) => {
        let tasks = Array.from(store.tasks.values()).filter((task) => {
          if (where?.orderId && task.orderId !== where.orderId) return false;
          if (where?.technicianId && task.technicianId !== where.technicianId) return false;
          if (where?.status?.in && !where.status.in.includes(task.status)) return false;
          if (where?.scheduledDate?.gte && task.scheduledDate < where.scheduledDate.gte) return false;
          if (where?.scheduledDate?.lte && task.scheduledDate > where.scheduledDate.lte) return false;
          return true;
        });

        const orderArray = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
        tasks.sort((a, b) => {
          for (const orderItem of orderArray) {
            const [key, direction] = Object.entries(orderItem)[0];
            const aVal = (a as any)[key];
            const bVal = (b as any)[key];
            if (aVal < bVal) return direction === 'asc' ? -1 : 1;
            if (aVal > bVal) return direction === 'asc' ? 1 : -1;
          }
          return 0;
        });

        return tasks.map((task) => buildTaskReturn(task, include));
      },
      create: async ({ data, include }: any) => {
        const id = data.id ?? randomUUID();
        const task: StoredTask = {
          id,
          orderId: data.orderId,
          scheduledDate: new Date(data.scheduledDate),
          timeSlot: data.timeSlot,
          durationMinutes: data.durationMinutes ?? null,
          technicianId: data.technicianId ?? null,
          status: data.status,
          notes: data.notes ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        store.tasks.set(id, task);
        return buildTaskReturn(task, include);
      },
      findUnique: async ({ where, include }: any) => {
        const task = store.tasks.get(where.id);
        return task ? buildTaskReturn(task, include) : null;
      },
      update: async ({ where, data, include }: any) => {
        const task = store.tasks.get(where.id);
        if (!task) throw new Error('Installation task not found');
        for (const [key, value] of Object.entries(data ?? {})) {
          if (value === undefined) continue;
          if (value instanceof Date) {
            (task as any)[key] = new Date(value);
          } else {
            (task as any)[key] = value;
          }
        }
        task.updatedAt = new Date();
        store.tasks.set(where.id, task);
        return buildTaskReturn(task, include);
      },
      delete: async ({ where }: any) => {
        store.tasks.delete(where.id);
        return { id: where.id };
      },
    },
  };

  return client;
}
