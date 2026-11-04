import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReceivingService } from '@/lib/receiving';

const prismaOrderItemFindMany = vi.fn();
const prismaQueryRaw = vi.fn();

vi.mock('@/lib/prisma', () => ({
  prisma: {
    orderItem: {
      findMany: prismaOrderItemFindMany,
    },
    $queryRaw: prismaQueryRaw,
  },
}));

const txOrderItemFindUnique = vi.fn();
const txOrderItemUpdate = vi.fn();
const txOrderItemFindMany = vi.fn();
const txReceivingLogCreate = vi.fn();
const txSkuUpdate = vi.fn();
const txSkuFindFirst = vi.fn();

const mockTx = {
  orderItem: {
    findUnique: txOrderItemFindUnique,
    update: txOrderItemUpdate,
    findMany: txOrderItemFindMany,
  },
  receivingLog: {
    create: txReceivingLogCreate,
  },
  sku: {
    update: txSkuUpdate,
    findFirst: txSkuFindFirst,
  },
};

const withTransactionMock = vi.fn(async (fn: any) => fn(mockTx));

vi.mock('@/lib/db', () => ({
  withTransaction: withTransactionMock,
}));

const getStoreSettingsMock = vi.fn().mockResolvedValue({
  lowStockThreshold: 2,
});

vi.mock('@/lib/store-settings', () => ({
  getStoreSettings: getStoreSettingsMock,
}));

const changeOrderStatusMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/business-logic', () => ({
  OrderStatusManager: {
    changeOrderStatus: changeOrderStatusMock,
  },
}));

const notifyReceivingEventMock = vi.fn().mockResolvedValue(undefined);
const notifyLowStockAlertMock = vi.fn().mockResolvedValue(undefined);

vi.mock('@/lib/receiving-notifications', () => ({
  ReceivingNotificationService: {
    notifyReceivingEvent: notifyReceivingEventMock,
    notifyLowStockAlert: notifyLowStockAlertMock,
  },
}));

describe('ReceivingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters pending items by supplier id and returns supplier-aware DTOs', async () => {
    prismaOrderItemFindMany.mockResolvedValue([
      {
        id: 'item-1',
        orderId: 'order-1',
        order: {
          id: 'order-1',
          number: '101',
          status: 'AWAITING_STOCK',
          createdAt: new Date('2025-11-01T00:00:00.000Z'),
          customer: { name: 'אבי' },
        },
        productId: 'product-1',
        sku: 'SKU-11',
        name: 'שטיח',
        qty: 4,
        receivedQuantity: 1,
        received: false,
        supplier: {
          id: 'sup-1',
          name: 'Urban Style',
        },
      },
    ]);

    const items = await ReceivingService.getPendingReceivingItems({
      supplierId: 'sup-1',
    });

    expect(prismaOrderItemFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          supplierId: 'sup-1',
        }),
      })
    );

    expect(items[0]).toMatchObject({
      supplierId: 'sup-1',
      supplierName: 'Urban Style',
      skuCode: 'SKU-11',
      skuName: 'שטיח',
      quantityPending: 3,
    });
  });

  it('looks up SKUs by code during receiving and triggers low stock alerts with resolved records', async () => {
    txOrderItemFindUnique.mockResolvedValue({
      id: 'item-2',
      orderId: 'order-99',
      productId: null,
      sku: 'SKU-200',
      name: 'וילון',
      qty: 5,
      receivedQuantity: 2,
      received: false,
      supplier: {
        name: 'Nordic Furnishings',
      },
      order: {
        id: 'order-99',
        number: '9901',
        status: 'AWAITING_STOCK',
        items: [
          { id: 'item-2', received: false, receivedQuantity: 2 },
        ],
        customer: { name: 'הילה' },
      },
    });

    txOrderItemUpdate.mockResolvedValue({
      id: 'item-2',
      receivedQuantity: 3,
      received: false,
    });

    txReceivingLogCreate.mockResolvedValue({
      id: 'log-1',
      quantityReceived: 1,
      receivedAt: new Date(),
    });

    txSkuFindFirst.mockResolvedValue({
      id: 'sku-resolved',
      code: 'SKU-200',
      name: 'וילון',
      stock: 10,
      reorderLevel: 3,
      supplier: { name: 'Nordic Furnishings' },
    });

    txSkuUpdate.mockResolvedValue({
      id: 'sku-resolved',
      stock: 11,
      reorderLevel: 3,
    });

    txOrderItemFindMany.mockResolvedValue([
      { received: false, receivedQuantity: 3, qty: 5 },
    ]);

    await ReceivingService.receiveItems({
      orderItemId: 'item-2',
      quantityReceived: 1,
      userId: 'user-1',
    });

    expect(txSkuFindFirst).toHaveBeenCalledWith({
      where: { OR: [{ code: 'SKU-200' }] },
      include: { supplier: true },
    });

    expect(txSkuUpdate).toHaveBeenCalledWith({
      where: { id: 'sku-resolved' },
      data: expect.objectContaining({
        stock: { increment: 1 },
      }),
    });

    expect(notifyLowStockAlertMock).toHaveBeenCalledWith(
      'sku-resolved',
      11,
      3
    );
  });
});
