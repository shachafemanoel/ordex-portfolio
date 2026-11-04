import {
  normalizeGoodsReceipt,
  normalizeGoodsReceipts,
} from '@/domain/goods-receipts/normalizeGoodsReceipt';
import { GoodsReceiptDTO } from '@/domain/goods-receipts/types';
import { NotFoundError, ValidationError } from '@/lib/api-middleware';
import { prisma } from '@/lib/db';
import { PurchaseOrderStatus } from '@prisma/client';

export interface GoodsReceiptFilters {
  supplierId?: string;
  purchaseOrderId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface CreateGoodsReceiptRequest {
  supplierId?: string;
  purchaseOrderId?: string;
  reference?: string;
  notes?: string;
  receivedAt?: Date;
  createdBy: string;
  items: Array<{
    orderItemId?: string;
    productId?: string;
    quantityReceived: number;
    notes?: string;
  }>;
}

export class GoodsReceiptService {
  static async getGoodsReceipts(
    filters: GoodsReceiptFilters = {}
  ): Promise<{ data: GoodsReceiptDTO[]; pagination: any }> {
    const {
      supplierId,
      purchaseOrderId,
      dateFrom,
      dateTo,
      search,
      limit = 50,
      offset = 0,
    } = filters;

    const where: any = {};

    if (supplierId) {
      where.supplierId = supplierId;
    }

    if (purchaseOrderId) {
      where.purchaseOrderId = purchaseOrderId;
    }

    if (dateFrom || dateTo) {
      where.receivedAt = {};
      if (dateFrom) where.receivedAt.gte = dateFrom;
      if (dateTo) where.receivedAt.lte = dateTo;
    }

    if (search) {
      where.OR = [
        { reference: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
        { supplier: { name: { contains: search, mode: 'insensitive' } } },
        { purchaseOrder: { reference: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [goodsReceipts, totalCount] = await Promise.all([
      prisma.goodsReceipt.findMany({
        where,
        include: {
          createdByUser: true,
          supplier: true,
          purchaseOrder: true,
          items: {
            include: {
              product: true,
              // orderItem: true, // Relation missing or renamed
              // sku: true, // Sku model deleted
            },
          },
        },
        orderBy: { receivedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.goodsReceipt.count({ where }),
    ]);

    return {
      data: normalizeGoodsReceipts(goodsReceipts),
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasNext: offset + limit < totalCount,
        hasPrev: offset > 0,
      },
    };
  }

  static async getGoodsReceiptById(id: string): Promise<GoodsReceiptDTO> {
    const goodsReceipt = await prisma.goodsReceipt.findUnique({
      where: { id },
      include: {
        createdByUser: true,
        supplier: true,
        purchaseOrder: true,
        items: {
          include: {
            product: true,
            // orderItem: true, // Relation missing
            // sku: true, // Sku model deleted
          },
        },
      },
    });

    if (!goodsReceipt) {
      throw new NotFoundError('Goods Receipt');
    }

    const dto = normalizeGoodsReceipt(goodsReceipt);
    if (!dto) {
      throw new Error('Failed to normalize goods receipt');
    }
    return dto;
  }

  static async createGoodsReceipt(data: CreateGoodsReceiptRequest): Promise<GoodsReceiptDTO> {
    const { supplierId, purchaseOrderId, reference, notes, receivedAt, createdBy, items } = data;

    if (!supplierId && !purchaseOrderId) {
      throw new ValidationError('Either supplierId or purchaseOrderId must be provided.');
    }

    return await prisma.$transaction(async (tx) => {
      const newGoodsReceipt = await tx.goodsReceipt.create({
        data: {
          supplierId,
          purchaseOrderId,
          reference,
          notes,
          receivedAt: receivedAt || new Date(),
          createdBy,
          items: {
            create: items.map((item) => ({
              orderItemId: item.orderItemId,
              productId: item.productId,
              quantityReceived: item.quantityReceived,
              notes: item.notes,
            })),
          },
        },
        include: {
          createdByUser: true,
          supplier: true,
          purchaseOrder: true,
          items: {
            include: {
              product: true,
              // orderItem: true, // Relation missing
              // sku: true, // Sku model deleted
            },
          },
        },
      });

      // Update related PurchaseOrderItems and OrderItems
      for (const item of items) {
        if (item.orderItemId) {
          // Update OrderItem received quantity
          await tx.orderItem.update({
            where: { id: item.orderItemId },
            data: {
              receivedQuantity: {
                increment: item.quantityReceived,
              },
              received: true, // Mark as received if any quantity is received
            },
          });
        }

        if (purchaseOrderId) {
          // Update PurchaseOrderItem received quantity
          const poItem = await tx.purchaseOrderItem.findFirst({
            where: {
              purchaseOrderId,
              productId: item.productId, // Assuming skuId here refers to productId in PurchaseOrderItem
            },
          });

          if (poItem) {
            await tx.purchaseOrderItem.update({
              where: { id: poItem.id },
              data: {
                qtyReceived: {
                  increment: item.quantityReceived,
                },
              },
            });
          }
        }

        if (item.productId) {
          // Update SKU stock
          // Update Product stock
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: {
                increment: item.quantityReceived,
              },
            },
          });
        }
      }

      // If linked to a Purchase Order, check its status
      if (purchaseOrderId) {
        const po = await tx.purchaseOrder.findUnique({
          where: { id: purchaseOrderId },
          include: { items: true },
        });

        if (po) {
          const allItemsFullyReceived = po.items.every(
            (poItem) => poItem.qtyReceived >= poItem.qtyOrdered
          );

          if (allItemsFullyReceived) {
            await tx.purchaseOrder.update({
              where: { id: purchaseOrderId },
              data: { status: PurchaseOrderStatus.RECEIVED },
            });
          } else if (po.items.some((poItem) => poItem.qtyReceived > 0)) {
            await tx.purchaseOrder.update({
              where: { id: purchaseOrderId },
              data: { status: PurchaseOrderStatus.PARTIALLY_RECEIVED },
            });
          }
        }
      }

      const dto = normalizeGoodsReceipt(newGoodsReceipt);
      if (!dto) {
        throw new Error('Failed to normalize created goods receipt');
      }
      return dto;
    });
  }
}
