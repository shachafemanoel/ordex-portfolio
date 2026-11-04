import { describe, it, expect, vi, beforeEach } from 'vitest';
import { orderActionService } from '@/src/server/domain/orders/service';
import prisma from '@/lib/prisma';
import { ApiErrorCode } from '@/src/server/shared/errors';

// Mock prisma
vi.mock('@/lib/prisma', () => {
  const mockPrisma = {
    order: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditEvent: {
      create: vi.fn(),
    },
  };
  return {
    default: mockPrisma,
    prisma: mockPrisma,
  };
});

describe('orderActionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should execute action successfully when order exists', async () => {
    const mockOrder = { id: 'order-123', stage: 'NEW_INTAKE' };
    (prisma.order.findUnique as any).mockResolvedValue(mockOrder);
    (prisma.auditEvent.create as any).mockResolvedValue({ id: 'audit-1' });

    const result = await orderActionService.execute({
      orderId: 'order-123',
      action: 'REVIEW_ORDER',
      userId: 'user-1',
    });

    expect(result.ok).toBe(true);
    expect(result.order).toEqual(mockOrder);
    expect(prisma.order.findUnique).toHaveBeenCalledWith({ where: { id: 'order-123' } });
    expect(prisma.auditEvent.create).toHaveBeenCalled();
  });

  it('should throw NOT_FOUND when order does not exist', async () => {
    (prisma.order.findUnique as any).mockResolvedValue(null);

    await expect(orderActionService.execute({
      orderId: 'non-existent',
      action: 'REVIEW_ORDER',
    })).rejects.toThrow(expect.objectContaining({
      code: ApiErrorCode.NOT_FOUND
    }));
  });
});
