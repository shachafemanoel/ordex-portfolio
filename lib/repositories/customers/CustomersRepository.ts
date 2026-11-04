import { CacheService } from '@/lib/cache/CacheService';
import { getPrismaClient } from '@/lib/db';
import { Logger } from '@/lib/logger';
import { Prisma } from '@prisma/client';
import { BaseRepository, PaginationParams, RepositoryResult } from '@/lib/repositories/base/BaseRepository';

export type CustomerCreateInput = Prisma.CustomerCreateInput;

export interface CustomerFilters {
  q?: string;
  city?: string;
  lifecycle?: string[];
  riskLevel?: string[];
}

export class CustomersRepository extends BaseRepository<any, CustomerFilters, any, any> {
  constructor(cache: CacheService, logger: Logger) {
    super('Customer', cache, logger);
  }

  protected getDefaultInclude() {
    return {
      addresses: true,
    };
  }

  protected buildWhereClause(filters: CustomerFilters): Prisma.CustomerWhereInput {
    const where: Prisma.CustomerWhereInput = {};

    if (filters.q) {
      where.OR = [
        { name: { contains: filters.q, mode: 'insensitive' } },
        { email: { contains: filters.q, mode: 'insensitive' } },
        { phone: { contains: filters.q } },
      ];
    }

    if (filters.city) {
      where.addresses = {
        some: {
          city: { contains: filters.city, mode: 'insensitive' },
        },
      };
    }

    if (filters.lifecycle?.length) {
      where.lifecycle = { in: filters.lifecycle as any };
    }

    if (filters.riskLevel?.length) {
      where.riskLevel = { in: filters.riskLevel as any };
    }

    return where;
  }

  /**
   * List customers with filters and pagination
   */
  async list(filters: CustomerFilters, pagination: { page?: number; perPage?: number } = {}) {
    const prisma = getPrismaClient();
    const page = Math.max(1, pagination.page ?? 1);
    const perPage = Math.min(Math.max(pagination.perPage ?? 50, 1), 200);
    const skip = (page - 1) * perPage;
    const where = this.buildWhereClause(filters);

    const [items, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: perPage,
        include: {
          ...this.getDefaultInclude(),
          _count: { select: { orders: true } },
        },
      }),
      prisma.customer.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / perPage));

    return {
      items,
      total,
      page,
      perPage,
      totalPages,
    };
  }

  /**
   * Find customers with filters and pagination
   */
  async findAll(
    filters: CustomerFilters,
    pagination: PaginationParams = { limit: 50 }
  ): Promise<RepositoryResult<any>> {
    const prisma = getPrismaClient();

    const where = this.buildWhereClause(filters);
    const take = pagination.limit;
    const skip = pagination.cursor ? 1 : 0;
    const cursor = pagination.cursor ? { id: pagination.cursor } : undefined;

    const [items, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        take,
        skip,
        cursor,
        orderBy: { createdAt: 'desc' },
        include: this.getDefaultInclude(),
      }),
      this.count(filters),
    ]);

    const hasMore = items.length === take;
    const nextCursor = hasMore ? items[items.length - 1].id : undefined;

    return {
      items,
      total,
      hasMore,
      nextCursor,
    };
  }

  /**
   * Create a new customer
   */
  async create(data: Prisma.CustomerCreateInput, tx?: Prisma.TransactionClient) {
    const prisma = tx || getPrismaClient();
    const customer = await prisma.customer.create({
      data,
      include: this.getDefaultInclude(),
    });

    return customer;
  }

  /**
   * Record order charge on customer ledger
   */
  async recordOrderCharge(
    customerId: string,
    orderId: string,
    amountCents: number,
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    const prisma = tx || getPrismaClient();

    // Fetch current balance to calculate running balance
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { currentBalanceCents: true },
    });

    const currentBalance = customer?.currentBalanceCents || 0;
    const newBalance = currentBalance + amountCents;

    await prisma.customerLedgerEntry.create({
      data: {
        customerId,
        orderId,
        type: 'CHARGE',
        deltaCents: amountCents,
        balanceCents: newBalance,
        description: `Order charge for order ${orderId}`,
      },
    });

    // Update customer balance
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        currentBalanceCents: {
          increment: amountCents,
        },
      },
    });

    this.logger.info('Customer ledger entry recorded', { customerId, orderId, amountCents });
  }

  /**
   * Record payment on customer ledger
   */
  async recordPayment(
    customerId: string,
    orderId: string,
    paymentId: string,
    amountCents: number,
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    const prisma = tx || getPrismaClient();

    // Fetch current balance
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { currentBalanceCents: true },
    });

    const currentBalance = customer?.currentBalanceCents || 0;
    const newBalance = currentBalance - amountCents;

    await prisma.customerLedgerEntry.create({
      data: {
        customerId,
        orderId,
        paymentId,
        type: 'PAYMENT',
        deltaCents: -amountCents, // Negative for payment
        balanceCents: newBalance,
        description: `Payment for order ${orderId}`,
      },
    });

    // Update customer balance
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        currentBalanceCents: {
          decrement: amountCents,
        },
      },
    });

    this.logger.info('Customer payment recorded', { customerId, orderId, paymentId, amountCents });
  }

  /**
   * Get customer balance
   */
  async getBalance(customerId: string): Promise<number> {
    const customer = await this.findById(customerId);
    return customer?.currentBalanceCents ?? 0;
  }

  /**
   * Get customer ledger entries
   */
  async getLedgerEntries(customerId: string, limit: number = 50, tx?: Prisma.TransactionClient) {
    const prisma = tx || getPrismaClient();

    return prisma.customerLedgerEntry.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        order: { select: { id: true, number: true } },
        payment: { select: { id: true, method: true } },
      },
    });
  }
}
