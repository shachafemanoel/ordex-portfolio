import { describe, it, expect, vi, beforeEach } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  order: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  purchaseOrderItem: {
    aggregate: vi.fn(),
  },
  $queryRaw: vi.fn(),
  $transaction: vi.fn((callback: any) => callback(prismaMock)),
  purchaseOrder: {
    create: vi.fn(),
  },
  product: {
    update: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({
  prisma: prismaMock,
}));

import { PurchaseOrderService } from '@/lib/purchase-orders';
import { prisma } from '@/lib/db';

describe('PurchaseOrderService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('calculateSupplierDemand', () => {
    it('should correctly group items by supplier and calculate shortages', async () => {
      // Mock data
      const mockOrders = [
        {
          id: 'order-1',
          number: '1001',
          items: [
            {
              id: 'item-1',
              qty: 5,
              product: {
                id: 'prod-1',
                sku: 'SKU-1',
                name: 'Product 1',
                stock: 2,
                basePriceCents: 1000,
                defaultSupplier: {
                  id: 'supp-1',
                  name: 'Supplier A',
                },
              },
              supplier: null,
            },
            {
              id: 'item-2',
              qty: 3,
              product: {
                id: 'prod-2',
                sku: 'SKU-2',
                name: 'Product 2',
                stock: 10, // Enough stock
                basePriceCents: 2000,
                defaultSupplier: {
                  id: 'supp-1',
                  name: 'Supplier A',
                },
              },
              supplier: null,
            },
          ],
        },
      ];

      (prisma.order.findMany as any).mockResolvedValue(mockOrders);
      (prisma.purchaseOrderItem.aggregate as any).mockResolvedValue({ _sum: { qtyOrdered: 0 } });

      const result = await PurchaseOrderService.calculateSupplierDemand(['order-1']);

      expect(result).toHaveLength(1);
      expect(result[0].supplierId).toBe('supp-1');
      expect(result[0].items).toHaveLength(2);

      // Check Item 1 (Shortage: 5 required - 2 stock = 3 shortage)
      const item1 = result[0].items.find((i) => i.skuCode === 'SKU-1');
      expect(item1).toBeDefined();
      expect(item1?.totalRequired).toBe(5);
      expect(item1?.currentStock).toBe(2);
      expect(item1?.shortageQuantity).toBe(3);

      // Check Item 2 (No shortage: 3 required - 10 stock = 0 shortage)
      const item2 = result[0].items.find((i) => i.skuCode === 'SKU-2');
      expect(item2).toBeDefined();
      expect(item2?.totalRequired).toBe(3);
      expect(item2?.currentStock).toBe(10);
      expect(item2?.shortageQuantity).toBe(0);

      expect(result[0].hasShortages).toBe(true);
    });

    it('should use selected quantities in manual mode without stock dependency', async () => {
      const mockOrders = [
        {
          id: 'order-1',
          number: '1001',
          items: [
            {
              id: 'item-1',
              qty: 2,
              product: {
                id: 'prod-1',
                sku: 'SKU-1',
                name: 'Product 1',
                stock: 100,
                basePriceCents: 1000,
                defaultSupplier: {
                  id: 'supp-1',
                  name: 'Supplier A',
                },
              },
              supplier: null,
            },
            {
              id: 'item-2',
              qty: 1,
              product: {
                id: 'prod-2',
                sku: 'SKU-2',
                name: 'Product 2',
                stock: 100,
                basePriceCents: 2000,
                defaultSupplier: {
                  id: 'supp-1',
                  name: 'Supplier A',
                },
              },
              supplier: null,
            },
          ],
        },
      ];

      (prisma.order.findMany as any).mockResolvedValue(mockOrders);
      (prisma.purchaseOrderItem.aggregate as any).mockResolvedValue({ _sum: { qtyOrdered: 0 } });

      const result = await PurchaseOrderService.calculateSupplierDemand(
        ['order-1'],
        ['item-1'],
        'MANUAL_SELECTION'
      );

      expect(result).toHaveLength(1);
      expect(result[0].items).toHaveLength(1);
      expect(result[0].items[0].productId).toBe('prod-1');
      expect(result[0].items[0].totalRequired).toBe(2);
      expect(result[0].items[0].shortageQuantity).toBe(2);
    });
  });

  describe('generatePurchaseOrders', () => {
    it('should persist notes and etaDate in manual item selection mode', async () => {
      const expectedDelivery = new Date('2026-02-18T10:00:00.000Z');

      vi.spyOn(PurchaseOrderService, 'calculateSupplierDemand').mockResolvedValue([
        {
          supplierId: 'supp-1',
          supplierName: 'Supplier A',
          totalValue: 100,
          hasShortages: true,
          items: [
            {
              productId: 'prod-1',
              skuCode: 'SKU-1',
              skuName: 'Product 1',
              totalRequired: 2,
              currentStock: 50,
              alreadyOrdered: 0,
              shortageQuantity: 0,
              unitPrice: 50,
              orders: [
                {
                  orderId: 'order-1',
                  orderNumber: '1001',
                  quantity: 2,
                },
              ],
            },
          ],
        },
      ]);

      (prisma.$queryRaw as any).mockResolvedValue([{ next_val: 1 }]);
      (prisma.purchaseOrder.create as any).mockResolvedValue({
        id: 'po-1',
        linkedOrderIds: ['order-1'],
        supplierId: 'supp-1',
        status: 'OPEN',
      });
      (prisma.order.findUnique as any).mockResolvedValue({ id: 'order-1', status: 'READY' });

      const result = await PurchaseOrderService.generatePurchaseOrders({
        orderIds: ['order-1'],
        itemIds: ['item-1'],
        userId: 'user-1',
        notes: 'ETA from supplier',
        expectedDelivery,
      });

      expect(prisma.purchaseOrder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            notes: 'ETA from supplier',
            etaDate: expectedDelivery,
            items: {
              create: [
                expect.objectContaining({
                  productId: 'prod-1',
                  qtyOrdered: 2,
                }),
              ],
            },
          }),
        })
      );

      expect(result.purchaseOrders).toHaveLength(1);
    });
  });
});
