import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { OrderStatus } from '@prisma/client';
import { buildStatusReport } from '@/lib/reports/statusReport';
import { prisma } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  prisma: {
    order: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

const mockedPrisma = prisma as unknown as {
  order: {
    groupBy: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
};

describe('buildStatusReport', () => {
  beforeEach(() => {
    mockedPrisma.order.groupBy.mockReset();
    mockedPrisma.order.findMany.mockReset();
  });

  it('normalizes statuses and includes empty groups when requested', async () => {
    mockedPrisma.order.groupBy.mockResolvedValue([
      {
        status: 'AWAITING_STOCK' satisfies OrderStatus,
        _count: { id: 5 },
        _sum: { totalCents: 250000 },
        _min: { createdAt: new Date('2025-01-01T10:00:00.000Z') },
        _max: { createdAt: new Date('2025-01-10T10:00:00.000Z') },
      },
    ]);

    mockedPrisma.order.findMany.mockResolvedValue([
      {
        id: 'order-1',
        number: 'PO-123',
        status: 'AWAITING_STOCK' satisfies OrderStatus,
        totalCents: 50000,
        city: 'Tel Aviv',
        createdAt: new Date('2025-01-10T10:00:00.000Z'),
      },
    ]);

    const report = await buildStatusReport({
      statuses: ['awaiting_stock'],
      includeEmpty: true,
    });

    expect(report.summary.totalOrders).toBe(5);
    expect(report.rows).toHaveLength(1);
    expect(report.rows[0]).toMatchObject({
      status: 'AWAITING_STOCK',
      count: 5,
      totalValue: 250000,
      recentOrders: expect.arrayContaining([
        expect.objectContaining({ id: 'order-1' }),
      ]),
    });
  });

  it('handles empty datasets gracefully', async () => {
    mockedPrisma.order.groupBy.mockResolvedValue([]);
    mockedPrisma.order.findMany.mockResolvedValue([]);

    const report = await buildStatusReport({
      statuses: [],
      includeEmpty: false,
    });

    expect(report.summary.totalOrders).toBe(0);
    expect(report.rows).toHaveLength(0);
  });
});
