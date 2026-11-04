import { normalizePurchaseOrder } from '@/domain/purchase-orders/normalizePurchaseOrder';
import { getCacheService } from '@/lib/cache/CacheService';
import { prisma } from '@/lib/db';
import type { PurchaseOrderStatus } from '@/lib/purchaseOrderStatus';
import { toPrismaPurchaseOrderStatus } from '@/lib/purchaseOrderStatus';
import type { Prisma } from '@prisma/client';

export type ListPurchaseOrdersOptions = {
  supplierId?: string;
  status?: PurchaseOrderStatus;
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  limit?: number;
  offset?: number;
};

export async function listPurchaseOrders(options: ListPurchaseOrdersOptions = {}) {
  const cache = getCacheService();
  // Ensure consistent key generation by handling undefined properties or key order if necessary.
  // JSON.stringify handles key order based on object creation, but for simple options object passed directly, it's usually fine.
  // For safety, we could sort keys, but let's stick to simple stringify for now as 'similar to ordersRepo'.
  const cacheKey = `PurchaseOrders:list:${JSON.stringify(options)}`;

  if (cache.isAvailable()) {
    const cached = await cache.get<{ items: any[]; total: number }>(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const { supplierId, status, dateFrom, dateTo, search, limit = 50, offset = 0 } = options;

  const where: Prisma.PurchaseOrderWhereInput = {};

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

        _count: {
          select: {
            items: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.purchaseOrder.count({ where }),
  ]);

  const result = {
    items: purchaseOrders.map(normalizePurchaseOrder),
    total: totalCount,
  };

  if (cache.isAvailable()) {
    await cache.set(cacheKey, result, 300); // 5 minutes TTL
  }

  return result;
}

export async function invalidatePurchaseOrdersCache() {
  const cache = getCacheService();
  if (cache.isAvailable()) {
    await cache.invalidate('PurchaseOrders:list:*');
  }
}
