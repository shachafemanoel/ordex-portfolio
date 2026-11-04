/**
 * Purchase Order Generation Service
 *
 * Handles aggregation of customer orders into supplier purchase orders
 * with shortage calculations and proper business logic validation.
 */

import { normalizePurchaseOrder } from '@/domain/purchase-orders/normalizePurchaseOrder';
import { normalizePurchaseOrderItem } from '@/domain/purchase-orders/normalizePurchaseOrderItem';
import { NotFoundError, ValidationError } from '@/lib/api-middleware';
import { OrderStatusManager, type OrderStatusChangeRequest } from '@/lib/business-logic';
import { prisma } from '@/lib/db';
import { ORDER_STATUS_LABELS } from '@/lib/orderStatus';
import type { PurchaseOrderStatus } from '@/lib/purchaseOrderStatus';
import type { PurchaseOrderStatus as PrismaPurchaseOrderStatus } from '@prisma/client';
import {
  fromPrismaPurchaseOrderStatus,
  mapStatusesToPrisma,
  toPrismaPurchaseOrderStatus,
} from './purchaseOrderStatus';

const OPEN_OR_PARTIAL_PRISMA_STATUSES = mapStatusesToPrisma(['OPEN', 'PARTIAL'])!;
const PRISMA_COMPLETE_STATUS = toPrismaPurchaseOrderStatus('COMPLETE');

// Types for Purchase Order operations
export interface PurchaseOrderGenerationRequest {
  orderIds: string[];
  itemIds?: string[];
  userId: string;
  userRole?: string;
  notes?: string;
  expectedDelivery?: Date;
}

export interface PurchaseOrderGenerationResult {
  purchaseOrders: any[];
  updatedOrders: any[];
  totalValue: number; // Virtual field, calculated but not stored on PO
  supplierCount: number;
  itemCount: number;
  errors: string[];
  warnings: string[];
}

export interface SupplierDemandItem {
  productId: string;
  skuCode: string;
  skuName: string;
  totalRequired: number;
  currentStock: number;
  alreadyOrdered: number;
  shortageQuantity: number;
  unitPrice: number | null;
  orders: Array<{
    orderId: string;
    orderNumber: string;
    quantity: number;
  }>;
}

export interface SupplierDemandSummary {
  supplierId: string;
  supplierName: string;
  items: SupplierDemandItem[];
  totalValue: number;
  hasShortages: boolean;
}

type DemandCalculationMode = 'SHORTAGE_BASED' | 'MANUAL_SELECTION';

export interface PurchaseOrderFilters {
  supplierId?: string;
  status?: PurchaseOrderStatus;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Purchase Order Generation Service
 */
export class PurchaseOrderService {
  /**
   * Generate PO reference in format: PO-YYYY-XXXXX
   */
  private static async generatePOReference(): Promise<string> {
    const year = new Date().getFullYear();

    // Get next sequence number for the year
    const result = await prisma.$queryRaw<{ next_val: number }[]>`
      SELECT COALESCE(MAX(CAST(SUBSTRING(reference, 9) AS INTEGER)), 0) + 1 as next_val
      FROM purchase_orders
      WHERE reference LIKE ${'PO-' + year + '-%'}
    `;

    const nextNumber = result[0]?.next_val || 1;
    return `PO-${year}-${nextNumber.toString().padStart(5, '0')}`;
  }

