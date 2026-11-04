import { ordersRepo } from '@/lib/data/ordersRepo';
import { prisma } from '@/lib/db';
import { OrderStatus } from '@prisma/client';

export type RevenueInterval = 'day' | 'month';

export async function getRevenueTimeline(
  from: Date,
  to: Date,
  interval: RevenueInterval = 'month'
) {
  // Prisma doesn't support complex date truncation in groupBy easily for all DBs,
  // but for Postgres we can use raw queries or retrieve and process.
  // For efficiency on large datasets, raw query is better.
  // However, strict typing is nice. Let's try raw query for groupings.

  const datePart = interval === 'month' ? 'month' : 'day';

  // Note: This raw query syntax is Postgres specific.
  const result = await prisma.$queryRaw<{ date: Date; revenue: number; count: number }[]>`
    SELECT 
      DATE_TRUNC(${datePart}, created_at) as date,
      SUM(total_cents) as revenue,
      COUNT(id) as count
    FROM orders
    WHERE 
      created_at >= ${from} 
      AND created_at <= ${to}
      AND status NOT IN ('DRAFT', 'CANCELLED')
    GROUP BY date
    ORDER BY date ASC
  `;

  // Convert BigInt revenue (if prisma returns it as such) to number and cents to decimals if needed
  // Prisma $queryRaw might return numbers as BigInt, need to handle serialization usually.
  // But standard number types often work if not exceeding JS limits.
  // total_cents is Int in schema, so Sum might be BigInt.

  return result.map((row) => ({
    date: row.date,
    revenue: Number(row.revenue || 0) / 100, // Handle BigInt return + Null
    ordersCount: Number(row.count || 0), // Handle BigInt return
  }));
}

export async function getTopSellingProducts(limit: number = 5) {
  const result = await prisma.orderItem.groupBy({
    by: ['productId', 'name'],
    _sum: {
      qty: true,
      totalCents: true,
    },
    orderBy: {
      _sum: {
        totalCents: 'desc',
      },
    },
    take: limit,
  });

  return result.map((item) => ({
    productId: item.productId,
    name: item.name,
    quantity: item._sum.qty || 0,
    revenue: (item._sum.totalCents || 0) / 100,
  }));
}

export async function getManagementKPIs(from?: Date, to?: Date) {
  const where = {
    createdAt: {
      gte: from,
      lte: to,
    },
    // Exclude drafts/cancelled for "Active" metrics usually, but depends on definition.
    // Let's define:
    // Revenue = Everything not cancelled/draft
    // Orders = Count of all non-draft
  };

  const revenueAgg = await prisma.order.aggregate({
    _sum: { totalCents: true },
    where: {
      ...where,
      status: { notIn: ['DRAFT', 'CANCELLED'] as OrderStatus[] },
    },
  });

  const ordersCount = await prisma.order.count({
    where: {
      ...where,
      status: { not: 'DRAFT' as OrderStatus },
    },
  });

  const activeCustomersCount = await prisma.customer.count({
    where: {
      orders: {
        some: {
          createdAt: {
            gte: from || new Date(new Date().setMonth(new Date().getMonth() - 1)), // Active in last month if no date
          },
        },
      },
    },
  });

  // New customers in period
  const newCustomersCount = await prisma.customer.count({
    where: {
      createdAt: {
        gte: from,
        lte: to,
      },
    },
  });

  return {
    totalRevenue: (revenueAgg._sum.totalCents || 0) / 100,
    totalOrders: ordersCount,
    activeCustomers: activeCustomersCount,
    newCustomers: newCustomersCount,
  };
}

export async function getStatusDistribution(from?: Date, to?: Date) {
  return ordersRepo.getStatusBreakdown({
    dateFrom: from?.toISOString(),
    dateTo: to?.toISOString(),
  });
}

export const analyticsRepo = {
  getRevenueTimeline,
  getTopSellingProducts,
  getManagementKPIs,
  getStatusDistribution,
};
