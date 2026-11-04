import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSalesDashboardData } from '@/lib/services/dashboard/SalesDashboardService';
import { prisma } from '@/lib/db';
import { format, subDays } from 'date-fns';

// Mock prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    order: {
      aggregate: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

describe('getSalesDashboardData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aggregates daily sales correctly', async () => {
    // Mock aggregations (revenue)
    (prisma.order.aggregate as any).mockResolvedValue({ _sum: { totalCents: 100000 } });

    // Mock counts
    (prisma.order.count as any).mockResolvedValue(10);

    // Mock findMany for Needs Attention (first call to findMany)
    (prisma.order.findMany as any).mockResolvedValueOnce([]);

    // Mock findMany for Recent Orders (second call to findMany)
    const today = new Date();
    const yesterday = subDays(today, 1);
    const twoDaysAgo = subDays(today, 2);

    (prisma.order.findMany as any).mockResolvedValueOnce([
      { createdAt: today, totalCents: 5000 },
      { createdAt: today, totalCents: 3000 },
      { createdAt: yesterday, totalCents: 2000 },
      { createdAt: twoDaysAgo, totalCents: 10000 },
    ]);

    const result = await getSalesDashboardData();

    const todayKey = format(today, 'yyyy-MM-dd');
    const yesterdayKey = format(yesterday, 'yyyy-MM-dd');
    const twoDaysAgoKey = format(twoDaysAgo, 'yyyy-MM-dd');

    const todayEntry = result.dailySales.find(d => d.date === todayKey);
    const yesterdayEntry = result.dailySales.find(d => d.date === yesterdayKey);
    const twoDaysAgoEntry = result.dailySales.find(d => d.date === twoDaysAgoKey);

    expect(todayEntry?.amount).toBe(80); // (5000 + 3000) / 100
    expect(yesterdayEntry?.amount).toBe(20); // 2000 / 100
    expect(twoDaysAgoEntry?.amount).toBe(100); // 10000 / 100
    expect(result.dailySales.length).toBe(30);
  });
});