  /**
   * Calculate demand and shortages for each supplier from pending orders
   */
  static async calculateSupplierDemand(
    orderIds: string[],
    itemIds?: string[],
    mode: DemandCalculationMode = 'SHORTAGE_BASED'
  ): Promise<SupplierDemandSummary[]> {
    const selectedItemIds = itemIds?.length ? new Set(itemIds) : null;
    const isManualSelection = mode === 'MANUAL_SELECTION';
    let matchedSelectedItemsCount = 0;

    // Get orders that are eligible for PO generation
    const orders = await prisma.order.findMany({
      where: {
        id: { in: orderIds },
        // We typically generate POs for orders in PO_CREATED, but let's allow flexibility
        // status: 'PO_CREATED'
      },
      include: {
        items: {
          include: {
            product: {
              include: {
                defaultSupplier: true,
              },
            },
            supplier: true,
          },
        },
      },
    });

    if (orders.length === 0) {
      throw new ValidationError('No eligible orders found');
    }

    // Group items by supplier and calculate demand
    const supplierDemandMap = new Map<string, SupplierDemandSummary>();

    for (const order of orders) {
      for (const item of order.items) {
        if (selectedItemIds && !selectedItemIds.has(item.id)) {
          continue;
        }
        if (selectedItemIds) {
          matchedSelectedItemsCount += 1;
        }

        // Determine supplier: explicit on item > default on product
        const product = item.product;
        if (!product) continue;

        const supplier = item.supplier || product.defaultSupplier;
        if (!supplier) {
          // Skip items with no supplier info
          continue;
        }

        if (!supplierDemandMap.has(supplier.id)) {
          supplierDemandMap.set(supplier.id, {
            supplierId: supplier.id,
            supplierName: supplier.name,
            items: [],
            totalValue: 0,
            hasShortages: false,
          });
        }

        const supplierDemand = supplierDemandMap.get(supplier.id)!;

        // Find or create demand item for this Product
        let demandItem = supplierDemand.items.find((di) => di.productId === product.id);
        if (!demandItem) {
          // Calculate already ordered quantity (from open/partial POs)
          const alreadyOrderedResult = await prisma.purchaseOrderItem.aggregate({
            where: {
              productId: product.id,
              purchaseOrder: {
                supplierId: supplier.id,
                status: { in: OPEN_OR_PARTIAL_PRISMA_STATUSES },
              },
            },
            _sum: { qtyOrdered: true },
          });

          const alreadyOrdered = alreadyOrderedResult._sum.qtyOrdered || 0;

          demandItem = {
            productId: product.id,
            skuCode: product.sku,
            skuName: product.name,
            totalRequired: 0,
            currentStock: product.stock,
            alreadyOrdered,
            shortageQuantity: 0,
            unitPrice: product.basePriceCents ? product.basePriceCents / 100 : 0, // Approx unit price for estimation
            orders: [],
          };

          supplierDemand.items.push(demandItem);
        }

        // Add this order's demand
        demandItem.totalRequired += item.qty;
        demandItem.orders.push({
          orderId: order.id,
          orderNumber: order.number,
          quantity: item.qty,
        });

        if (isManualSelection) {
          // Manual procurement mode: selected quantity is ordered as-is (no stock dependency).
          demandItem.shortageQuantity = demandItem.totalRequired;
        } else {
          // Legacy mode: order only shortages above stock + already ordered quantities.
          demandItem.shortageQuantity = Math.max(
            0,
            demandItem.totalRequired - demandItem.currentStock - demandItem.alreadyOrdered
          );
        }

        if (demandItem.shortageQuantity > 0) {
          supplierDemand.hasShortages = true;
        }
      }
    }

    if (selectedItemIds && matchedSelectedItemsCount === 0) {
      throw new ValidationError('No matching order items found for the selected itemIds');
    }

    // Calculate total values (Estimated)
    for (const supplierDemand of supplierDemandMap.values()) {
      supplierDemand.totalValue = supplierDemand.items.reduce((sum, item) => {
        return sum + item.shortageQuantity * (item.unitPrice || 0);
      }, 0);
    }

    return Array.from(supplierDemandMap.values());
  }

