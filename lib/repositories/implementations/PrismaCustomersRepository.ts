/**
 * Prisma Customers Repository Implementation
 *
 * @module lib/repositories/implementations/PrismaCustomersRepository
 */

import type { PrismaClient, Prisma } from '@prisma/client';
import type {
  ICustomersRepository,
  CustomerFilter,
  CustomerWithRelations,
  CreateCustomerInput,
  UpdateCustomerInput,
} from '../interfaces/ICustomersRepository';
import { logger } from '@/lib/logger';

export class PrismaCustomersRepository implements ICustomersRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private getIncludeOptions(includeRelations: boolean = false) {
    if (!includeRelations) return undefined;

    return {
      addresses: true,
      orders: {
        take: 10,
        orderBy: { createdAt: 'desc' as const },
      },
      ledgerEntries: {
        take: 20,
        orderBy: { createdAt: 'desc' as const },
      },
    };
  }

  private buildWhereClause(filter?: CustomerFilter): Prisma.CustomerWhereInput {
    if (!filter) return {};

    const where: Prisma.CustomerWhereInput = {};

    if (filter.email) {
      where.email = { equals: filter.email, mode: 'insensitive' as const };
    }

    if (filter.phone) {
      where.phone = { equals: filter.phone, mode: 'insensitive' as const };
    }

    if (filter.creditLimitAbove !== undefined) {
      where.creditLimitCents = { gte: filter.creditLimitAbove };
    }

    if (filter.currentBalanceAbove !== undefined) {
      where.currentBalanceCents = { gte: filter.currentBalanceAbove };
    }

    if (filter.currentBalanceBelow !== undefined) {
      where.currentBalanceCents = { lte: filter.currentBalanceBelow };
    }

    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' as const } },
        { email: { contains: filter.search, mode: 'insensitive' as const } },
        { phone: { contains: filter.search, mode: 'insensitive' as const } },
      ];
    }

    return where;
  }

  async findById(id: string, includeRelations: boolean = false): Promise<CustomerWithRelations | null> {
    try {
      return await this.prisma.customer.findUnique({
        where: { id },
        include: this.getIncludeOptions(includeRelations),
      }) as CustomerWithRelations | null;
    } catch (error) {
      logger.error('Error finding customer by ID', error, { customerId: id });
      throw error;
    }
  }

  async findByEmail(email: string): Promise<CustomerWithRelations | null> {
    try {
      return await this.prisma.customer.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } },
      }) as CustomerWithRelations | null;
    } catch (error) {
      logger.error('Error finding customer by email', error, { email });
      throw error;
    }
  }

  async findByPhone(phone: string): Promise<CustomerWithRelations | null> {
    try {
      return await this.prisma.customer.findFirst({
        where: { phone: { equals: phone, mode: 'insensitive' } },
      }) as CustomerWithRelations | null;
    } catch (error) {
      logger.error('Error finding customer by phone', error, { phone });
      throw error;
    }
  }

  async findMany(filter?: CustomerFilter): Promise<CustomerWithRelations[]> {
    try {
      const where = this.buildWhereClause(filter);
      return await this.prisma.customer.findMany({
        where,
        include: this.getIncludeOptions(true),
        orderBy: { createdAt: 'desc' },
      }) as CustomerWithRelations[];
    } catch (error) {
      logger.error('Error finding customers', error, { filter });
      throw error;
    }
  }

  async create(data: CreateCustomerInput): Promise<CustomerWithRelations> {
    try {
      const customer = await this.prisma.customer.create({
        data,
        include: this.getIncludeOptions(true),
      });

      logger.info('Customer created', { customerId: customer.id, name: data.name });
      return customer as CustomerWithRelations;
    } catch (error) {
      logger.error('Error creating customer', error, { data });
      throw error;
    }
  }

  async update(id: string, data: UpdateCustomerInput): Promise<CustomerWithRelations> {
    try {
      const customer = await this.prisma.customer.update({
        where: { id },
        data,
        include: this.getIncludeOptions(true),
      });

      logger.info('Customer updated', { customerId: id, changes: Object.keys(data) });
      return customer as CustomerWithRelations;
    } catch (error) {
      logger.error('Error updating customer', error, { customerId: id, data });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.customer.delete({ where: { id } });
      logger.info('Customer deleted', { customerId: id });
    } catch (error) {
      logger.error('Error deleting customer', error, { customerId: id });
      throw error;
    }
  }

  async updateBalance(id: string, deltaCents: number): Promise<CustomerWithRelations> {
    try {
      const customer = await this.prisma.customer.update({
        where: { id },
        data: {
          currentBalanceCents: {
            increment: deltaCents,
          },
        },
        include: this.getIncludeOptions(true),
      });

      logger.info('Customer balance updated', { customerId: id, deltaCents });
      return customer as CustomerWithRelations;
    } catch (error) {
      logger.error('Error updating customer balance', error, { customerId: id, deltaCents });
      throw error;
    }
  }

  async getAccountSummary(id: string): Promise<{
    customer: CustomerWithRelations;
    outstandingOrders: number;
    overdueAmount: number;
    availableCredit: number;
  }> {
    try {
      const customer = await this.findById(id, true);
      if (!customer) {
        throw new Error(`Customer not found: ${id}`);
      }

      const outstandingOrders = await this.prisma.order.count({
        where: {
          customerId: id,
          status: { notIn: ['SUPPLIED', 'CANCELLED'] },
        },
      });

      const creditLimit = customer.creditLimitCents || 0;
      const availableCredit = Math.max(0, creditLimit - customer.currentBalanceCents);

      return {
        customer,
        outstandingOrders,
        overdueAmount: Math.max(0, customer.currentBalanceCents),
        availableCredit,
      };
    } catch (error) {
      logger.error('Error getting customer account summary', error, { customerId: id });
      throw error;
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const count = await this.prisma.customer.count({ where: { id } });
      return count > 0;
    } catch (error) {
      logger.error('Error checking customer existence', error, { customerId: id });
      throw error;
    }
  }

  async transaction<T>(fn: (repo: ICustomersRepository) => Promise<T>): Promise<T> {
    return await this.prisma.$transaction(async (tx) => {
      const txRepo = new PrismaCustomersRepository(tx as PrismaClient);
      return await fn(txRepo);
    });
  }
}
