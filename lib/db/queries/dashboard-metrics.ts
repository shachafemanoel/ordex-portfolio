/**
 * Database Queries for Dashboard Metrics
 * מושך נתונים מה-DB לניתוח AI
 */

import { prisma } from '@/lib/db';
import type { DashboardMetrics, RecentEvent } from '@/types/dashboard';
import { OrderStatus, PaymentStatus, PurchaseOrderStatus } from '@prisma/client';

/**
 * שליפת כל מדדי הדשבורד מבסיס הנתונים
 * @param dateFrom - תאריך התחלה (ברירת מחדל: תחילת החודש)
 * @param dateTo - תאריך סיום (ברירת מחדל: היום)
 */
export async function getDashboardMetrics(
  dateFrom?: Date,
  dateTo?: Date
): Promise<DashboardMetrics> {
  // Default to current month
  const now = new Date();
  const startOfMonth = dateFrom || new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = dateTo || now;
  const overdueThreshold = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  try {
    // Run all queries in parallel for performance
    const [
      // Orders metrics
      totalOrders,
      ordersByStatus,
      ordersRevenue,
      ordersWaitingForStock,
      ordersWaitingForInstallation,

      // Customer metrics
      activeCustomers,

      // Inventory metrics
      productsInStock,
      productsOutOfStock,
      productsLowStock,

      // Purchase orders
      openPurchaseOrdersData,

      // Financial metrics
      pendingPayments,
      pendingPaymentsValue,

      // Operational metrics
      onTimeDeliveries,
      totalDeliveries,

      // Recent events
      recentEvents,
    ] = await Promise.all([
      // Total orders this month
      prisma.order.count({
        where: {
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
      }),

      // Orders by status
      prisma.order.groupBy({
        by: ['status'],
        _count: { id: true },
        where: {
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
      }),

      // Total revenue
      prisma.order.aggregate({
        _sum: { totalCents: true },
        where: {
          createdAt: { gte: startOfMonth, lte: endOfMonth },
          status: { not: OrderStatus.CANCELLED },
        },
      }),

      // Orders waiting for stock
      prisma.order.count({
        where: {
          status: { in: [OrderStatus.AWAITING_STOCK, OrderStatus.PARTIALLY_SUPPLIED] },
        },
      }),

      // Orders waiting for installation
      prisma.order.count({
        where: {
          status: { in: [OrderStatus.INSTALL_SCHEDULING, OrderStatus.AWAITING_INSTALL] },
        },
      }),

      // Active customers (ordered this month)
      prisma.customer.count({
        where: {
          orders: {
            some: {
              createdAt: { gte: startOfMonth, lte: endOfMonth },
            },
          },
        },
      }),

      // Products in stock (Product-based stock tracking)
      prisma.product
        .count({
          where: {
            stock: { gt: 0 },
          },
        })
        .catch(() => 0),

      // Products out of stock
      prisma.product
        .count({
          where: {
            stock: 0,
          },
        })
        .catch(() => 0),

      // Products low stock (< 5 units)
      prisma.product
        .count({
          where: {
            stock: { gt: 0, lt: 5 },
          },
        })
        .catch(() => 0),

      // Open purchase orders with items for value calculation
      prisma.purchaseOrder.findMany({
        where: {
          status: {
            in: [
              PurchaseOrderStatus.DRAFT,
              PurchaseOrderStatus.SENT,
              PurchaseOrderStatus.PARTIALLY_RECEIVED,
            ],
          },
        },
        include: {
          items: {
            include: {
              product: {
                select: {
                  basePriceCents: true,
                },
              },
            },
          },
        },
      }),

      // Pending payments count
      prisma.order.count({
        where: {
          paymentStatus: { in: [PaymentStatus.PENDING, PaymentStatus.PARTIAL] },
        },
      }),

      // Pending payments value
      prisma.order.aggregate({
        _sum: { totalCents: true },
        where: {
          paymentStatus: { in: [PaymentStatus.PENDING, PaymentStatus.PARTIAL] },
        },
      }),

      // On-time deliveries (last 30 days)
      prisma.order.count({
        where: {
          status: OrderStatus.SUPPLIED,
          updatedAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
          // This is simplified - you'd need actual delivery date tracking
        },
      }),

      // Total deliveries (last 30 days)
      prisma.order.count({
        where: {
          status: OrderStatus.SUPPLIED,
          updatedAt: { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),

      // Recent events (last 24 hours)
      getRecentEvents(),
    ]);

    // Calculate derived metrics
    const totalRevenueCents = ordersRevenue._sum.totalCents || 0;
    const totalRevenue = totalRevenueCents / 100; // Convert to main currency
    const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Order status map
    const ordersByStatusMap: Record<string, number> = {};
    ordersByStatus.forEach((item) => {
      ordersByStatusMap[item.status] = item._count.id;
    });

    // On-time delivery rate
    const onTimeDeliveryRate =
      totalDeliveries > 0 ? Math.round((onTimeDeliveries / totalDeliveries) * 100) : 100;

    // DSO calculation (simplified - Days Sales Outstanding)
    const dso = await calculateDSO(totalRevenue);

    // Average order processing time (simplified)
    const avgOrderProcessingTime = await calculateAvgProcessingTime();

    const openPurchaseOrders = openPurchaseOrdersData.length;
    const purchaseOrdersValueCents = openPurchaseOrdersData.reduce((orderSum, order) => {
      const itemsTotal = order.items.reduce((itemSum, item) => {
        const unitPrice = item.product?.basePriceCents ?? 0;
        return itemSum + item.qtyOrdered * unitPrice;
      }, 0);
      return orderSum + itemsTotal;
    }, 0);

    const overduePurchaseOrders = openPurchaseOrdersData.filter(
      (po) => po.createdAt < overdueThreshold
    ).length;

    return {
      // General metrics
      totalRevenue,
      totalOrders,
      avgOrderValue,
      activeCustomers,

      // Orders by status
      ordersByStatus: ordersByStatusMap,

      // Inventory
      productsInStock,
      productsOutOfStock,
      productsLowStock,

      // Purchase orders
      openPurchaseOrders,
      purchaseOrdersValue: purchaseOrdersValueCents / 100,
      overduePurchaseOrders,

      // Operations
      onTimeDeliveryRate,
      avgOrderProcessingTime,
      ordersWaitingForStock,
      ordersWaitingForInstallation,

      // Finance
      dso,
      pendingPayments,
      pendingPaymentsValue: (pendingPaymentsValue._sum.totalCents || 0) / 100,

      // Recent events
      recentEvents,
    };
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    throw new Error('Failed to fetch dashboard metrics');
  }
}

/**
 * שליפת אירועים אחרונים (24 שעות)
 */
async function getRecentEvents(): Promise<RecentEvent[]> {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

  try {
    // Get recent status changes
    const statusChanges = await prisma.statusHistory.findMany({
      where: {
        createdAt: { gte: yesterday },
      },
      include: {
        order: {
          select: { number: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return statusChanges.map((change) => ({
      type: change.toStatus === OrderStatus.SUPPLIED ? 'order_completed' : 'order_created',
      description: `הזמנה ${change.order.number} עברה ל-${change.toStatus}`,
      timestamp: change.createdAt,
      severity: change.toStatus === OrderStatus.CANCELLED ? 'warning' : 'info',
      relatedEntityId: change.orderId,
    }));
  } catch (error) {
    console.error('Error fetching recent events:', error);
    return [];
  }
}

/**
 * חישוב DSO (Days Sales Outstanding)
 * זמן ממוצע לגביית חובות
 */
async function calculateDSO(totalRevenue: number): Promise<number> {
  try {
    // Simplified DSO calculation
    // DSO = (Accounts Receivable / Total Revenue) * Days in Period

    const accountsReceivable = await prisma.order.aggregate({
      _sum: { totalCents: true },
      where: {
        paymentStatus: { in: [PaymentStatus.PENDING, PaymentStatus.PARTIAL] },
      },
    });

    const receivableAmount = (accountsReceivable._sum.totalCents || 0) / 100;

    if (totalRevenue === 0) return 0;

    const dso = (receivableAmount / totalRevenue) * 30; // Assume 30 days period

    return Math.round(dso);
  } catch (error) {
    console.error('Error calculating DSO:', error);
    return 0;
  }
}

/**
 * חישוב זמן טיפול ממוצע
 * מהזמנה עד השלמה
 */
async function calculateAvgProcessingTime(): Promise<number> {
  try {
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const completedOrders = await prisma.order.findMany({
      where: {
        status: OrderStatus.SUPPLIED,
        createdAt: { gte: last30Days },
      },
      select: {
        createdAt: true,
        updatedAt: true,
      },
    });

    if (completedOrders.length === 0) return 0;

    const totalDays = completedOrders.reduce((sum, order) => {
      const days = Math.floor(
        (order.updatedAt.getTime() - order.createdAt.getTime()) / (24 * 60 * 60 * 1000)
      );
      return sum + days;
    }, 0);

    return Math.round((totalDays / completedOrders.length) * 10) / 10; // Round to 1 decimal
  } catch (error) {
    console.error('Error calculating avg processing time:', error);
    return 0;
  }
}
