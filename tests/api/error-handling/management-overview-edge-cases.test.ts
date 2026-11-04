/**
 * Management Overview Service Edge Cases Tests
 *
 * Tests for error handling improvements to getManagementOverviewData
 * Covers empty database, missing relationships, and error scenarios
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getManagementOverviewData } from '@/services/managementOverviewService';

// Mock Prisma
const mockPrisma = {
  order: {
    count: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
  },
  customer: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  sku: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
  orderItem: {
    groupBy: vi.fn(),
  },
  user: {
    count: vi.fn(),
    groupBy: vi.fn(),
    findMany: vi.fn(),
  },
  $transaction: vi.fn((operations: any[]) => Promise.all(operations)),
};

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

describe('Management Overview Service - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty Database Scenarios', () => {
    it('should return valid structure with all zeros when database is empty', async () => {
      // Mock empty database
      mockPrisma.order.count.mockResolvedValue(0);
      mockPrisma.order.aggregate.mockResolvedValue({ _sum: { totalCents: null } });
      mockPrisma.order.groupBy.mockResolvedValue([]);
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.customer.count.mockResolvedValue(0);
      mockPrisma.customer.findMany.mockResolvedValue([]);
      mockPrisma.sku.count.mockResolvedValue(0);
      mockPrisma.sku.findMany.mockResolvedValue([]);
      mockPrisma.orderItem.groupBy.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(1); // At least one user (current)
      mockPrisma.user.groupBy.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await getManagementOverviewData();

      expect(result.stats.customers.total).toBe(0);
      expect(result.stats.customers.newThisMonth).toBe(0);
      expect(result.stats.customers.repeatRate).toBe(0);

      expect(result.stats.orders.total).toBe(0);
      expect(result.stats.orders.revenue).toBe(0);
      expect(result.stats.orders.avgValue).toBe(0);

      expect(result.stats.products.totalSkus).toBe(0);
      expect(result.stats.products.lowStock).toEqual([]);
      expect(result.stats.products.topSelling).toEqual([]);

      expect(result.stats.team.totalUsers).toBe(1);
      expect(result.stats.team.roles).toEqual([]);
      expect(result.stats.team.topPerformers).toEqual([]);
    });

    it('should handle null aggregate sums gracefully', async () => {
      mockPrisma.order.count.mockResolvedValue(5);
      mockPrisma.order.aggregate.mockResolvedValue({
        _sum: { totalCents: null }, // No revenue
      });
      mockPrisma.order.groupBy.mockResolvedValue([]);
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.customer.count.mockResolvedValue(0);
      mockPrisma.customer.findMany.mockResolvedValue([]);
      mockPrisma.sku.count.mockResolvedValue(0);
      mockPrisma.sku.findMany.mockResolvedValue([]);
      mockPrisma.orderItem.groupBy.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.user.groupBy.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await getManagementOverviewData();

      expect(result.stats.orders.total).toBe(5);
      expect(result.stats.orders.revenue).toBe(0); // Should convert null to 0
      expect(result.stats.orders.avgValue).toBe(0); // Should not be NaN
    });
  });

  describe('Partial Data Scenarios', () => {
    it('should handle customers without orders', async () => {
      mockPrisma.order.count.mockResolvedValue(0);
      mockPrisma.order.aggregate.mockResolvedValue({ _sum: { totalCents: 0 } });
      mockPrisma.order.groupBy.mockResolvedValue([]);
      mockPrisma.order.findMany.mockResolvedValue([]);

      mockPrisma.customer.count
        .mockResolvedValueOnce(10) // Total customers
        .mockResolvedValueOnce(0) // New this month
        .mockResolvedValueOnce(0); // Repeat customers

      mockPrisma.customer.findMany
        .mockResolvedValueOnce([]) // Recent customers
        .mockResolvedValueOnce([]); // Top customers

      mockPrisma.sku.count.mockResolvedValue(0);
      mockPrisma.sku.findMany.mockResolvedValue([]);
      mockPrisma.orderItem.groupBy.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.user.groupBy.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await getManagementOverviewData();

      expect(result.stats.customers.total).toBe(10);
      expect(result.stats.customers.newThisMonth).toBe(0);
      expect(result.stats.customers.repeatRate).toBe(0); // Should not crash
      expect(result.stats.customers.recent).toEqual([]);
      expect(result.stats.customers.topByValue).toEqual([]);
    });

    it('should handle orders without customers (orphaned orders)', async () => {
      mockPrisma.order.count.mockResolvedValue(5);
      mockPrisma.order.aggregate.mockResolvedValue({
        _sum: { totalCents: 50000 },
      });
      mockPrisma.order.groupBy
        .mockResolvedValueOnce([]) // Status breakdown
        .mockResolvedValueOnce([]); // Assigned users

      mockPrisma.order.findMany.mockResolvedValue([
        {
          id: 'order-1',
          createdAt: new Date(),
          customer: null, // Orphaned order
        },
      ]);

      mockPrisma.customer.count.mockResolvedValue(0);
      mockPrisma.customer.findMany.mockResolvedValue([]);
      mockPrisma.sku.count.mockResolvedValue(0);
      mockPrisma.sku.findMany.mockResolvedValue([]);
      mockPrisma.orderItem.groupBy.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.user.groupBy.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await getManagementOverviewData();

      expect(result.stats.orders.total).toBe(5);
      expect(result.stats.orders.revenue).toBe(500); // Should still calculate
      // Should not crash on null customer
    });

    it('should handle SKUs with missing supplier', async () => {
      mockPrisma.order.count.mockResolvedValue(0);
      mockPrisma.order.aggregate.mockResolvedValue({ _sum: { totalCents: 0 } });
      mockPrisma.order.groupBy.mockResolvedValue([]);
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.customer.count.mockResolvedValue(0);
      mockPrisma.customer.findMany.mockResolvedValue([]);

      mockPrisma.sku.count.mockResolvedValue(2);
      mockPrisma.sku.findMany.mockResolvedValue([
        {
          id: 'sku-1',
          code: 'SKU-001',
          name: 'Product 1',
          stock: 1,
          reorderLevel: 5,
          supplier: null, // No supplier
        },
        {
          id: 'sku-2',
          code: 'SKU-002',
          name: 'Product 2',
          stock: 0,
          reorderLevel: 3,
          supplier: null,
        },
      ]);

      mockPrisma.orderItem.groupBy.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.user.groupBy.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await getManagementOverviewData();

      expect(result.stats.products.totalSkus).toBe(2);
      expect(result.stats.products.lowStock).toHaveLength(2);
      // Should handle null supplier gracefully
      expect(result.stats.products.lowStock[0].id).toBeDefined();
    });

    it('should handle users without orders assigned', async () => {
      mockPrisma.order.count.mockResolvedValue(0);
      mockPrisma.order.aggregate.mockResolvedValue({ _sum: { totalCents: 0 } });
      mockPrisma.order.groupBy.mockResolvedValue([]);
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.customer.count.mockResolvedValue(0);
      mockPrisma.customer.findMany.mockResolvedValue([]);
      mockPrisma.sku.count.mockResolvedValue(0);
      mockPrisma.sku.findMany.mockResolvedValue([]);
      mockPrisma.orderItem.groupBy.mockResolvedValue([]);

      mockPrisma.user.count.mockResolvedValue(5);
      mockPrisma.user.groupBy.mockResolvedValue([
        { role: 'ADMIN', _count: { _all: 2 } },
        { role: 'SALES', _count: { _all: 3 } },
      ]);
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-1', name: 'User 1', role: 'ADMIN' },
        { id: 'user-2', name: 'User 2', role: 'SALES' },
      ]);

      const result = await getManagementOverviewData();

      expect(result.stats.team.totalUsers).toBe(5);
      expect(result.stats.team.roles).toHaveLength(2);
      expect(result.stats.team.topPerformers).toEqual([]); // No orders assigned
    });
  });

  describe('Error Handling', () => {
    it('should return empty stats structure when all queries fail', async () => {
      mockPrisma.order.count.mockRejectedValue(new Error('DB Error'));
      mockPrisma.order.aggregate.mockRejectedValue(new Error('DB Error'));
      mockPrisma.order.groupBy.mockRejectedValue(new Error('DB Error'));
      mockPrisma.order.findMany.mockRejectedValue(new Error('DB Error'));
      mockPrisma.customer.count.mockRejectedValue(new Error('DB Error'));
      mockPrisma.customer.findMany.mockRejectedValue(new Error('DB Error'));
      mockPrisma.sku.count.mockRejectedValue(new Error('DB Error'));
      mockPrisma.sku.findMany.mockRejectedValue(new Error('DB Error'));
      mockPrisma.orderItem.groupBy.mockRejectedValue(new Error('DB Error'));
      mockPrisma.user.count.mockRejectedValue(new Error('DB Error'));
      mockPrisma.user.groupBy.mockRejectedValue(new Error('DB Error'));
      mockPrisma.user.findMany.mockRejectedValue(new Error('DB Error'));

      const result = await getManagementOverviewData();

      // Should return structure with zeros, not throw
      expect(result.stats).toBeDefined();
      expect(result.stats.customers.total).toBe(0);
      expect(result.stats.orders.total).toBe(0);
      expect(result.stats.products.totalSkus).toBe(0);
      expect(result.stats.team.totalUsers).toBe(0);
    });

    it('should handle partial transaction failures', async () => {
      mockPrisma.order.count
        .mockResolvedValueOnce(10) // Total orders succeeds
        .mockRejectedValueOnce(new Error('Query failed')); // New orders fails

      mockPrisma.order.aggregate.mockResolvedValue({
        _sum: { totalCents: 100000 },
      });
      mockPrisma.order.groupBy.mockResolvedValue([]);
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.customer.count.mockResolvedValue(5);
      mockPrisma.customer.findMany.mockResolvedValue([]);
      mockPrisma.sku.count.mockResolvedValue(0);
      mockPrisma.sku.findMany.mockResolvedValue([]);
      mockPrisma.orderItem.groupBy.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.user.groupBy.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await getManagementOverviewData();

      // Should return partial data
      expect(result.stats.orders.total).toBe(10);
      expect(result.stats.customers.total).toBe(5);
    });

    it('should not crash on malformed data', async () => {
      mockPrisma.order.count.mockResolvedValue('not a number' as any);
      mockPrisma.order.aggregate.mockResolvedValue({ _sum: { totalCents: 'invalid' } } as any);
      mockPrisma.order.groupBy.mockResolvedValue([]);
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.customer.count.mockResolvedValue(0);
      mockPrisma.customer.findMany.mockResolvedValue([]);
      mockPrisma.sku.count.mockResolvedValue(0);
      mockPrisma.sku.findMany.mockResolvedValue([]);
      mockPrisma.orderItem.groupBy.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.user.groupBy.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await getManagementOverviewData();

      // Should handle type coercion
      expect(result.stats).toBeDefined();
      expect(typeof result.stats.orders.total).toBe('number');
      expect(typeof result.stats.orders.revenue).toBe('number');
    });
  });

  describe('Calculations and Aggregations', () => {
    it('should correctly calculate avgValue when orders exist', async () => {
      mockPrisma.order.count.mockResolvedValue(10);
      mockPrisma.order.aggregate.mockResolvedValue({
        _sum: { totalCents: 500000 }, // Total ₪5000
      });
      mockPrisma.order.groupBy.mockResolvedValue([]);
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.customer.count.mockResolvedValue(0);
      mockPrisma.customer.findMany.mockResolvedValue([]);
      mockPrisma.sku.count.mockResolvedValue(0);
      mockPrisma.sku.findMany.mockResolvedValue([]);
      mockPrisma.orderItem.groupBy.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.user.groupBy.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await getManagementOverviewData();

      expect(result.stats.orders.total).toBe(10);
      expect(result.stats.orders.revenue).toBe(5000); // Converted from cents
      expect(result.stats.orders.avgValue).toBeCloseTo(500, 2); // 5000 / 10
    });

    it('should calculate repeat rate correctly', async () => {
      mockPrisma.order.count.mockResolvedValue(0);
      mockPrisma.order.aggregate.mockResolvedValue({ _sum: { totalCents: 0 } });
      mockPrisma.order.groupBy.mockResolvedValue([]);
      mockPrisma.order.findMany.mockResolvedValue([]);

      mockPrisma.customer.count
        .mockResolvedValueOnce(20) // Total customers
        .mockResolvedValueOnce(0) // New this month
        .mockResolvedValueOnce(10); // Repeat customers

      mockPrisma.customer.findMany.mockResolvedValue([]);
      mockPrisma.sku.count.mockResolvedValue(0);
      mockPrisma.sku.findMany.mockResolvedValue([]);
      mockPrisma.orderItem.groupBy.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.user.groupBy.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await getManagementOverviewData();

      expect(result.stats.customers.total).toBe(20);
      expect(result.stats.customers.repeatRate).toBeCloseTo(50, 2); // 10/20 = 50%
    });

    it('should handle division by zero in calculations', async () => {
      mockPrisma.order.count.mockResolvedValue(0); // No orders
      mockPrisma.order.aggregate.mockResolvedValue({ _sum: { totalCents: 0 } });
      mockPrisma.order.groupBy.mockResolvedValue([]);
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.customer.count.mockResolvedValue(0);
      mockPrisma.customer.findMany.mockResolvedValue([]);
      mockPrisma.sku.count.mockResolvedValue(0);
      mockPrisma.sku.findMany.mockResolvedValue([]);
      mockPrisma.orderItem.groupBy.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.user.groupBy.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await getManagementOverviewData();

      // Should not return NaN or Infinity
      expect(result.stats.orders.avgValue).toBe(0);
      expect(result.stats.customers.repeatRate).toBe(0);
      expect(Number.isFinite(result.stats.orders.avgValue)).toBe(true);
      expect(Number.isFinite(result.stats.customers.repeatRate)).toBe(true);
    });

    it('should correctly identify low stock items', async () => {
      mockPrisma.order.count.mockResolvedValue(0);
      mockPrisma.order.aggregate.mockResolvedValue({ _sum: { totalCents: 0 } });
      mockPrisma.order.groupBy.mockResolvedValue([]);
      mockPrisma.order.findMany.mockResolvedValue([]);
      mockPrisma.customer.count.mockResolvedValue(0);
      mockPrisma.customer.findMany.mockResolvedValue([]);

      mockPrisma.sku.count.mockResolvedValue(3);
      mockPrisma.sku.findMany.mockResolvedValue([
        {
          id: 'sku-1',
          code: 'SKU-001',
          name: 'Low Stock',
          stock: 2,
          reorderLevel: 10, // Below reorder level
        },
        {
          id: 'sku-2',
          code: 'SKU-002',
          name: 'Good Stock',
          stock: 50,
          reorderLevel: 10, // Above reorder level
        },
        {
          id: 'sku-3',
          code: 'SKU-003',
          name: 'Out of Stock',
          stock: 0,
          reorderLevel: 5, // Way below
        },
      ]);

      mockPrisma.orderItem.groupBy.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(1);
      mockPrisma.user.groupBy.mockResolvedValue([]);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await getManagementOverviewData();

      expect(result.stats.products.lowStock).toHaveLength(2);
      expect(result.stats.products.lowStock.some(item => item.code === 'SKU-001')).toBe(true);
      expect(result.stats.products.lowStock.some(item => item.code === 'SKU-003')).toBe(true);
      expect(result.stats.products.lowStock.some(item => item.code === 'SKU-002')).toBe(false);
    });
  });
});