  /**
   * Generate Purchase Orders from eligible customer orders
   */
  static async generatePurchaseOrders({
    orderIds,
    itemIds,
    userId,
    userRole,
    notes,
    expectedDelivery,
  }: PurchaseOrderGenerationRequest): Promise<PurchaseOrderGenerationResult> {
    return await prisma.$transaction(async (tx) => {
      const isManualSelection = Boolean(itemIds && itemIds.length > 0);
      const normalizedNotes = notes?.trim() || undefined;

      const result: PurchaseOrderGenerationResult = {
        purchaseOrders: [],
        updatedOrders: [],
        totalValue: 0,
        supplierCount: 0,
        itemCount: 0,
        errors: [],
        warnings: [],
      };

      try {
        const supplierDemands = await this.calculateSupplierDemand(
          orderIds,
          itemIds,
          isManualSelection ? 'MANUAL_SELECTION' : 'SHORTAGE_BASED'
        );

        if (supplierDemands.length === 0) {
          throw new ValidationError('No suppliers found with demand from the selected orders');
        }

        // Create purchase orders per supplier.
        for (const supplierDemand of supplierDemands) {
          const itemsToOrder = supplierDemand.items.filter((item) => {
            if (isManualSelection) {
              return item.totalRequired > 0;
            }
            return item.shortageQuantity > 0;
          });

          if (itemsToOrder.length === 0) {
            result.warnings.push(
              isManualSelection
                ? `Supplier ${supplierDemand.supplierName}: No selected items for purchase order`
                : `Supplier ${supplierDemand.supplierName}: No shortages detected, skipping PO creation`
            );
            continue;
          }

          try {
            const reference = await this.generatePOReference();

            // Collect all unique order IDs associated with these items
            const relevantOrderIds = Array.from(
              new Set(itemsToOrder.flatMap((item) => item.orders.map((o) => o.orderId)))
            );

            // Create the purchase order
            const purchaseOrder = await tx.purchaseOrder.create({
              data: {
                reference,
                supplierId: supplierDemand.supplierId,
                status: toPrismaPurchaseOrderStatus('OPEN'),
                linkedOrderIds: relevantOrderIds,
                notes: normalizedNotes,
                etaDate: expectedDelivery ?? undefined,
                items: {
                  create: itemsToOrder.map((item) => ({
                    productId: item.productId,
                    qtyOrdered: isManualSelection ? item.totalRequired : item.shortageQuantity,
                    qtyReceived: 0,
                    // Schema doesn't have unitPrice, totalPrice, or notes on PO Item
                  })),
                },
              },
              include: {
                supplier: true,
                items: {
                  include: {
                    product: true,
                  },
                },
              },
            });

            result.purchaseOrders.push(purchaseOrder);
            result.totalValue += supplierDemand.totalValue;
            result.itemCount += itemsToOrder.length;
          } catch (error) {
            result.errors.push(
              `Supplier ${supplierDemand.supplierName}: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
          }
        }

        result.supplierCount = result.purchaseOrders.length;

        // If we successfully created POs, update order statuses
        // We update ALL requested orders, assuming if they were passed in, they are now being processed.
        // Or strictly update only those linked.
        if (result.purchaseOrders.length > 0) {
          // Find all orders that were linked to at least one PO
          const allLinkedOrderIds = new Set(
            result.purchaseOrders.flatMap((po) => po.linkedOrderIds)
          );

          for (const orderId of allLinkedOrderIds) {
            // Only update if it makes sense (e.g. from PO_CREATED to AWAITING_STOCK)
            // We'll trust OrderStatusManager to handle valid transitions or throw.
            // But let's check current status to avoid errors on already advanced orders if any.
            const currentOrder = await tx.order.findUnique({ where: { id: orderId } });
            if (currentOrder && currentOrder.status === 'PO_CREATED') {
              try {
                const statusChange: OrderStatusChangeRequest = {
                  orderId,
                  newStatus: 'AWAITING_STOCK',
                  reason: `Purchase orders generated`,
                  userId,
                  userRole,
                };

                const changeResult = await OrderStatusManager.changeOrderStatus(statusChange);
                result.updatedOrders.push(changeResult.order);
              } catch (error) {
                result.errors.push(
                  `Order ${orderId}: Failed to update status - ${error instanceof Error ? error.message : 'Unknown error'}`
                );
              }
            }
          }
        }

        // Add summary warnings
        if (result.errors.length > 0) {
          result.warnings.push(`${result.errors.length} errors occurred during PO generation`);
        }

        return result;
      } catch (error) {
        result.errors.push(
          error instanceof Error ? error.message : 'Unknown error during PO generation'
        );
        return result;
      }
    });
  }

  /**
   * Get purchase orders with filtering and pagination
   */
  static async getPurchaseOrders(filters: PurchaseOrderFilters = {}) {
    const { supplierId, status, dateFrom, dateTo, search, limit = 50, offset = 0 } = filters;

    const where: any = {};

    if (supplierId) {
      where.supplierId = supplierId;
    }

    if (status) {
      where.status = toPrismaPurchaseOrderStatus(status);
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }

    if (search) {
      where.OR = [
        { reference: { contains: search, mode: 'insensitive' } },
        { supplier: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [purchaseOrders, totalCount] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: true,
          items: {
            include: {
              product: {
                include: {
                  defaultSupplier: true,
                },
              },
            },
          },
          // linkedOrderIds is just an array, no relation include
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.purchaseOrder.count({ where }),
    ]);

    return {
      data: purchaseOrders.map(normalizePurchaseOrder),
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasNext: offset + limit < totalCount,
        hasPrev: offset > 0,
      },
    };
  }

  /**
   * Get purchase order by ID with full details
   */
  static async getPurchaseOrderById(id: string) {
    const poRecord = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          include: {
            product: true,
          },
        },
        GoodsReceipt: {
          include: {
            items: {
              include: {
                product: true,
                // orderItem: {
                //   include: {
                //     product: true, // To get SKU/Name
                //   },
                // },
              },
            },
          },
        },
      },
    });

    if (!poRecord) {
      throw new NotFoundError('Purchase Order');
    }

    // Manual fetch of linked orders
    const linkedOrders = poRecord.linkedOrderIds?.length
      ? await prisma.order.findMany({
          where: { id: { in: poRecord.linkedOrderIds } },
          include: {
            customer: true,
            items: {
              include: {
                product: true,
              },
            },
          },
        })
      : [];

    const links = linkedOrders.map((order) => ({
      id: `${poRecord.id}:${order.id}`,
      poId: poRecord.id,
      orderId: order.id,
      order: {
        id: order.id,
        number: order.number,
        status: order.status,
        statusLabel:
          ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS] ?? order.status,
        createdAt: order.createdAt,
        customerName:
          order.customerName ||
          order.customer?.name || // schema: customer.name
          null,
        items: order.items.map((item) => ({
          id: item.id,
          qty: item.qty,
          received: item.received,
          sku: item.product
            ? {
                id: item.product.id,
                code: item.product.sku,
                name: item.product.name,
              }
            : {
                id: item.productId,
                code: 'Unknown',
                name: 'Unknown',
              },
        })),
      },
    }));

    const poItems = poRecord.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      qtyOrdered: item.qtyOrdered,
      qtyReceived: item.qtyReceived,
      product: item.product
        ? {
            id: item.product.id,
            name: item.product.name,
            code: item.product.sku,
          }
        : undefined,
    }));

    const goodsReceipts =
      poRecord.GoodsReceipt?.map((receipt) => ({
        id: receipt.id,
        reference: receipt.reference,
        receivedAt: receipt.receivedAt,
        items:
          receipt.items?.map((item) => ({
            id: item.id,
            productId: item.product?.id, // Derived from direct product relation
            // productId: item.orderItem?.productId, // Derived with safe navigation
            orderItemId: item.orderItemId,
            quantityReceived: item.quantityReceived,
          })) ?? [],
      })) ?? [];

    return {
      id: poRecord.id,
      reference: poRecord.reference,
      supplierId: poRecord.supplierId,
      supplier: poRecord.supplier,
      status: fromPrismaPurchaseOrderStatus(poRecord.status as PrismaPurchaseOrderStatus),
      createdAt: poRecord.createdAt,
      updatedAt: poRecord.updatedAt,
      linkedOrderIds: poRecord.linkedOrderIds,
      items: poItems,
      goodsReceipts,
      links,
    };
  }

  /**
   * Update purchase order status with business logic
   */
  static async updatePurchaseOrderStatus(
    id: string,
    status: PurchaseOrderStatus,
    userId: string,
    notes?: string,
    actualDelivery?: Date
  ) {
    const prismaStatus = toPrismaPurchaseOrderStatus(status);
    return await prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findUnique({
        where: { id },
        include: {
          items: true,
        },
      });

      if (!po) {
        throw new NotFoundError('Purchase Order');
      }

      // Update the PO
      // Note: notes and actualDelivery are not on PurchaseOrder in the schema provided
      // So we ignore them for now or assume they might be added later.
      // Schema only has: id, supplierId, status, linkedOrderIds, createdAt, updatedAt, demo, reference
      const updatedPO = await tx.purchaseOrder.update({
        where: { id },
        data: {
          status: prismaStatus,
        },
        include: {
          supplier: true,
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      // Business logic based on new status
      if (status === 'COMPLETE') {
        // Mark all PO items as fully received (by setting qtyReceived = qtyOrdered)
        // This is a bulk "Receive All" action effectively
        /*
           NOTE: In a real system, you might not want 'COMPLETE' to auto-receive everything
           without explicit confirmation, but following the pattern of the previous code...
        */
        for (const item of po.items) {
          if (item.qtyReceived < item.qtyOrdered) {
            await tx.purchaseOrderItem.update({
              where: { id: item.id },
              data: { qtyReceived: item.qtyOrdered },
            });
          }
        }

        // Update linked orders
        if (po.linkedOrderIds && po.linkedOrderIds.length > 0) {
          // Check each linked order
          for (const orderId of po.linkedOrderIds) {
            // Find all POs for this order
            const allPOsForOrder = await tx.purchaseOrder.findMany({
              where: {
                linkedOrderIds: { has: orderId },
              },
            });

            const allComplete = allPOsForOrder.every(
              (p) =>
                fromPrismaPurchaseOrderStatus(p.status as PrismaPurchaseOrderStatus) === 'COMPLETE'
            );

            // Get the order to check status
            const order = await tx.order.findUnique({ where: { id: orderId } });

            if (allComplete && order && order.status === 'AWAITING_STOCK') {
              const statusChange: OrderStatusChangeRequest = {
                orderId,
                newStatus: 'INSTALL_SCHEDULING', // Move to next step
                reason: `All purchase orders completed`,
                userId,
              };
              await OrderStatusManager.changeOrderStatus(statusChange);
            }
          }
        }
      }

      return normalizePurchaseOrder(updatedPO);
    });
  }

  /**
   * Update received quantity for a PO item
   */
  static async updateReceivedQuantity(
    poItemId: string,
    quantityReceived: number,
    userId: string,
    notes?: string
  ) {
    return await prisma.$transaction(async (tx) => {
      const poItem = await tx.purchaseOrderItem.findUnique({
        where: { id: poItemId },
        include: {
          product: {
            include: {
              defaultSupplier: true,
            },
          },
          purchaseOrder: true,
        },
      });

      if (!poItem) {
        throw new NotFoundError('Purchase Order Item');
      }

      const purchaseOrderStatus = fromPrismaPurchaseOrderStatus(
        poItem.purchaseOrder.status as PrismaPurchaseOrderStatus
      );

      if (quantityReceived < 0) {
        throw new ValidationError('Received quantity cannot be negative');
      }

      if (quantityReceived > poItem.qtyOrdered) {
        throw new ValidationError('Received quantity cannot exceed ordered quantity');
      }

      // Update PO item
      // notes and isFullyReceived are not in schema for PurchaseOrderItem
      const updatedItem = await tx.purchaseOrderItem.update({
        where: { id: poItemId },
        data: {
          qtyReceived: quantityReceived,
        },
        include: {
          product: {
            include: {
              defaultSupplier: true,
            },
          },
        },
      });

      // Update Product stock
      const stockIncrease = quantityReceived - (poItem.qtyReceived || 0);
      if (stockIncrease !== 0) {
        await tx.product.update({
          where: { id: poItem.productId },
          data: {
            stock: {
              increment: stockIncrease,
            },
          },
        });
      }

      // Check if PO should be marked as partial or complete
      const allPOItems = await tx.purchaseOrderItem.findMany({
        where: { purchaseOrderId: poItem.purchaseOrderId },
      });

      const allFullyReceived = allPOItems.every((item) => item.qtyReceived >= item.qtyOrdered);
      const anyPartiallyReceived = allPOItems.some(
        (item) =>
          (item.qtyReceived > 0 && item.qtyReceived < item.qtyOrdered) ||
          (item.id === poItemId && quantityReceived > 0 && quantityReceived < poItem.qtyOrdered) // Check current item logic
      );

      // Update PO status
      if (allFullyReceived) {
        await this.updatePurchaseOrderStatus(poItem.purchaseOrderId, 'COMPLETE', userId);
      } else if (anyPartiallyReceived && purchaseOrderStatus === 'OPEN') {
        await this.updatePurchaseOrderStatus(poItem.purchaseOrderId, 'PARTIAL', userId);
      }

      return normalizePurchaseOrderItem(updatedItem);
    });
  }

  /**
   * Get PO analytics and metrics
   */
  static async getPurchaseOrderAnalytics(dateFrom?: Date, dateTo?: Date) {
    const where: any = {};
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = dateFrom;
      if (dateTo) where.createdAt.lte = dateTo;
    }

    const [statusStats, supplierStats, totalValue] = await Promise.all([
      // Status distribution
      prisma.purchaseOrder.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
        // _sum: { totalAmount: true } // Not in schema
      }),

      // Top suppliers
      prisma.purchaseOrder.groupBy({
        by: ['supplierId'],
        where,
        _count: { id: true },
        // _sum: { totalAmount: true }, // Not in schema
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),

      // Total PO count
      prisma.purchaseOrder.count({ where }),
    ]);

    // Note: totalValue and avgDeliveryTime calculations removed as fields don't exist in schema

    return {
      statusStats: statusStats.map((stat) => ({
        status: fromPrismaPurchaseOrderStatus(stat.status as PrismaPurchaseOrderStatus),
        count: stat._count.id,
        totalValue: 0,
      })),
      supplierStats,
      totalValue: 0,
      totalCount: totalValue,
      avgDeliveryDays: 0,
    };
  }
}
