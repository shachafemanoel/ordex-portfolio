import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/db';
import { TaskService } from '@/lib/services/task-service';

vi.mock('@/lib/db', () => ({
  prisma: {
    task: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

describe('TaskService.getTasks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should include orderId in where clause when orderId is provided', async () => {
    (prisma.task.findMany as any).mockResolvedValue([]);
    (prisma.task.count as any).mockResolvedValue(0);

    await TaskService.getTasks({ orderId: '123' });

    expect(prisma.task.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        orderId: '123',
      }),
    }));
  });

  it('should include orderIds in where clause when orderIds is provided', async () => {
    (prisma.task.findMany as any).mockResolvedValue([]);
    (prisma.task.count as any).mockResolvedValue(0);

    await TaskService.getTasks({ orderIds: ['id1', 'id2'] });

    expect(prisma.task.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        orderId: { in: ['id1', 'id2'] },
      }),
    }));
  });

  it('should prioritize orderIds over orderId if both provided', async () => {
      (prisma.task.findMany as any).mockResolvedValue([]);
      (prisma.task.count as any).mockResolvedValue(0);

      await TaskService.getTasks({ orderId: 'id1', orderIds: ['id1', 'id2'] });

      expect(prisma.task.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          orderId: { in: ['id1', 'id2'] },
        }),
      }));
  });
});
