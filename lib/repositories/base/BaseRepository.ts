import type { CacheService } from '@/lib/cache/CacheService';
import { getPrismaClient } from '@/lib/db';
import type { Logger } from '@/lib/logger';
import type { Prisma } from '@prisma/client';

export interface PaginationParams {
  cursor?: string;
  limit: number;
  sortBy?: string;
}

export interface RepositoryResult<T> {
  items: T[];
  total: number;
  hasMore: boolean;
  nextCursor?: string;
}

export abstract class BaseRepository<
  TModel extends Record<string, any>,
  TFilters,
  TCreate,
  TUpdate,
> {
  protected readonly modelName: Prisma.ModelName;

  constructor(
    modelName: Prisma.ModelName,
    protected cache: CacheService,
    protected logger: Logger
  ) {
    this.modelName = modelName;
  }

  /**
   * Find single entity by ID
   */
  async findById(id: string, include?: any, tx?: Prisma.TransactionClient): Promise<TModel | null> {
    const cacheKey = `${this.modelName}:${id}`;

    // Try cache if not in transaction
    if (!tx && this.cache.isAvailable()) {
      const cached = await this.cache.get<TModel>(cacheKey);
      if (cached) {
        this.logger.debug('Cache hit', { key: cacheKey });
        return cached;
      }
    }

    const prisma = tx || getPrismaClient();

    // Safety check for undefined prisma client
    if (!prisma) {
      throw new Error(
        `BaseRepository.findById: Prisma client is undefined for model ${this.modelName}`
      );
    }

    const modelKey = this.modelName.toLowerCase() as keyof typeof prisma;
    const model = prisma[modelKey] as any;

    // Safety check for undefined model
    if (!model) {
      throw new Error(
        `BaseRepository.findById: Model '${this.modelName}' (key: '${String(modelKey)}') not found on Prisma client. Available models: ${Object.keys(
          prisma
        )
          .filter((k) => !k.startsWith('$') && !k.startsWith('_'))
          .join(', ')}`
      );
    }

    const entity = await model.findUnique({
      where: { id },
      include: include || this.getDefaultInclude(),
    });

    if (!tx && entity) {
      await this.cache.set(cacheKey, entity, 300);
    }

    return entity;
  }

  /**
   * Count entities matching filters
   */
  async count(filters: TFilters, tx?: Prisma.TransactionClient): Promise<number> {
    const prisma = tx || getPrismaClient();
    if (!prisma) {
      throw new Error(
        `BaseRepository.count: Prisma client is undefined for model ${this.modelName}`
      );
    }
    const model = prisma[this.modelName.toLowerCase() as keyof typeof prisma] as any;
    if (!model) {
      throw new Error(`BaseRepository.count: Model '${this.modelName}' not found on Prisma client`);
    }

    const where = this.buildWhereClause(filters);
    return model.count({ where });
  }

  /**
   * Soft delete entity
   */
  async softDelete(id: string, tx?: Prisma.TransactionClient): Promise<TModel> {
    const prisma = tx || getPrismaClient();
    if (!prisma) {
      throw new Error(
        `BaseRepository.softDelete: Prisma client is undefined for model ${this.modelName}`
      );
    }
    const model = prisma[this.modelName.toLowerCase() as keyof typeof prisma] as any;
    if (!model) {
      throw new Error(
        `BaseRepository.softDelete: Model '${this.modelName}' not found on Prisma client`
      );
    }

    const updated = await model.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: this.getDefaultInclude(),
    });

    // Invalidate cache
    await this.cache.invalidate(`${this.modelName}:${id}:*`);
    await this.cache.invalidate(`${this.modelName}:list:*`);

    return updated;
  }

  /**
   * Build cache key for list queries
   */
  protected buildCacheKey(filters: TFilters, pagination: PaginationParams): string {
    const hash = JSON.stringify({ filters, pagination });
    return `${this.modelName}:list:${hash}`;
  }

  /**
   * Build ORDER BY clause from sortBy string
   */
  protected buildOrderBy(sortBy?: string): any {
    if (!sortBy) return { createdAt: 'desc' };

    const [field, direction = 'desc'] = sortBy.split(':');
    return { [field]: direction };
  }

  /**
   * Abstract methods - must be implemented by subclass
   */
  protected abstract getDefaultInclude(): any;
  protected abstract buildWhereClause(filters: TFilters): any;
}
