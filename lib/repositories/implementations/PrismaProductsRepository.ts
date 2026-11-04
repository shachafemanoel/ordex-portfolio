/**
 * Prisma Products Repository Implementation
 *
 * @module lib/repositories/implementations/PrismaProductsRepository
 */

import { logger } from '@/lib/logger';
import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  CreateProductInput,
  IProductsRepository,
  ProductFilter,
  ProductWithRelations,
  UpdateProductInput,
} from '../interfaces/IProductsRepository';

export class PrismaProductsRepository implements IProductsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  private getIncludeOptions(includeRelations: boolean = false) {
    if (!includeRelations) return undefined;

    return {
      defaultSupplier: true,
      orderItems: {
        take: 10,
        orderBy: { createdAt: 'desc' as const },
      },
    };
  }

  private buildWhereClause(filter?: ProductFilter): Prisma.ProductWhereInput {
    if (!filter) return {};

    const where: Prisma.ProductWhereInput = {};

    if (filter.sku) {
      where.sku = { equals: filter.sku, mode: 'insensitive' as const };
    }

    if (filter.supplierId) {
      where.defaultSupplierId = filter.supplierId;
    }

    if (filter.isActive !== undefined) {
      where.isActive = filter.isActive;
    }

    if (filter.search) {
      where.OR = [
        { name: { contains: filter.search, mode: 'insensitive' as const } },
        { sku: { contains: filter.search, mode: 'insensitive' as const } },
        { description: { contains: filter.search, mode: 'insensitive' as const } },
      ];
    }

    return where;
  }

  async findById(
    id: string,
    includeRelations: boolean = false
  ): Promise<ProductWithRelations | null> {
    try {
      return (await this.prisma.product.findUnique({
        where: { id },
        include: this.getIncludeOptions(includeRelations),
      })) as ProductWithRelations | null;
    } catch (error) {
      logger.error('Error finding product by ID', error, { productId: id });
      throw error;
    }
  }

  async findBySku(sku: string): Promise<ProductWithRelations | null> {
    try {
      return (await this.prisma.product.findFirst({
        where: { sku },
        include: this.getIncludeOptions(true),
      })) as ProductWithRelations | null;
    } catch (error) {
      logger.error('Error finding product by SKU', error, { sku });
      throw error;
    }
  }

  async findMany(filter?: ProductFilter): Promise<ProductWithRelations[]> {
    try {
      const where = this.buildWhereClause(filter);
      return (await this.prisma.product.findMany({
        where,
        include: this.getIncludeOptions(true),
        orderBy: { name: 'asc' },
      })) as ProductWithRelations[];
    } catch (error) {
      logger.error('Error finding products', error, { filter });
      throw error;
    }
  }

  async findBySupplier(supplierId: string): Promise<ProductWithRelations[]> {
    return this.findMany({ supplierId });
  }

  async create(data: CreateProductInput): Promise<ProductWithRelations> {
    try {
      const product = await this.prisma.product.create({
        data: {
          sku: data.sku,
          name: data.name,
          description: data.description,
          basePriceCents: data.basePriceCents,
          defaultSupplierId: data.supplierId,
          isActive: data.isActive ?? true,
        },
        include: this.getIncludeOptions(true),
      });

      logger.info('Product created', { productId: product.id, sku: data.sku });
      return product as ProductWithRelations;
    } catch (error) {
      logger.error('Error creating product', error, { data });
      throw error;
    }
  }

  async update(id: string, data: UpdateProductInput): Promise<ProductWithRelations> {
    try {
      const product = await this.prisma.product.update({
        where: { id },
        data: {
          ...data,
          defaultSupplierId: data.supplierId,
        },
        include: this.getIncludeOptions(true),
      });

      logger.info('Product updated', { productId: id, changes: Object.keys(data) });
      return product as ProductWithRelations;
    } catch (error) {
      logger.error('Error updating product', error, { productId: id, data });
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.product.delete({ where: { id } });
      logger.info('Product deleted', { productId: id });
    } catch (error) {
      logger.error('Error deleting product', error, { productId: id });
      throw error;
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const count = await this.prisma.product.count({ where: { id } });
      return count > 0;
    } catch (error) {
      logger.error('Error checking product existence', error, { productId: id });
      throw error;
    }
  }

  async search(query: string, limit: number = 20): Promise<ProductWithRelations[]> {
    return this.findMany({ search: query });
  }

  async transaction<T>(fn: (repo: IProductsRepository) => Promise<T>): Promise<T> {
    return await this.prisma.$transaction(async (tx) => {
      const txRepo = new PrismaProductsRepository(tx as PrismaClient);
      return await fn(txRepo);
    });
  }
}
