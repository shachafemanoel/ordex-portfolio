import { createCacheService } from '@/lib/cache/CacheService';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { normalizeOrderStatus } from '@/lib/orderStatus';
import { CustomersRepository } from '@/lib/repositories/customers/CustomersRepository';
import { OrdersRepository } from '@/lib/repositories/orders/OrdersRepository';
import { ProductsRepository } from '@/lib/repositories/products/ProductsRepository';
import { AuditService } from '@/lib/services/audit/AuditService';
import { EventLogService } from '@/lib/services/events/EventLogService';
import { MapService } from '@/lib/services/map/MapService';
import { OrdersService } from '@/src/server/domain/orders/OrdersService';
import {
  getCompletedCount,
  getInstallationsPendingCount,
  getOrderStatusMetrics,
} from '@/lib/services/orders/orderMetrics';
import { PaymentsService } from '@/lib/services/payments/PaymentsService';
import { percent, percentChange, safeDivide } from '@/lib/utils/kpi';

export class DashboardService {
  private mapService = new MapService();
  private eventLogService = new EventLogService();
  private cache = createCacheService();
  private ordersRepo = new OrdersRepository(this.cache, logger);
  private customersRepo = new CustomersRepository(this.cache, logger);
  private productsRepo = new ProductsRepository(this.cache, logger);
  private auditService = new AuditService();
  private paymentsService = new PaymentsService(logger, this.auditService);
  private ordersService = new OrdersService(
    this.ordersRepo,
    this.customersRepo,
    this.productsRepo,
    logger,
    this.auditService,
    this.paymentsService
  );

  async getOverview() {
    const statusMetrics = await getOrderStatusMetrics();
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    // Start of current month
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    // Start of previous month
    const startOfLastMonth = new Date(currentYear, currentMonth - 1, 1);
    // End of previous month
    const endOfLastMonth = new Date(currentYear, currentMonth, 0);

    const [
      revenueAgg,
      customersAgg,
      productsAgg,
      mapData,
      eventsResult,
      recentOrders,
      activeCustomersAgg,
      currentMonthRevenueAgg,
      lastMonthRevenueAgg,
    ] = await Promise.all([
      // Total revenue (current behavior)
      prisma.order.aggregate({ where: statusMetrics.where, _sum: { totalCents: true } }),

      // Total customers and CLV
      prisma.customer.aggregate({
        _count: { id: true },
        _sum: { clvCents: true },
      }),

      // Total products
      prisma.product.aggregate({
        _count: { id: true },
      }),

      // Map data
      this.mapService.getOrdersMap(200),

      // Events
      this.eventLogService.fetchEvents({ limit: 30 }),

      // Recent orders
      this.ordersService.listOrders({}, { limit: 10, sortBy: 'createdAt:desc' }),

      // Active customers (customers with orders in the current month)
      prisma.order.groupBy({
        by: ['customerId'],
        where: {
          createdAt: {
            gte: startOfMonth,
          },
        },
      }),

      // Current month revenue
      prisma.order.aggregate({
        where: {
          createdAt: { gte: startOfMonth },
          deletedAt: null,
        },
        _sum: { totalCents: true },
      }),

      // Last month revenue
      prisma.order.aggregate({
        where: {
          createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
          deletedAt: null,
        },
        _sum: { totalCents: true },
      }),
    ]);

    const statusCounts = statusMetrics.statusCounts;
    const totalOrders = statusMetrics.totalOrders;

    const totalRevenueCents = revenueAgg._sum.totalCents ?? 0;
    const totalRevenue = totalRevenueCents / 100;

    // Use safe helper
    const avgOrderValue = safeDivide(totalRevenue, totalOrders) ?? 0;

    // Monthly Growth
    const currentMonthRevenue = (currentMonthRevenueAgg._sum.totalCents ?? 0) / 100;
    const lastMonthRevenue = (lastMonthRevenueAgg._sum.totalCents ?? 0) / 100;
    const monthlyGrowth = percentChange(currentMonthRevenue, lastMonthRevenue) ?? 0;

    // Active Customers
    const activeCustomers = activeCustomersAgg.length;

    // Service Level (Completed / Total valid orders)
    // Avoid dividing by zero using helper.
    // If totalOrdersAgg is 0, we can return 0 or null.
    // The requirement is "Never show fake percentages (like 98.5%) when denominator is zero".
    // "UI shows 'N/A' when value is null".
    // So let's return null if no orders.
    const completedCount = getCompletedCount(statusMetrics.aggregatedCounts);
    const serviceLevel = percent(completedCount, totalOrders);

    const summary = {
      totalOrders,
      totalRevenue,
      avgOrderValue,
      completed: completedCount,
      installationsPending: getInstallationsPendingCount(statusMetrics.aggregatedCounts),
      activeCustomers,
      monthlyGrowth: Number(monthlyGrowth.toFixed(1)),
      serviceLevel,
      customers: {
        total: customersAgg._count.id ?? 0,
        clv: Number(customersAgg._sum.clvCents ?? 0) / 100,
      },
      products: {
        total: productsAgg._count.id ?? 0,
      },
    };

    // Map events to CalendarEvent format
    const events = eventsResult.items.map((event) => {
      let type: 'installation' | 'delivery' | 'meeting' | 'other' = 'other';
      if (event.type === 'CALENDAR') type = 'installation';
      if (event.type === 'ORDER_STATUS' && event.status === 'COMPLETED') type = 'delivery';

      return {
        id: event.id,
        title: event.title,
        date: new Date(event.timestamp),
        type,
      };
    });

    return {
      summary,
      statusCounts,
      recentOrders: recentOrders.items.map((order) => ({
        id: order.id,
        number: order.number,
        customerName: order.customer?.name ?? 'לא ידוע',
        status: normalizeOrderStatus(order.status as any),
        totalAmount: order.total,
        createdAt: order.createdAt,
      })),
      map: mapData,
      events,
    };
  }

