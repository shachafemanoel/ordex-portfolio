import { prisma } from '@/lib/db';
import { purchasingService } from '@/lib/services/purchasing/PurchasingService';
import { AllocationStatus, OrderStatus, PurchaseOrderStatus } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';

describe('Purchasing Sync (Live DB)', () => {
  // We will create data and clean it up
  const createdIds: { orderId?: string; poId?: string; productId?: string; supplierId?: string } =
    {};

  it('should synchronize Order -> PurchaseOrder -> Receiving', async () => {
    // 1. Setup Data
    // Find or create a test product and supplier
    const supplier = await prisma.supplier.create({
      data: {
        name: 'Test Supplier Sync',
        govId: 'TEST-SYNC-' + Date.now(),
        address: 'Test Address',
      },
    });
    createdIds.supplierId = supplier.id;

    const product = await prisma.product.create({
      data: {
        name: 'Test Product Sync',
        sku: 'TEST-SYNC-' + Date.now(),
        defaultSupplierId: supplier.id,
        stock: 0,
      },
    });
    createdIds.productId = product.id;

    // 2. Create Order
    const order = await prisma.order.create({
      data: {
        number: 'ORD-TEST-' + Date.now(),
        customerId: (await prisma.customer.findFirstOrThrow()).id, // Assume at least one customer exists or create one
        billingAddressId: (await prisma.address.findFirstOrThrow()).id,
        shippingAddressId: (await prisma.address.findFirstOrThrow()).id,
        status: OrderStatus.DRAFT,
        currency: 'ILS',
        items: {
          create: {
            productId: product.id,
            qty: 5,
            sku: product.sku,
            name: product.name,
            priceCents: 1000,
            vatCategory: 'STANDARD',
            totalCents: 5000,
            allocationStatus: AllocationStatus.PENDING,
          },
        },
      },
      include: { items: true },
    });
    createdIds.orderId = order.id;
    const orderItemId = order.items[0].id;

    // 3. Demand Planning (Verify it shows up)
    // Skip calling dashboard service directly, test core logic

    // 4. Create PO
    const startPoCount = await prisma.purchaseOrder.count();
    const po = await purchasingService.createPurchaseOrder(supplier.id, [
      {
        productId: product.id,
        quantity: 5,
        linkedOrderItemIds: [orderItemId],
      },
    ]);
    createdIds.poId = po.id;

    expect(po).toBeDefined();

    // Verify Link
    const updatedOrderItem = await prisma.orderItem.findUnique({ where: { id: orderItemId } });
    expect(updatedOrderItem?.purchaseOrderId).toBe(po.id);
    expect(updatedOrderItem?.allocationStatus).toBe(AllocationStatus.ON_ORDER);

    // 5. Receive PO
    await purchasingService.receivePurchaseOrder(po.id, [
      {
        productId: product.id,
        quantity: 5,
      },
    ]);

    // 6. Verify PO Status
    const updatedPo = await prisma.purchaseOrder.findUnique({ where: { id: po.id } });
    expect(updatedPo?.status).toBe(PurchaseOrderStatus.RECEIVED);

    // 7. Verify Inventory
    const inventory = await prisma.inventoryItem.findUnique({
      where: { productId_supplierId: { productId: product.id, supplierId: supplier.id } },
    });
    // Logic: 5 received. 5 allocated -> 5 reserved. So OnHand should be 5? No, Allocated means Reserved.
    // OnHand includes Reserved. Available = OnHand - Reserved.
    // So OnHand = 5, Reserved = 5, Available = 0.
    expect(inventory?.quantityOnHand).toBe(5);
    expect(inventory?.quantityReserved).toBe(5);
    expect(inventory?.quantityAvailable).toBe(0);

    // 8. Verify Order Item Status
    const finalOrderItem = await prisma.orderItem.findUnique({ where: { id: orderItemId } });
    expect(finalOrderItem?.allocationStatus).toBe(AllocationStatus.ALLOCATED);
  });

  afterAll(async () => {
    // Cleanup
    if (createdIds.poId) {
      await prisma.purchaseOrderItem.deleteMany({ where: { purchaseOrderId: createdIds.poId } });
      await prisma.purchaseOrder.delete({ where: { id: createdIds.poId } });
    }
    if (createdIds.orderId) {
      await prisma.orderItem.deleteMany({ where: { orderId: createdIds.orderId } });
      await prisma.order.delete({ where: { id: createdIds.orderId } });
    }
    if (createdIds.productId) await prisma.product.delete({ where: { id: createdIds.productId } });
    if (createdIds.supplierId)
      await prisma.supplier.delete({ where: { id: createdIds.supplierId } });
  });
});
