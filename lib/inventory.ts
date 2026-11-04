/**
 * Inventory Management Service
 *
 * Handles:
 * - Stock tracking and updates
 * - Low stock detection
 * - Automatic reorder point monitoring
 * - Integration with purchase orders and receipts
 */

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

export interface StockAdjustment {
  productId: string;
  quantityChange: number;
  reason: string;
  reference?: string;
}

export interface LowStockItem {
  productId: string;
  productName: string;
  sku: string;
  currentStock: number;
  reorderLevel: number;
  stockDeficit: number;
  defaultSupplierId?: string;
  supplierName?: string;
}

export interface InventoryStatus {
  productId: string;
  productName: string;
  sku: string;
  stock: number;
  reorderLevel: number;
  status: 'HEALTHY' | 'LOW' | 'OUT_OF_STOCK';
}

export class InventoryService {
  /**
   * Update stock for a product
   */
  static async updateStock(
    productId: string,
    quantityChange: number,
    reason: string,
    reference?: string
  ): Promise<{ success: boolean; newStock: number }> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, sku: true, stock: true, reorderLevel: true }
    });

    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    const newStock = Math.max(0, product.stock + quantityChange);

    await prisma.product.update({
      where: { id: productId },
      data: { stock: newStock }
    });

    console.log(`[Inventory] Updated ${product.name} (${product.sku}): ${product.stock} → ${newStock} (${reason})`);

    return { success: true, newStock };
  }

  /**
   * Increase stock (receiving goods)
   */
  static async increaseStock(
    productId: string,
    quantity: number,
    reference?: string
  ): Promise<{ success: boolean; newStock: number }> {
    return this.updateStock(
      productId,
      quantity,
      `Goods received${reference ? `: ${reference}` : ''}`,
      reference
    );
  }

  /**
   * Decrease stock (fulfilling orders)
   */
  static async decreaseStock(
    productId: string,
    quantity: number,
    reference?: string
  ): Promise<{ success: boolean; newStock: number }> {
    return this.updateStock(
      productId,
      -quantity,
      `Order fulfilled${reference ? `: ${reference}` : ''}`,
      reference
    );
  }

  /**
   * Get products with low stock (below reorder level)
   */
  static async getLowStockProducts(): Promise<LowStockItem[]> {
    const lowStockProducts = await prisma.product.findMany({
      where: {
        isActive: true,
        stock: {
          lte: prisma.product.fields.reorderLevel
        }
      },
      include: {
        defaultSupplier: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        { stock: 'asc' },
        { name: 'asc' }
      ]
    });

    return lowStockProducts.map(product => ({
      productId: product.id,
      productName: product.name,
      sku: product.sku,
      currentStock: product.stock,
      reorderLevel: product.reorderLevel,
      stockDeficit: Math.max(0, product.reorderLevel - product.stock),
      defaultSupplierId: product.defaultSupplier?.id,
      supplierName: product.defaultSupplier?.name
    }));
  }

  /**
   * Get inventory status for all active products
   */
  static async getInventoryStatus(): Promise<InventoryStatus[]> {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        sku: true,
        stock: true,
        reorderLevel: true
      },
      orderBy: { name: 'asc' }
    });

    return products.map(product => {
      let status: 'HEALTHY' | 'LOW' | 'OUT_OF_STOCK';

      if (product.stock === 0) {
        status = 'OUT_OF_STOCK';
      } else if (product.stock <= product.reorderLevel) {
        status = 'LOW';
      } else {
        status = 'HEALTHY';
      }

      return {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        stock: product.stock,
        reorderLevel: product.reorderLevel,
        status
      };
    });
  }

  /**
   * Check if a product needs reordering
   */
  static async needsReorder(productId: string): Promise<boolean> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { stock: true, reorderLevel: true, isActive: true }
    });

    if (!product || !product.isActive) {
      return false;
    }

    return product.stock <= product.reorderLevel;
  }

  /**
   * Get suggested reorder quantity
   * Simple formula: bring stock up to 2x reorder level
   */
  static async getSuggestedReorderQuantity(productId: string): Promise<number> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { stock: true, reorderLevel: true }
    });

    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    const targetStock = product.reorderLevel * 2;
    return Math.max(0, targetStock - product.stock);
  }

  /**
   * Batch update stock from goods receipt
   */
  static async processGoodsReceipt(
    items: Array<{ productId: string; quantity: number }>,
    receiptReference: string
  ): Promise<{ success: boolean; updated: number }> {
    let updated = 0;

    for (const item of items) {
      try {
        await this.increaseStock(item.productId, item.quantity, receiptReference);
        updated++;
      } catch (error) {
        console.error(`Failed to update stock for product ${item.productId}:`, error);
      }
    }

    console.log(`[Inventory] Processed goods receipt ${receiptReference}: ${updated}/${items.length} items updated`);

    return { success: updated > 0, updated };
  }

  /**
   * Reserve stock for an order (decrease stock)
   */
  static async reserveStock(
    orderItems: Array<{ productId: string; quantity: number }>,
    orderNumber: string
  ): Promise<{ success: boolean; reserved: number; failed: string[] }> {
    let reserved = 0;
    const failed: string[] = [];

    for (const item of orderItems) {
      try {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { stock: true, name: true }
        });

        if (!product) {
          failed.push(`Product ${item.productId} not found`);
          continue;
        }

        if (product.stock < item.quantity) {
          failed.push(`Insufficient stock for ${product.name}: ${product.stock} < ${item.quantity}`);
          continue;
        }

        await this.decreaseStock(item.productId, item.quantity, orderNumber);
        reserved++;
      } catch (error) {
        console.error(`Failed to reserve stock for product ${item.productId}:`, error);
        failed.push(`${item.productId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return { success: reserved > 0, reserved, failed };
  }

  /**
   * Release reserved stock (e.g., order cancelled)
   */
  static async releaseStock(
    orderItems: Array<{ productId: string; quantity: number }>,
    orderNumber: string
  ): Promise<{ success: boolean; released: number }> {
    let released = 0;

    for (const item of orderItems) {
      try {
        await this.increaseStock(item.productId, item.quantity, `Order ${orderNumber} cancelled`);
        released++;
      } catch (error) {
        console.error(`Failed to release stock for product ${item.productId}:`, error);
      }
    }

    return { success: released > 0, released };
  }
}
