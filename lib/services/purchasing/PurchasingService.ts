import { prisma } from '@/lib/db';
import { PurchaseOrderService } from '@/lib/purchase-orders';

interface PurchaseOrderItemInput {
  productId: string;
  quantity: number;
  linkedOrderItemIds?: string[];
}

class PurchasingService {
  async createPurchaseOrder(supplierId: string, items: PurchaseOrderItemInput[]) {
    const reference = `PO-${Date.now()}`;

    return (prisma as any).purchaseOrder.create({
      data: {
        supplierId,
        reference,
        status: 'DRAFT',
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            qtyOrdered: item.quantity,
            qtyReceived: 0,
          })),
        },
      },
      include: {
        items: true,
      },
    });
  }

  async receivePurchaseOrder(
    purchaseOrderId: string,
    items: Array<{ productId: string; quantity: number }>
  ) {
    const purchaseOrderItems = await prisma.purchaseOrderItem.findMany({
      where: { purchaseOrderId },
      select: { id: true, productId: true },
    });

    for (const item of items) {
      const match = purchaseOrderItems.find((poItem) => poItem.productId === item.productId);
      if (!match) {
        continue;
      }

      await PurchaseOrderService.updateReceivedQuantity(match.id, item.quantity, 'system');
    }

    return { success: true };
  }
}

export const purchasingService = new PurchasingService();
