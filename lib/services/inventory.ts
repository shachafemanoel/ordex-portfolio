import { prisma } from '@/lib/db';
import { PurchaseOrderService } from '@/lib/purchase-orders';
import { InventoryService as BaseInventoryService } from '@/lib/inventory';

export interface MissingInventoryItem {
  productId: string;
  name: string;
  sku: string;
  quantityNeeded: number;
  quantityInStock: number;
  supplierId?: string | null;
}

export interface OrderInventoryCheckResult {
  allAvailable: boolean;
  needsPurchase: boolean;
  missingItems: MissingInventoryItem[];
}

export class InventoryService extends BaseInventoryService {
  async checkOrderInventory(orderId: string): Promise<OrderInventoryCheckResult> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: true,
            supplier: true,
          },
        },
      },
    });

    if (!order) {
      return {
        allAvailable: false,
        needsPurchase: false,
        missingItems: [],
      };
    }

    const missingItems = order.items
      .map((item): MissingInventoryItem | null => {
        const stock = item.product?.stock ?? 0;
        const shortage = Math.max(0, item.qty - stock);
        if (shortage === 0 || !item.productId || !item.product) {
          return null;
        }

        return {
          productId: item.productId,
          name: item.product.name,
          sku: item.product.sku,
          quantityNeeded: shortage,
          quantityInStock: stock,
          supplierId: item.supplierId ?? item.product.defaultSupplierId ?? null,
        } satisfies MissingInventoryItem;
      })
      .filter((item): item is MissingInventoryItem => item !== null);

    return {
      allAvailable: missingItems.length === 0,
      needsPurchase: missingItems.length > 0,
      missingItems,
    };
  }
}

export class AutoPurchaseService {
  async createPurchaseOrdersForOrder(
    orderId: string,
    missingItems: MissingInventoryItem[],
    userId: string
  ): Promise<string[]> {
    if (missingItems.length === 0) {
      return [];
    }

    try {
      const result = await PurchaseOrderService.generatePurchaseOrders({
        orderIds: [orderId],
        userId,
      });

      return result.purchaseOrders.map((purchaseOrder: { id: string }) => purchaseOrder.id);
    } catch {
      return [];
    }
  }
}
