/**
 * Automatic Reorder Service
 *
 * Automatically creates purchase orders for products below reorder level
 * Groups products by supplier for efficient ordering
 */

import { prisma } from '@/lib/db';
import { InventoryService } from '@/lib/inventory';
import { toPrismaPurchaseOrderStatus } from '@/lib/purchaseOrderStatus';

export interface ReorderRecommendation {
  productId: string;
  productName: string;
  sku: string;
  currentStock: number;
  reorderLevel: number;
  suggestedQuantity: number;
  supplierId: string;
  supplierName: string;
}

export interface AutoReorderResult {
  success: boolean;
  purchaseOrders: Array<{
    id: string;
    reference: string;
    supplierId: string;
    supplierName: string;
    itemCount: number;
    totalQuantity: number;
  }>;
  skippedProducts: Array<{
    productId: string;
    productName: string;
    reason: string;
  }>;
}

export class AutoReorderService {
  /**
   * Get reorder recommendations grouped by supplier
   */
  static async getReorderRecommendations(): Promise<Map<string, ReorderRecommendation[]>> {
    const lowStockProducts = await InventoryService.getLowStockProducts();

    const recommendations = new Map<string, ReorderRecommendation[]>();

    for (const product of lowStockProducts) {
      // Skip products without default supplier
      if (!product.defaultSupplierId || !product.supplierName) {
        continue;
      }

      const suggestedQuantity = await InventoryService.getSuggestedReorderQuantity(product.productId);

      if (suggestedQuantity <= 0) {
        continue;
      }

      const recommendation: ReorderRecommendation = {
        productId: product.productId,
        productName: product.productName,
        sku: product.sku,
        currentStock: product.currentStock,
        reorderLevel: product.reorderLevel,
        suggestedQuantity,
        supplierId: product.defaultSupplierId,
        supplierName: product.supplierName
      };

      if (!recommendations.has(product.defaultSupplierId)) {
        recommendations.set(product.defaultSupplierId, []);
      }

      recommendations.get(product.defaultSupplierId)!.push(recommendation);
    }

    return recommendations;
  }

  /**
   * Generate next PO reference number
   */
  private static async generatePOReference(): Promise<string> {
    const year = new Date().getFullYear();
    const result = await prisma.$queryRaw<{ next_val: number }[]>`
      SELECT COALESCE(MAX(CAST(SUBSTRING(reference, 9) AS INTEGER)), 0) + 1 as next_val
      FROM purchase_orders
      WHERE reference LIKE ${'PO-' + year + '-%'}
    `;
    const nextNumber = result[0]?.next_val || 1;
    return `PO-${year}-${nextNumber.toString().padStart(5, '0')}`;
  }

  /**
   * Create purchase orders automatically for low stock items
   */
  static async createAutomaticPurchaseOrders(
    options: {
      dryRun?: boolean;
      minItemsPerPO?: number;
    } = {}
  ): Promise<AutoReorderResult> {
    const { dryRun = false, minItemsPerPO = 1 } = options;

    const recommendations = await this.getReorderRecommendations();
    const purchaseOrders: AutoReorderResult['purchaseOrders'] = [];
    const skippedProducts: AutoReorderResult['skippedProducts'] = [];

    for (const [supplierId, items] of recommendations.entries()) {
      // Skip if not enough items to create PO
      if (items.length < minItemsPerPO) {
        items.forEach(item => {
          skippedProducts.push({
            productId: item.productId,
            productName: item.productName,
            reason: `Insufficient items for supplier ${item.supplierName} (${items.length} < ${minItemsPerPO})`
          });
        });
        continue;
      }

      if (dryRun) {
        // Dry run - just log what would be created
        const totalQuantity = items.reduce((sum, item) => sum + item.suggestedQuantity, 0);
        console.log(`[AutoReorder] Would create PO for ${items[0].supplierName}:`);
        console.log(`  Items: ${items.length}`);
        console.log(`  Total Quantity: ${totalQuantity}`);
        items.forEach(item => {
          console.log(`    - ${item.productName} (${item.sku}): ${item.suggestedQuantity} units`);
        });

        purchaseOrders.push({
          id: 'DRY-RUN',
          reference: 'DRY-RUN',
          supplierId,
          supplierName: items[0].supplierName,
          itemCount: items.length,
          totalQuantity
        });
      } else {
        // Actually create the PO
        try {
          const poReference = await this.generatePOReference();

          const purchaseOrder = await prisma.purchaseOrder.create({
            data: {
              reference: poReference,
              supplierId,
              status: toPrismaPurchaseOrderStatus('OPEN'),
              linkedOrderIds: [], // No linked customer orders for auto-reorder
              items: {
                create: items.map(item => ({
                  productId: item.productId,
                  qtyOrdered: item.suggestedQuantity
                }))
              }
            },
            include: {
              supplier: {
                select: {
                  name: true
                }
              },
              items: true
            }
          });

          const totalQuantity = purchaseOrder.items.reduce((sum, item) => sum + item.qtyOrdered, 0);

          purchaseOrders.push({
            id: purchaseOrder.id,
            reference: purchaseOrder.reference,
            supplierId: purchaseOrder.supplierId,
            supplierName: purchaseOrder.supplier.name,
            itemCount: purchaseOrder.items.length,
            totalQuantity
          });

          console.log(`[AutoReorder] Created PO ${poReference} for ${purchaseOrder.supplier.name} with ${purchaseOrder.items.length} items`);
        } catch (error) {
          console.error(`[AutoReorder] Failed to create PO for supplier ${supplierId}:`, error);
          items.forEach(item => {
            skippedProducts.push({
              productId: item.productId,
              productName: item.productName,
              reason: `Failed to create PO: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
          });
        }
      }
    }

    return {
      success: purchaseOrders.length > 0,
      purchaseOrders,
      skippedProducts
    };
  }

  /**
   * Check if auto-reorder is enabled in settings
   */
  static async isAutoReorderEnabled(): Promise<boolean> {
    // StoreSettings table was removed. Defaulting to true or using env var.
    return process.env.AUTO_REORDER_ENABLED !== 'false';
  }

  /**
   * Get low stock threshold from settings
   */
  static async getLowStockThreshold(): Promise<number> {
    // StoreSettings table was removed. Defaulting to 0 or using env var.
    const envThreshold = process.env.LOW_STOCK_THRESHOLD;
    return envThreshold ? parseInt(envThreshold, 10) : 0;
  }

  /**
   * Run auto-reorder check and create POs if enabled
   */
  static async runAutoReorder(
    options: {
      dryRun?: boolean;
      force?: boolean;
    } = {}
  ): Promise<AutoReorderResult> {
    const { dryRun = false, force = false } = options;

    // Check if auto-reorder is enabled
    if (!force && !await this.isAutoReorderEnabled()) {
      console.log('[AutoReorder] Auto-reorder is disabled in settings');
      return {
        success: false,
        purchaseOrders: [],
        skippedProducts: []
      };
    }

    console.log(`[AutoReorder] Running auto-reorder check${dryRun ? ' (DRY RUN)' : ''}...`);

    const result = await this.createAutomaticPurchaseOrders({ dryRun });

    if (result.success) {
      console.log(`[AutoReorder] Created ${result.purchaseOrders.length} purchase order(s)`);
    } else {
      console.log('[AutoReorder] No purchase orders created');
    }

    if (result.skippedProducts.length > 0) {
      console.log(`[AutoReorder] Skipped ${result.skippedProducts.length} product(s)`);
    }

    return result;
  }
}
