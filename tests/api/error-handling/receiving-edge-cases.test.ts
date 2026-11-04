/**
 * Receiving API Edge Cases Tests
 *
 * Tests for error handling improvements to /api/receiving endpoint
 * Covers empty data, missing fields, and partial data scenarios
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from '@/app/api/receiving/route';
import { NextRequest } from 'next/server';

// Mock the ReceivingService
const getReceivingDashboardDataMock = vi.fn();
const getPendingReceivingItemsMock = vi.fn();

vi.mock('@/lib/receiving', () => ({
  ReceivingService: {
    getReceivingDashboardData: getReceivingDashboardDataMock,
    getPendingReceivingItems: getPendingReceivingItemsMock,
  },
}));

// Mock auth middleware to bypass authentication
vi.mock('@/lib/api-middleware', () => ({
  withAuth: (handler: any) => handler,
  validateRequest: () => () => ({}),
  createSuccessResponse: (data: any) => ({
    json: () => Promise.resolve(data),
    status: 200,
  }),
  createErrorResponse: (error: any, status: number) => ({
    json: () => Promise.resolve({ error }),
    status,
  }),
}));

describe('Receiving API - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty Data Scenarios', () => {
    it('should return valid empty structure when no pending items exist', async () => {
      getReceivingDashboardDataMock.mockResolvedValue({
        pendingItems: [],
        summary: {
          totalPendingOrders: 0,
          totalPendingItems: 0,
          estimatedValueCents: 0,
        },
        supplierBreakdown: [],
      });

      getPendingReceivingItemsMock.mockResolvedValue([]);

      const request = new NextRequest('http://localhost:3000/api/receiving');
      const response = await GET(request, { id: 'test-user' } as any);
      const data = await response.json();

      expect(data.pendingItems).toEqual([]);
      expect(data.summary.totalPendingOrders).toBe(0);
      expect(data.summary.totalPendingItems).toBe(0);
      expect(data.summary.estimatedValueCents).toBe(0);
      expect(data.supplierBreakdown).toEqual([]);
    });

    it('should handle database returning null values gracefully', async () => {
      getReceivingDashboardDataMock.mockResolvedValue({
        pendingItems: [],
        summary: {
          totalPendingOrders: null,
          totalPendingItems: null,
          estimatedValueCents: null,
        },
        supplierBreakdown: null,
      });

      const request = new NextRequest('http://localhost:3000/api/receiving');
      const response = await GET(request, { id: 'test-user' } as any);
      const data = await response.json();

      // Should convert nulls to appropriate defaults
      expect(Array.isArray(data.pendingItems)).toBe(true);
      expect(typeof data.summary.totalPendingOrders).toBe('number');
      expect(typeof data.summary.totalPendingItems).toBe('number');
      expect(typeof data.summary.estimatedValueCents).toBe('number');
      expect(Array.isArray(data.supplierBreakdown)).toBe(true);
    });
  });

  describe('Partial Data Scenarios', () => {
    it('should handle pending items with missing supplier information', async () => {
      getReceivingDashboardDataMock.mockResolvedValue({
        pendingItems: [
          {
            id: 'item-1',
            orderId: 'order-1',
            skuCode: 'SKU-001',
            skuName: 'Test Product',
            quantityPending: 5,
            orderNumber: 'ORD-001',
            customerName: 'Test Customer',
            supplierId: null, // Missing supplier
            supplierName: null,
          },
        ],
        summary: {
          totalPendingOrders: 1,
          totalPendingItems: 5,
          estimatedValueCents: 50000,
        },
        supplierBreakdown: [],
      });

      const request = new NextRequest('http://localhost:3000/api/receiving');
      const response = await GET(request, { id: 'test-user' } as any);
      const data = await response.json();

      expect(data.pendingItems[0]).toBeDefined();
      expect(data.pendingItems[0].supplierId).toBeNull();
      expect(data.pendingItems[0].supplierName).toBeNull();
      // Should still have other required fields
      expect(data.pendingItems[0].skuCode).toBe('SKU-001');
      expect(data.pendingItems[0].quantityPending).toBe(5);
    });

    it('should handle items with missing quantity information', async () => {
      getReceivingDashboardDataMock.mockResolvedValue({
        pendingItems: [
          {
            id: 'item-1',
            orderId: 'order-1',
            skuCode: 'SKU-001',
            skuName: 'Test Product',
            quantityPending: null, // Missing quantity
            orderNumber: 'ORD-001',
            customerName: 'Test Customer',
            supplierId: 'sup-1',
            supplierName: 'Test Supplier',
          },
        ],
        summary: {
          totalPendingOrders: 1,
          totalPendingItems: 0,
          estimatedValueCents: 0,
        },
        supplierBreakdown: [
          {
            supplierId: 'sup-1',
            supplierName: 'Test Supplier',
            itemCount: 0,
            totalValueCents: 0,
          },
        ],
      });

      const request = new NextRequest('http://localhost:3000/api/receiving');
      const response = await GET(request, { id: 'test-user' } as any);
      const data = await response.json();

      expect(data.pendingItems[0].quantityPending).toBeNull();
      expect(data.summary.totalPendingItems).toBe(0);
    });

    it('should handle missing customer information', async () => {
      getReceivingDashboardDataMock.mockResolvedValue({
        pendingItems: [
          {
            id: 'item-1',
            orderId: 'order-1',
            skuCode: 'SKU-001',
            skuName: 'Test Product',
            quantityPending: 5,
            orderNumber: 'ORD-001',
            customerName: null, // Missing customer
            supplierId: 'sup-1',
            supplierName: 'Test Supplier',
          },
        ],
        summary: {
          totalPendingOrders: 1,
          totalPendingItems: 5,
          estimatedValueCents: 50000,
        },
        supplierBreakdown: [],
      });

      const request = new NextRequest('http://localhost:3000/api/receiving');
      const response = await GET(request, { id: 'test-user' } as any);
      const data = await response.json();

      expect(data.pendingItems[0].customerName).toBeNull();
      // Should still process the item
      expect(data.pendingItems[0].quantityPending).toBe(5);
    });
  });

  describe('Error Handling', () => {
    it('should return valid empty structure when service throws error', async () => {
      getReceivingDashboardDataMock.mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = new NextRequest('http://localhost:3000/api/receiving');
      const response = await GET(request, { id: 'test-user' } as any);
      const data = await response.json();

      // Should NOT throw, should return empty structure
      expect(data).toBeDefined();
      expect(data.pendingItems).toEqual([]);
      expect(data.summary).toBeDefined();
      expect(data.summary.totalPendingOrders).toBe(0);
    });

    it('should handle Promise.all rejection gracefully', async () => {
      getReceivingDashboardDataMock.mockResolvedValue({
        pendingItems: [],
        summary: {
          totalPendingOrders: 0,
          totalPendingItems: 0,
          estimatedValueCents: 0,
        },
        supplierBreakdown: [],
      });

      getPendingReceivingItemsMock.mockRejectedValue(
        new Error('Failed to fetch pending items')
      );

      const request = new NextRequest('http://localhost:3000/api/receiving');
      const response = await GET(request, { id: 'test-user' } as any);
      const data = await response.json();

      // Should return dashboard data even if pending items fail
      expect(data.summary).toBeDefined();
      expect(data.summary.totalPendingOrders).toBe(0);
    });

    it('should not return 500 status code on service error', async () => {
      getReceivingDashboardDataMock.mockRejectedValue(
        new Error('Internal service error')
      );

      const request = new NextRequest('http://localhost:3000/api/receiving');
      const response = await GET(request, { id: 'test-user' } as any);

      // Should return 200 with empty data, not 500
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.pendingItems).toEqual([]);
    });
  });

  describe('Query Parameters', () => {
    it('should filter by supplier when supplierId provided', async () => {
      getReceivingDashboardDataMock.mockResolvedValue({
        pendingItems: [
          {
            id: 'item-1',
            supplierId: 'sup-1',
            supplierName: 'Test Supplier',
            skuCode: 'SKU-001',
            skuName: 'Product 1',
            quantityPending: 5,
          },
        ],
        summary: {
          totalPendingOrders: 1,
          totalPendingItems: 5,
          estimatedValueCents: 50000,
        },
        supplierBreakdown: [
          {
            supplierId: 'sup-1',
            supplierName: 'Test Supplier',
            itemCount: 1,
            totalValueCents: 50000,
          },
        ],
      });

      getPendingReceivingItemsMock.mockResolvedValue([
        {
          id: 'item-1',
          supplierId: 'sup-1',
          supplierName: 'Test Supplier',
        },
      ]);

      const request = new NextRequest(
        'http://localhost:3000/api/receiving?supplierId=sup-1'
      );
      const response = await GET(request, { id: 'test-user' } as any);
      const data = await response.json();

      expect(getPendingReceivingItemsMock).toHaveBeenCalledWith({
        supplierId: 'sup-1',
      });
      expect(data.pendingItems).toHaveLength(1);
      expect(data.pendingItems[0].supplierId).toBe('sup-1');
    });

    it('should handle invalid supplierId gracefully', async () => {
      getReceivingDashboardDataMock.mockResolvedValue({
        pendingItems: [],
        summary: {
          totalPendingOrders: 0,
          totalPendingItems: 0,
          estimatedValueCents: 0,
        },
        supplierBreakdown: [],
      });

      getPendingReceivingItemsMock.mockResolvedValue([]);

      const request = new NextRequest(
        'http://localhost:3000/api/receiving?supplierId=invalid-id'
      );
      const response = await GET(request, { id: 'test-user' } as any);
      const data = await response.json();

      // Should return empty results, not error
      expect(response.status).toBe(200);
      expect(data.pendingItems).toEqual([]);
    });
  });

  describe('Data Consistency', () => {
    it('should ensure summary totals match item counts', async () => {
      const pendingItems = [
        {
          id: 'item-1',
          quantityPending: 5,
          orderId: 'order-1',
        },
        {
          id: 'item-2',
          quantityPending: 3,
          orderId: 'order-1',
        },
        {
          id: 'item-3',
          quantityPending: 2,
          orderId: 'order-2',
        },
      ];

      getReceivingDashboardDataMock.mockResolvedValue({
        pendingItems,
        summary: {
          totalPendingOrders: 2, // 2 unique orders
          totalPendingItems: 10, // 5 + 3 + 2
          estimatedValueCents: 100000,
        },
        supplierBreakdown: [],
      });

      const request = new NextRequest('http://localhost:3000/api/receiving');
      const response = await GET(request, { id: 'test-user' } as any);
      const data = await response.json();

      expect(data.summary.totalPendingOrders).toBe(2);
      expect(data.summary.totalPendingItems).toBe(10);
      expect(data.pendingItems).toHaveLength(3);
    });

    it('should handle zero-quantity items in summary', async () => {
      getReceivingDashboardDataMock.mockResolvedValue({
        pendingItems: [
          {
            id: 'item-1',
            quantityPending: 0, // Zero quantity
            orderId: 'order-1',
          },
        ],
        summary: {
          totalPendingOrders: 1,
          totalPendingItems: 0,
          estimatedValueCents: 0,
        },
        supplierBreakdown: [],
      });

      const request = new NextRequest('http://localhost:3000/api/receiving');
      const response = await GET(request, { id: 'test-user' } as any);
      const data = await response.json();

      expect(data.summary.totalPendingItems).toBe(0);
      expect(data.pendingItems[0].quantityPending).toBe(0);
    });
  });
});
