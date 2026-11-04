import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';

export interface OrderRepoFilters {
  dateFrom?: string;
  dateTo?: string;
  city?: string;
  status?: string[];
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const ordersRepo = {
  async getStatusBreakdown(filters: {
    dateFrom?: string;
    dateTo?: string;
    city?: string;
    status?: string[];
  }) {
    const where: Prisma.OrderWhereInput = {};
    const createdAt: Prisma.DateTimeFilter = {};
    if (filters.dateFrom) createdAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) createdAt.lte = new Date(filters.dateTo);
    if (Object.keys(createdAt).length > 0) {
      where.createdAt = createdAt;
    }
    if (filters.city) where.city = { contains: filters.city };
    if (filters.status?.length) where.status = { in: filters.status as any };

    const grouped = await prisma.order.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
      _sum: { totalCents: true },
    });

    return grouped;
  },

  async list(filters: OrderRepoFilters) {
    const where: Prisma.OrderWhereInput = {};
    const createdAt: Prisma.DateTimeFilter = {};
    if (filters.dateFrom) createdAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) createdAt.lte = new Date(filters.dateTo);
    if (Object.keys(createdAt).length > 0) {
      where.createdAt = createdAt;
    }
    if (filters.city) where.city = { contains: filters.city };
    if (filters.status?.length) where.status = { in: filters.status as any };

    const orders = await prisma.order.findMany({
      where,
      take: filters.limit || 50,
      orderBy: { [filters.sortBy || 'createdAt']: filters.sortOrder || 'desc' },
      include: { customer: { select: { name: true } } },
    });

    return orders.map((o) => ({
      ...o,
      customerName: o.customer?.name,
    }));
  },
};