  /**
   * Get actionable items for the dashboard feed
   * Returns urgent orders, today's installations, and assigned tasks
   */
  async getActionFeed(userId: string) {
    // Get urgent orders
    const urgentOrders = await prisma.order.findMany({
      where: {
        deletedAt: null,
        completedAt: null,
      },
      include: {
        customer: true,
        shippingAddress: true,
      },
      orderBy: {
        createdAt: 'asc', // Oldest first = most urgent
      },
      take: 10,
    });

    // Get today's installations
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayInstallations = await prisma.order.findMany({
      where: {
        scheduledAt: {
          gte: today,
          lt: tomorrow,
        },
        deletedAt: null,
        completedAt: null,
      },
      include: {
        customer: true,
        shippingAddress: true,
      },
      take: 5,
    });

    // Get user's assigned tasks
    const userTasks = await prisma.task.findMany({
      where: {
        assigneeId: userId,
        status: 'OPEN',
      },
      include: {
        order: {
          include: {
            customer: true,
          },
        },
      },
      orderBy: {
        dueAt: 'asc',
      },
      take: 5,
    });

    const items: any[] = [];

    // Convert orders to action items
    urgentOrders.forEach((order) => {
      const customerName = order.customer?.name || order.customerName || 'לקוח מזדמן';
      const totalAmount = Math.round((order.totalCents || 0) / 100);
      const isOld = new Date(order.createdAt).getTime() < Date.now() - 1000 * 60 * 60 * 48;

      items.push({
        id: order.id,
        type: 'order_approval',
        title: `הזמנה #${order.number} - ${order.status}`,
        subtitle: `לקוח: ${customerName} • סכום: ₪${totalAmount.toLocaleString()}`,
        timestamp: new Date(order.createdAt).toLocaleDateString('he-IL'),
        priority: isOld ? 'high' : 'medium',
        href: `/orders/${order.id}`,
      });
    });

    // Convert installations to action items
    todayInstallations.forEach((order) => {
      const customerName = order.customer?.name || order.customerName || 'לקוח';
      const address = order.shippingAddress
        ? `${order.shippingAddress.street} ${order.shippingAddress.number}, ${order.shippingAddress.city}`
        : order.city || 'כתובת לא ידועה';
      const time = order.scheduledAt
        ? new Date(order.scheduledAt).toLocaleTimeString('he-IL', {
            hour: '2-digit',
            minute: '2-digit',
          })
        : '';

      items.push({
        id: order.id,
        type: 'installation',
        title: `התקנה אצל ${customerName}`,
        subtitle: address,
        timestamp: `היום, ${time}`,
        priority: 'medium',
        href: `/orders/${order.id}`,
      });
    });

    // Convert tasks to action items
    userTasks.forEach((task) => {
      const customerName = task.order?.customer?.name || task.order?.customerName || '';
      const dueDate = task.dueAt
        ? new Date(task.dueAt).toLocaleDateString('he-IL')
        : 'ללא תאריך יעד';
      const isOverdue = task.dueAt && new Date(task.dueAt) < new Date();

      items.push({
        id: task.id,
        type: 'task',
        title: task.notes || 'משימה',
        subtitle: customerName ? `לקוח: ${customerName}` : dueDate,
        timestamp: dueDate,
        priority: isOverdue ? 'high' : task.priority === 'HIGH' ? 'high' : 'low',
        href: task.orderId ? `/orders/${task.orderId}` : `/tasks/${task.id}`,
      });
    });

    // Sort by priority
    return items
      .sort((a, b) => {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        return (
          priorityOrder[a.priority as keyof typeof priorityOrder] -
          priorityOrder[b.priority as keyof typeof priorityOrder]
        );
      })
      .slice(0, 10);
  }

  /**
   * Get sales chart data for the last 7 days
   */
  async getSalesChartData() {
    const labels: string[] = [];
    const data: number[] = [];

    // Generate last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      // Format label
      labels.push(
        date.toLocaleDateString('he-IL', {
          weekday: 'short',
        })
      );

      // Sum payments for this day
      const result = await prisma.payment.aggregate({
        where: {
          paymentDate: {
            gte: date,
            lt: nextDate,
          },
          status: 'PAID',
        },
        _sum: {
          amountCents: true,
        },
      });

      // Convert cents to shekels
      data.push((result._sum.amountCents || 0) / 100);
    }

    return { labels, data };
  }
}
