import { prisma } from '@/lib/db';
import { Prisma, PurchaseOrderStatus } from '@prisma/client';

export interface PurchasingDashboardFilters {
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export async function getPurchasingDashboardData(filters: PurchasingDashboardFilters = {}) {
  const page = filters.page || 1;
  const limit = filters.limit || 20;
  const skip = (page - 1) * limit;

  // 1. KPIs (Global, unaffected by filters usually, or should they be?)
  // Usually KPIs are global.
  const openPosCount = await prisma.purchaseOrder.count({
    where: {
      status: { in: [PurchaseOrderStatus.SENT, PurchaseOrderStatus.PARTIALLY_RECEIVED] },
    },
  });

  const delayedPosCount = 0;

  const outOfStockCount = await prisma.product.count({
    where: { stock: 0, isActive: true },
  });

  const activeSkusCount = await prisma.product.count({ where: { isActive: true } });
  const activeSuppliersCount = await prisma.supplier.count();

  // 2. Receiving Backlog (Widget) - maybe keep as is or filter?
  // Let's keep it simple.

  // 3. Incoming Stock (Filtered & Sorted)
  const incomingWhere: Prisma.PurchaseOrderWhereInput = {};

  // Status Filter
  if (filters.status && filters.status !== 'ALL') {
    incomingWhere.status = filters.status as PurchaseOrderStatus;
  } else {
    // Default view: Active orders
    incomingWhere.status = {
      in: [
        PurchaseOrderStatus.SENT,
        PurchaseOrderStatus.PARTIALLY_RECEIVED,
        PurchaseOrderStatus.DRAFT,
      ],
    };
  }

  // Search Filter
  if (filters.search) {
    incomingWhere.OR = [
      { reference: { contains: filters.search, mode: 'insensitive' } },
      { supplier: { name: { contains: filters.search, mode: 'insensitive' } } },
    ];
  }

  // Sorting
  const orderBy: Prisma.PurchaseOrderOrderByWithRelationInput = {};
  if (filters.sortBy) {
    const direction = filters.sortDir === 'asc' ? 'asc' : 'desc';
    // Handle 'supplier' relation sort
    if (filters.sortBy === 'supplier') {
      orderBy.supplier = { name: direction };
    } else {
      // Safe cast for dynamic key, assuming filters.sortBy matches Prisma fields
      (orderBy as any)[filters.sortBy] = direction;
    }
  } else {
    orderBy.createdAt = 'desc';
  }

  const [incomingStock, totalIncoming] = await Promise.all([
    prisma.purchaseOrder.findMany({
      where: incomingWhere,
      include: {
        supplier: { select: { name: true } },
        items: {
          include: { product: true },
        },
      },
      orderBy,
      take: limit,
      skip,
    }),
    prisma.purchaseOrder.count({ where: incomingWhere }),
  ]);

  // 4. Demand Queue
  // Only 50 items? Maybe we should paginate this too if it's large.
  // For now, I'll keep it as is but maybe respect search?
  const demandQueue = await prisma.orderItem.findMany({
    where: {
      allocationStatus: { in: ['PENDING', 'OUT_OF_STOCK'] },
      order: { status: { not: 'CANCELLED' } },
    },
    include: {
      product: true,
      supplier: true,
      order: { select: { id: true, number: true, customerName: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const receivingBacklog = await prisma.purchaseOrder.findMany({
    where: {
      status: { in: [PurchaseOrderStatus.SENT, PurchaseOrderStatus.PARTIALLY_RECEIVED] },
    },
    orderBy: { createdAt: 'asc' },
    take: 5,
    include: {
      supplier: { select: { name: true } },
    },
  });

  return {
    kpis: {
      openPos: { value: openPosCount, delayed: delayedPosCount },
      outOfStock: { value: outOfStockCount },
      activeSkus: { value: activeSkusCount },
      activeSuppliers: { value: activeSuppliersCount },
    },
    receivingBacklog: receivingBacklog.map((po) => ({
      id: po.id,
      number: po.reference,
      supplier: po.supplier.name,
      status: po.status,
      expectedDate: null,
    })),
    criticalSkus: (
      await prisma.product.findMany({
        where: { stock: 0, isActive: true },
        take: 5,
        select: { id: true, name: true, sku: true },
      })
    ).map((p) => ({ id: p.id, name: p.name, code: p.sku })),
    demandQueue: demandQueue.map((item) => ({
      id: item.id,
      sku: item.sku,
      productName: item.name,
      qty: item.qty,
      orderNumber: item.order.number,
      customerName: item.order.customerName,
      supplierName: item.supplier?.name || item.product?.defaultSupplierId || 'Unknown',
      supplierId: item.supplierId || item.product?.defaultSupplierId || '',
      productId: item.productId || 'unknown-product',
    })),
    incomingStock: {
      items: incomingStock.map((po) => ({
        id: po.id,
        reference: po.reference,
        supplierName: po.supplier.name,
        status: po.status,
        itemsCount: po.items.length,
        itemsReceived: po.items.reduce((acc, i) => acc + i.qtyReceived, 0),
        itemsTotal: po.items.reduce((acc, i) => acc + i.qtyOrdered, 0),
        totalValueCents: po.items.reduce(
          (sum, i) => sum + i.qtyOrdered * (i.product?.basePriceCents ?? 0),
          0
        ),
        createdAt: po.createdAt,
        items: po.items.map((item) => ({
          productId: item.productId,
          name: item.product?.name ?? 'Unknown',
          qtyOrdered: item.qtyOrdered,
          qtyReceived: item.qtyReceived,
        })),
      })),
      pagination: {
        total: totalIncoming,
        page,
        limit,
        totalPages: Math.ceil(totalIncoming / limit),
      },
    },
  };
}
