/**
 * Prisma Orders Repository Implementation
 *
 * Implements the IOrdersRepository interface using Prisma ORM
 *
 * @module lib/repositories/implementations/PrismaOrdersRepository
 */

import { logger } from '@/lib/logger';
import { NotificationService } from '@/lib/notifications/service';
import type { OrderChannel, OrderStatus, PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import type {
  CreateOrderInput,
  IOrdersRepository,
  OrderFilter,
  OrderWithRelations,
  PaginatedResult,
  PaginationOptions,
  UpdateOrderInput,
} from '../interfaces/IOrdersRepository';

/**
 * Default pagination options
 */
const DEFAULT_PAGINATION: PaginationOptions = {
  page: 1,
  limit: 20,
};

/**
 * Prisma Orders Repository
 */
export class PrismaOrdersRepository implements IOrdersRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Get include options for relations
   */
  private getIncludeOptions(includeRelations: boolean = false) {
    if (!includeRelations) {
      return undefined;
    }

    return {
      customer: true,
      items: {
        include: {
          product: true,
          supplier: true,
        },
      },
      billingAddress: true,
      shippingAddress: true,
      payments: true,
      statusHistory: {
        include: {
          changedByUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc' as const,
        },
      },
      assignedUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      tasks: true,
    };
  }

  /**
   * Build where clause from filter
   */
  private buildWhereClause(filter?: OrderFilter): Prisma.OrderWhereInput {
    if (!filter) {
      return { deletedAt: null };
    }

    const where: Prisma.OrderWhereInput = {
      deletedAt: null,
    };

    if (filter.customerId) {
      where.customerId = filter.customerId;
    }

    if (filter.status) {
      where.status = Array.isArray(filter.status) ? { in: filter.status } : filter.status;
    }

    if (filter.channel) {
      where.channel = filter.channel;
    }

    if (filter.priority) {
      where.priority = filter.priority;
    }

    if (filter.paymentStatus) {
      where.paymentStatus = filter.paymentStatus;
    }

    if (filter.city) {
      where.city = { contains: filter.city, mode: 'insensitive' as const };
    }

    if (filter.assignedUserId) {
      where.assignedUserId = filter.assignedUserId;
    }

    if (filter.stage && filter.stage.length > 0) {
      where.stage = { in: filter.stage };
    }

    if (filter.taskLabel && filter.taskLabel.length > 0) {
      where.taskLabel = { in: filter.taskLabel };
    }

    if (filter.createdAfter) {
      where.createdAt =
        typeof where.createdAt === 'object' && where.createdAt !== null
          ? { ...where.createdAt, gte: filter.createdAfter }
          : { gte: filter.createdAfter };
    }

    if (filter.createdBefore) {
      where.createdAt =
        typeof where.createdAt === 'object' && where.createdAt !== null
          ? { ...where.createdAt, lte: filter.createdBefore }
          : { lte: filter.createdBefore };
    }

    if (filter.search) {
      where.OR = [
        { number: { contains: filter.search, mode: 'insensitive' as const } },
        { customerName: { contains: filter.search, mode: 'insensitive' as const } },
        { customerEmail: { contains: filter.search, mode: 'insensitive' as const } },
        { customerPhone: { contains: filter.search, mode: 'insensitive' as const } },
      ];
    }

    return where;
  }

  async findById(
    id: string,
    includeRelations: boolean = false
  ): Promise<OrderWithRelations | null> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id },
        include: this.getIncludeOptions(includeRelations),
      });

      return order as OrderWithRelations | null;
    } catch (error) {
      logger.error('Error finding order by ID', error, { orderId: id });
      throw error;
    }
  }

  async findByNumber(
    number: string,
    includeRelations: boolean = false
  ): Promise<OrderWithRelations | null> {
    try {
      const order = await this.prisma.order.findFirst({
        where: { number },
        include: this.getIncludeOptions(includeRelations),
      });

      return order as OrderWithRelations | null;
    } catch (error) {
      logger.error('Error finding order by number', error, { number });
      throw error;
    }
  }

  async findMany(
    filter?: OrderFilter,
    pagination: PaginationOptions = DEFAULT_PAGINATION
  ): Promise<PaginatedResult<OrderWithRelations>> {
    try {
      const where = this.buildWhereClause(filter);
      const skip = (pagination.page - 1) * pagination.limit;

      const [orders, total] = await Promise.all([
        this.prisma.order.findMany({
          where,
          include: this.getIncludeOptions(true),
          skip,
          take: pagination.limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.order.count({ where }),
      ]);

      const totalPages = Math.ceil(total / pagination.limit);

      return {
        data: orders as OrderWithRelations[],
        total,
        page: pagination.page,
        limit: pagination.limit,
        totalPages,
        hasNext: pagination.page < totalPages,
        hasPrev: pagination.page > 1,
      };
    } catch (error) {
      logger.error('Error finding orders', error, { filter });
      throw error;
    }
  }

  async findByCustomer(
    customerId: string,
    pagination: PaginationOptions = DEFAULT_PAGINATION
  ): Promise<PaginatedResult<OrderWithRelations>> {
    return this.findMany({ customerId }, pagination);
  }

  async findByStatus(
    status: OrderStatus | OrderStatus[],
    pagination: PaginationOptions = DEFAULT_PAGINATION
  ): Promise<PaginatedResult<OrderWithRelations>> {
    return this.findMany({ status }, pagination);
  }

  async create(data: CreateOrderInput): Promise<OrderWithRelations> {
    try {
      const order = await this.prisma.order.create({
        data: {
          customerId: data.customerId,
          billingAddressId: data.billingAddressId,
          shippingAddressId: data.shippingAddressId,
          channel: data.channel || 'MANUAL',
          subTotalCents: data.subTotalCents,
          taxCents: data.taxCents,
          shippingCents: data.shippingCents,
          discountCents: data.discountCents,
          totalCents: data.totalCents,
          currency: data.currency,
          notes: data.notes,
          notesInternal: data.notesInternal,
          priority: data.priority || 'MEDIUM',
          createdByUserId: data.createdByUserId,
          number: await this.generateOrderNumber(),
          items: {
            create: data.items.map((item) => ({
              productId: item.productId,
              sku: item.sku,
              name: item.name,
              description: item.description,
              qty: item.qty,
              priceCents: item.priceCents,
              totalCents: item.totalCents,
              supplierId: item.supplierId,
              taxRate: 0.17, // Default Israeli VAT
              vatCategory: 'STANDARD' as const,
            })),
          },
        },
        include: this.getIncludeOptions(true),
      });

      logger.info('Order created', {
        orderId: order.id,
        orderNumber: order.number,
        customerId: data.customerId,
      });

      // Send Notification
      try {
        await NotificationService.broadcastNotification({
          role: 'ADMIN',
          title: `הזמנה חדשה: ${order.number}`,
          message: `התקבלה הזמנה חדשה. סכום: ${(order.totalCents / 100).toLocaleString('he-IL', { style: 'currency', currency: 'ILS' })}`,
          link: `/orders/${order.id}`,
          severity: 'INFO',
        });
      } catch (notifyError) {
        logger.error('Failed to send notification for new order', notifyError);
      }

      return order as OrderWithRelations;
    } catch (error) {
      logger.error('Error creating order', error, { data });
      throw error;
    }
  }

  async update(id: string, data: UpdateOrderInput): Promise<OrderWithRelations> {
    try {
      const order = await this.prisma.order.update({
        where: { id },
        data,
        include: this.getIncludeOptions(true),
      });

      logger.info('Order updated', { orderId: id, changes: Object.keys(data) });

      return order as OrderWithRelations;
    } catch (error) {
      logger.error('Error updating order', error, { orderId: id, data });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      // Soft delete
      await this.prisma.order.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      logger.info('Order deleted (soft)', { orderId: id });
    } catch (error) {
      logger.error('Error deleting order', error, { orderId: id });
      throw error;
    }
  }

  async count(filter?: OrderFilter): Promise<number> {
    try {
      const where = this.buildWhereClause(filter);
      return await this.prisma.order.count({ where });
    } catch (error) {
      logger.error('Error counting orders', error, { filter });
      throw error;
    }
  }

  async getStats(filter?: OrderFilter): Promise<{
    total: number;
    byStatus: Record<OrderStatus, number>;
    byChannel: Record<OrderChannel, number>;
    totalRevenue: number;
    avgOrderValue: number;
  }> {
    try {
      const where = this.buildWhereClause(filter);

      const [total, byStatus, byChannel, revenue] = await Promise.all([
        this.prisma.order.count({ where }),
        this.prisma.order.groupBy({
          by: ['status'],
          where,
          _count: true,
        }),
        this.prisma.order.groupBy({
          by: ['channel'],
          where,
          _count: true,
        }),
        this.prisma.order.aggregate({
          where,
          _sum: { totalCents: true },
        }),
      ]);

      const totalRevenue = revenue._sum.totalCents || 0;
      const avgOrderValue = total > 0 ? totalRevenue / total : 0;

      return {
        total,
        byStatus: byStatus.reduce(
          (acc, { status, _count }) => {
            acc[status] = _count;
            return acc;
          },
          {} as Record<OrderStatus, number>
        ),
        byChannel: byChannel.reduce(
          (acc, { channel, _count }) => {
            acc[channel] = _count;
            return acc;
          },
          {} as Record<OrderChannel, number>
        ),
        totalRevenue,
        avgOrderValue,
      };
    } catch (error) {
      logger.error('Error getting order stats', error, { filter });
      throw error;
    }
  }

  async getSalesStats(period: 'day' | 'week' | 'month' | 'year'): Promise<any> {
    // TODO: Implement sales stats logic
    return {};
  }

  async logEvent(entry: {
    orderId: string;
    userId: string;
    type: string;
    payload?: any;
  }): Promise<void> {
    await this.prisma.eventLog.create({
      data: {
        orderId: entry.orderId,
        userId: entry.userId,
        type: entry.type,
        payload: entry.payload ?? Prisma.JsonNull,
      },
    });
  }

  async getFinancialStats(filter?: OrderFilter): Promise<{
    totalRevenue: number;
    outstanding: number;
    collected: number;
    overdue: number;
  }> {
    try {
      const where = this.buildWhereClause(filter);

      const [aggregates, overdueAggregates] = await Promise.all([
        this.prisma.order.aggregate({
          where,
          _sum: {
            totalCents: true,
            paidAmountCents: true,
          },
        }),
        this.prisma.order.aggregate({
          where: {
            AND: [
              where,
              {
                status: {
                  in: ['COMPLETED', 'SUPPLIED', 'INVOICED'],
                },
                paymentStatus: {
                  notIn: ['PAID', 'REFUNDED'],
                },
              },
            ],
          },
          _sum: {
            totalCents: true,
            paidAmountCents: true,
          },
        }),
      ]);

      const totalRevenue = aggregates._sum.totalCents || 0;
      const collected = aggregates._sum.paidAmountCents || 0;
      const outstanding = totalRevenue - collected;

      const overdueTotal = overdueAggregates._sum?.totalCents || 0;
      const overduePaid = overdueAggregates._sum?.paidAmountCents || 0;
      const overdue = overdueTotal - overduePaid;

      return {
        totalRevenue,
        outstanding,
        collected,
        overdue,
      };
    } catch (error) {
      logger.error('Error getting financial stats', error, { filter });
      throw error;
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const count = await this.prisma.order.count({
        where: { id, deletedAt: null },
      });
      return count > 0;
    } catch (error) {
      logger.error('Error checking order existence', error, { orderId: id });
      throw error;
    }
  }

  async transaction<T>(fn: (repo: IOrdersRepository) => Promise<T>): Promise<T> {
    return await this.prisma.$transaction(async (tx) => {
      const txRepo = new PrismaOrdersRepository(tx as PrismaClient);
      return await fn(txRepo);
    });
  }

  /**
   * Generate unique order number
   */
  private async generateOrderNumber(): Promise<string> {
    const count = await this.prisma.order.count();
    return `ORD-${(count + 1).toString().padStart(6, '0')}`;
  }
}
