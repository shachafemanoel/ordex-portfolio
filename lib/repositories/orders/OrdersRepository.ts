import type { CacheService } from '@/lib/cache/CacheService';
import {
  UnifiedOrder,
  getUnifiedOrder,
  listOrders as listUnifiedOrders,
} from '@/lib/data/ordersRedis';
import { getPrismaClient } from '@/lib/db';
import type { Logger } from '@/lib/logger';
import {
  BaseRepository,
  PaginationParams,
  RepositoryResult,
} from '@/lib/repositories/base/BaseRepository';
import { OrderStatus, Prisma } from '@prisma/client';

// Type definitions
export interface OrderFilters {
  status?: string[];
  customerId?: string;
  assignedUserId?: string;
  city?: string;
  priority?: string[];
  channel?: string[];
  paymentStatus?: string[];
  dateFrom?: string;
  dateTo?: string;
  scheduledAt?: string;
  overdue?: boolean;
  q?: string;
  tab?: 'now' | 'later' | 'ready' | 'sent';
  /**
   * When true, include soft-deleted rows. Defaults to false so "active" means deletedAt is null.
   */
  includeDeleted?: boolean;
  /**
   * Explicit demo filter override. If omitted, production environments exclude demo orders unless ORDERS_INCLUDE_DEMO is set.
   */
  includeDemo?: boolean;
  /**
   * Filter by demo flag explicitly (e.g., demo-only views). Overrides includeDemo if provided.
   */
  demo?: boolean;
}

export interface OrderVisibilityOptions {
  includeDeleted?: boolean;
  includeDemo?: boolean;
  demo?: boolean;
}

const TRUE_VALUES = new Set(['true', '1', 'yes', 'on']);

function parseBoolean(value?: string | null): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  return TRUE_VALUES.has(value.trim().toLowerCase());
}

export function buildOrderWhereClause(
  filters: OrderFilters,
  visibilityOverrides?: OrderVisibilityOptions
): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};

  // Active orders: default to soft-deleted = null unless explicitly overridden
  const includeDeleted = visibilityOverrides?.includeDeleted ?? filters.includeDeleted ?? false;
  if (!includeDeleted) {
    where.deletedAt = null;
  }

  // Demo/test orders: default to excluding demo orders in production unless explicitly allowed
  const explicitDemoFilter =
    typeof visibilityOverrides?.demo === 'boolean' ? visibilityOverrides.demo : filters.demo;
  const includeDemo = visibilityOverrides?.includeDemo ?? filters.includeDemo;

  if (typeof explicitDemoFilter === 'boolean') {
    where.demo = explicitDemoFilter;
  } else {
    const envIncludeDemo = parseBoolean(process.env.ORDERS_INCLUDE_DEMO);
    const runtimeEnv = (process.env.APP_ENV || process.env.NODE_ENV || '').trim().toLowerCase();
    const defaultDemoFilter = runtimeEnv === 'production' ? false : undefined;
    const resolvedDemo =
      typeof includeDemo === 'boolean'
        ? includeDemo
        : envIncludeDemo !== undefined
          ? envIncludeDemo
          : defaultDemoFilter;

    if (typeof resolvedDemo === 'boolean') {
      where.demo = resolvedDemo;
    }
  }

  if (filters.status?.length) {
    where.status = { in: filters.status as any };
  }

  // Tab filtering
  if (filters.tab) {
    const activeStatuses = Object.values(OrderStatus).filter(
      (s) => !['COMPLETED', 'CANCELLED', 'CLOSED', 'REFUNDED'].includes(s)
    );

    switch (filters.tab) {
      case 'now':
        where.onHold = false;
        if (!filters.status) {
          where.status = {
            in: activeStatuses.filter(
              (s) =>
                ![
                  'READY',
                  'READY_FOR_INSTALL',
                  'INSTALL_SCHEDULING',
                  'IN_TRANSIT',
                  'INSTALLATION',
                  'INSTALLED',
                ].includes(s)
            ) as any,
          };
        }
        break;
      case 'later':
        where.onHold = true;
        break;
      case 'ready':
        where.onHold = false;
        where.status = { in: ['READY', 'READY_FOR_INSTALL', 'INSTALL_SCHEDULING'] as any };
        break;
      case 'sent':
        where.status = { in: ['IN_TRANSIT', 'INSTALLATION', 'INSTALLED'] as any };
        break;
    }
  }

  if (filters.customerId) {
    where.customerId = filters.customerId;
  }

  if (filters.assignedUserId) {
    where.assignedUserId = filters.assignedUserId;
  }

  if (filters.city) {
    where.city = { contains: filters.city, mode: 'insensitive' };
  }

  if (filters.priority?.length) {
    where.priority = { in: filters.priority as any };
  }

  if (filters.channel?.length) {
    where.channel = { in: filters.channel as any };
  }

  if (filters.paymentStatus?.length) {
    where.paymentStatus = { in: filters.paymentStatus as any };
  }

  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {};
    if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
  }

  if (filters.scheduledAt) {
    const date = new Date(filters.scheduledAt);
    if (!isNaN(date.getTime())) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      where.scheduledAt = {
        gte: start,
        lte: end,
      };
    }
  }

  if (filters.overdue) {
    where.dueDate = { lt: new Date() };
    // Usually combined with active statuses
    if (!filters.status) {
      where.status = { notIn: ['COMPLETED', 'CANCELLED'] as any };
    }
  }

  if (filters.q) {
    where.OR = [
      { number: { contains: filters.q, mode: 'insensitive' } },
      { customerName: { contains: filters.q, mode: 'insensitive' } },
      { customerEmail: { contains: filters.q, mode: 'insensitive' } },
      { customerPhone: { contains: filters.q } },
    ];
  }

  return where;
}

export type OrderEntity = Prisma.OrderGetPayload<{
  include: typeof ORDER_DEFAULT_INCLUDE;
}>;

export type OrderDetailEntity = Prisma.OrderGetPayload<{
  include: typeof ORDER_DETAIL_INCLUDE;
}>;

// Include patterns - use explicit select to avoid circular references
// Customer has `orders` back-relation, Address has `billingOrders/shippingOrders`
// Using `include: true` would cause infinite recursion in Prisma serialization
const ORDER_DEFAULT_INCLUDE = {
  customer: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      lifecycle: true,
      tags: true,
    },
  },
  billingAddress: {
    select: {
      id: true,
      type: true,
      city: true,
      street: true,
      number: true,
      floor: true,
      notes: true,
      lat: true,
      lng: true,
      apartment: true,
    },
  },
  shippingAddress: {
    select: {
      id: true,
      type: true,
      city: true,
      street: true,
      number: true,
      floor: true,
      notes: true,
      lat: true,
      lng: true,
      apartment: true,
    },
  },
  items: {
    select: {
      id: true,
      sku: true,
      name: true,
      qty: true,
      priceCents: true,
      totalCents: true,
      received: true,
      receivedQuantity: true,
      allocationStatus: true,
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          basePriceCents: true,
          stock: true,
          isActive: true,
        },
      },
      supplier: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
    },
  },
  assignedUser: { select: { id: true, name: true, email: true, role: true } },
  labels: {
    select: {
      id: true,
      name: true,
      color: true,
    },
  },
} as const;

const ORDER_LIST_INCLUDE = {
  ...ORDER_DEFAULT_INCLUDE,
  _count: { select: { items: true, payments: true, labels: true } },
} as const;

const { labels: _ignoredDefaultLabels, ...ORDER_DEFAULT_INCLUDE_WITHOUT_LABELS } =
  ORDER_DEFAULT_INCLUDE;

const ORDER_LIST_INCLUDE_WITHOUT_LABELS = {
  ...ORDER_DEFAULT_INCLUDE_WITHOUT_LABELS,
  _count: { select: { items: true, payments: true } },
} as const;

const LEGACY_ORDER_SELECT = {
  id: true,
  number: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  totalCents: true,
  subTotalCents: true,
  taxCents: true,
  shippingCents: true,
  discountCents: true,
  paidAmountCents: true,
  paymentStatus: true,
  currency: true,
  priority: true,
  channel: true,
  city: true,
  scheduledAt: true,
  dueDate: true,
  lat: true,
  lng: true,
  latitude: true,
  longitude: true,
  customerName: true,
  customerPhone: true,
  customerEmail: true,
  notes: true,
  notesInternal: true,
  customerId: true,
  assignedUserId: true,
} as const;

const LEGACY_ORDER_SELECT_MIN = {
  id: true,
  number: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

const ORDER_DETAIL_INCLUDE = {
  ...ORDER_DEFAULT_INCLUDE,
  labels: {
    select: {
      id: true,
      name: true,
      color: true,
      stage: true,
    },
  },
  payments: {
    select: {
      id: true,
      status: true,
      amountCents: true,
      method: true,
      reference: true,
      createdAt: true,
    },
  },
  statusHistory: {
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      reason: true,
      metadata: true,
      createdAt: true,
      changedByUser: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: 'desc' as Prisma.SortOrder },
  },
  noteEntries: {
    select: {
      id: true,
      content: true,
      createdAt: true,
      user: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: 'desc' as Prisma.SortOrder },
  },
  calendarEvents: {
    select: {
      id: true,
      title: true,
      startTime: true,
      endTime: true,
    },
  },
} as const;

const ORDER_DETAIL_INCLUDE_WITHOUT_LABELS = {
  ...ORDER_DEFAULT_INCLUDE_WITHOUT_LABELS,
  payments: {
    select: {
      id: true,
      status: true,
      amountCents: true,
      method: true,
      reference: true,
      createdAt: true,
    },
  },
  statusHistory: {
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      reason: true,
      metadata: true,
      createdAt: true,
      changedByUser: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: 'desc' as Prisma.SortOrder },
  },
  noteEntries: {
    select: {
      id: true,
      content: true,
      createdAt: true,
      user: {
        select: { id: true, name: true },
      },
    },
    orderBy: { createdAt: 'desc' as Prisma.SortOrder },
  },
  calendarEvents: {
    select: {
      id: true,
      title: true,
      startTime: true,
      endTime: true,
    },
  },
} as const;

function extractPrismaMissingTable(
  error: Prisma.PrismaClientKnownRequestError
): string | undefined {
  const meta = error.meta as Record<string, unknown> | undefined;
  const table = meta?.table;
  return typeof table === 'string' ? table : undefined;
}

function isMissingLabelsRelationError(
  error: unknown
): error is Prisma.PrismaClientKnownRequestError {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code !== 'P2021') return false;
  const table = extractPrismaMissingTable(error);
  // Check both meta table and message for robustness
  return (typeof table === 'string' && /label/i.test(table)) || /label/i.test(error.message);
}

function isInvalidEnumValueError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2007' // Data validation error (invalid enum value)
  );
}

function extractPrismaMissingColumn(
  error: Prisma.PrismaClientKnownRequestError
): string | undefined {
  const meta = error.meta as Record<string, unknown> | undefined;
  const column = meta?.column;
  return typeof column === 'string' ? column : undefined;
}

function isMissingColumnError(error: unknown): error is Prisma.PrismaClientKnownRequestError {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2022';
}

function removeInvalidStatuses(where: Prisma.OrderWhereInput): Prisma.OrderWhereInput {
  const next = { ...where };
  // Check if status filter exists and is an 'in' filter
  if (
    next.status &&
    typeof next.status === 'object' &&
    'in' in next.status &&
    Array.isArray(next.status.in)
  ) {
    const invalidStatuses = ['CANCELLED', 'READY_FOR_INSTALL'];
    next.status = {
      ...next.status,
      in: next.status.in.filter((s: any) => !invalidStatuses.includes(s)),
    };
  }
  return next;
}

function withEmptyLabels<T extends Record<string, any>>(order: T): T {
  const next: Record<string, any> = { ...order };
  if (!Array.isArray(next.labels)) {
    next.labels = [];
  }
  if (next._count && typeof next._count === 'object' && typeof next._count.labels !== 'number') {
    next._count = { ...next._count, labels: 0 };
  }
  return next as T;
}

export function normalizeLegacyOrderRow(row: Record<string, any>): Record<string, any> {
  return {
    id: row.id,
    number: row.number ?? '',
    status: row.status ?? OrderStatus.DRAFT,
    createdAt: row.createdAt ?? new Date(),
    updatedAt: row.updatedAt ?? new Date(),
    totalCents: typeof row.totalCents === 'number' ? row.totalCents : 0,
    subTotalCents:
      typeof row.subTotalCents === 'number'
        ? row.subTotalCents
        : typeof row.totalCents === 'number'
          ? row.totalCents
          : 0,
    taxCents: typeof row.taxCents === 'number' ? row.taxCents : 0,
    shippingCents: typeof row.shippingCents === 'number' ? row.shippingCents : 0,
    discountCents: typeof row.discountCents === 'number' ? row.discountCents : 0,
    paidAmountCents: typeof row.paidAmountCents === 'number' ? row.paidAmountCents : 0,
    paymentStatus: row.paymentStatus ?? 'PENDING',
    currency: row.currency ?? 'ILS',
    priority: row.priority ?? 'MEDIUM',
    channel: row.channel ?? 'MANUAL',
    city: row.city ?? null,
    scheduledAt: row.scheduledAt ?? null,
    dueDate: row.dueDate ?? null,
    lat: (typeof row.lat === 'number' ? row.lat : null) ?? (typeof row.latitude === 'number' ? row.latitude : null),
    lng: (typeof row.lng === 'number' ? row.lng : null) ?? (typeof row.longitude === 'number' ? row.longitude : null),
    latitude: (typeof row.latitude === 'number' ? row.latitude : null) ?? (typeof row.lat === 'number' ? row.lat : null),
    longitude: (typeof row.longitude === 'number' ? row.longitude : null) ?? (typeof row.lng === 'number' ? row.lng : null),
    customerName: row.customerName ?? null,
    customerPhone: row.customerPhone ?? null,
    customerEmail: row.customerEmail ?? null,
    notes: row.notes ?? null,
    notesInternal: row.notesInternal ?? null,
    customerId: row.customerId ?? '',
    assignedUserId: row.assignedUserId ?? null,
    customer: null,
    billingAddress: null,
    shippingAddress: null,
    items: [],
    labels: [],
    assignedUser: null,
    _count: {
      items: 0,
      payments: 0,
      labels: 0,
    },
  };
}

export class OrdersRepository extends BaseRepository<
  OrderEntity,
  OrderFilters,
  Prisma.OrderCreateInput,
  Prisma.OrderUpdateInput
> {
  constructor(cache: CacheService, logger: Logger) {
    super('Order', cache, logger);
  }

  /**
   * Find orders with filters and pagination
   */
  async findOrders(
    filters: OrderFilters,
    pagination: PaginationParams,
    tx?: Prisma.TransactionClient
  ): Promise<RepositoryResult<OrderEntity>> {
    const prisma = tx || getPrismaClient();

    // Try cache (if not in transaction)
    if (!tx && this.cache.isAvailable()) {
      const cacheKey = this.buildCacheKey(filters, pagination);
      const cached = await this.cache.get<RepositoryResult<OrderEntity>>(cacheKey);
      if (cached) {
        this.logger.debug('Cache hit', { key: cacheKey });
        return cached;
      }
    }

    // Try Redis first (if no transaction)
    if (!tx) {
      try {
        // Parse sortBy parameter (e.g., 'createdAt:desc') for Redis
        const [sortField, sortDirection] = (pagination.sortBy || 'createdAt:desc').split(':');
        const redisResult = await listUnifiedOrders({
          q: filters.q,
          status: filters.status,
          city: filters.city,
          userId: filters.assignedUserId,
          clientId: filters.customerId,
          dateFrom: filters.dateFrom,
          dateTo: filters.dateTo,
          sortBy: sortField || 'createdAt',
          sortDir: (sortDirection?.toLowerCase() === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc',
          page: pagination.cursor ? undefined : 1, // Cursor pagination not fully supported on Redis list yet, fallback to page 1 if not offset
          limit: pagination.limit,
        });

        if (redisResult) {
          const items = redisResult.items.map(mapUnifiedToEntity);
          return {
            items,
            total: redisResult.total,
            hasMore: items.length === pagination.limit, // Approximation
            nextCursor: undefined, // Redis uses offset/limit, not cursor
          };
        }
      } catch (e) {
        this.logger.error('Redis list orders failed, falling back to DB', e);
      }
    }

    // Build WHERE clause
    const where = this.buildWhereClause(filters);

    // Execute query
    let items: any[] = [];
    let total = 0;
    try {
      [items, total] = await Promise.all([
        prisma.order.findMany({
          where,
          include: ORDER_LIST_INCLUDE,
          orderBy: this.buildOrderBy(pagination.sortBy),
          cursor: pagination.cursor ? { id: pagination.cursor } : undefined,
          take: pagination.limit,
          skip: pagination.cursor ? 1 : 0,
        }),
        prisma.order.count({ where }),
      ]);
    } catch (error) {
      if (isMissingColumnError(error)) {
        this.logger.warn('Orders list query failed due to legacy schema; using fallback query', {
          code: error.code,
          column: extractPrismaMissingColumn(error),
        });
        return this.findOrdersLegacyFallback(prisma, filters, pagination, error);
      }

      let currentWhere = where;
      let currentInclude: Prisma.OrderInclude = ORDER_LIST_INCLUDE;
      let retry = false;
      let emptyLabels = false;

      // Handle Invalid Enum Value (P2007)
      if (isInvalidEnumValueError(error)) {
        this.logger.warn('Invalid enum value detected; retrying with filtered status', { error });
        currentWhere = removeInvalidStatuses(where);
        retry = true;
      }

      // Handle Missing Labels Table (P2021)
      if (isMissingLabelsRelationError(error)) {
        this.logger.warn('Labels table missing; retrying orders list without labels relation', {
          table: extractPrismaMissingTable(error),
        });
        currentInclude = ORDER_LIST_INCLUDE_WITHOUT_LABELS;
        emptyLabels = true;
        retry = true;
      }

      if (!retry) {
        throw error;
      }

      try {
        [items, total] = await Promise.all([
          prisma.order.findMany({
            where: currentWhere,
            include: currentInclude,
            orderBy: this.buildOrderBy(pagination.sortBy),
            cursor: pagination.cursor ? { id: pagination.cursor } : undefined,
            take: pagination.limit,
            skip: pagination.cursor ? 1 : 0,
          }),
          prisma.order.count({ where: currentWhere }),
        ]);

        if (emptyLabels) {
          items = items.map((item) => withEmptyLabels(item));
        }
      } catch (retryError) {
        let retry_again = false;

        if (isMissingLabelsRelationError(retryError) && !emptyLabels) {
          this.logger.warn('Labels table missing on retry; retrying again', {
            table: extractPrismaMissingTable(retryError),
          });
          currentInclude = ORDER_LIST_INCLUDE_WITHOUT_LABELS;
          emptyLabels = true;
          retry_again = true;
        } else if (isInvalidEnumValueError(retryError)) {
          this.logger.warn('Invalid enum value detected on retry; retrying again', {
            error: retryError,
          });
          currentWhere = removeInvalidStatuses(currentWhere);
          retry_again = true;
        }

        if (retry_again) {
          [items, total] = await Promise.all([
            prisma.order.findMany({
              where: currentWhere,
              include: currentInclude,
              orderBy: this.buildOrderBy(pagination.sortBy),
              cursor: pagination.cursor ? { id: pagination.cursor } : undefined,
              take: pagination.limit,
              skip: pagination.cursor ? 1 : 0,
            }),
            prisma.order.count({ where: currentWhere }),
          ]);
          if (emptyLabels) {
            items = items.map((item) => withEmptyLabels(item));
          }
        } else {
          if (isMissingColumnError(retryError)) {
            this.logger.warn(
              'Orders list retry failed due to legacy schema; using fallback query',
              {
                code: retryError.code,
                column: extractPrismaMissingColumn(retryError),
              }
            );
            return this.findOrdersLegacyFallback(prisma, filters, pagination, retryError);
          }
          throw retryError;
        }
      }
    }

    const result = {
      items,
      total,
      hasMore: items.length === pagination.limit,
      nextCursor: items.length > 0 ? items[items.length - 1].id : undefined,
    };

    return result;
  }

  /**
   * Find order by ID with optional includes
   * Supports both UUID and order number (ORD-*) lookups
   */
  async findById(
    id: string,
    options?: { includeDetails?: boolean },
    tx?: Prisma.TransactionClient
  ): Promise<OrderEntity | OrderDetailEntity | null> {
    const include = options?.includeDetails ? ORDER_DETAIL_INCLUDE : ORDER_DEFAULT_INCLUDE;
    const includeWithoutLabels = options?.includeDetails
      ? ORDER_DETAIL_INCLUDE_WITHOUT_LABELS
      : ORDER_DEFAULT_INCLUDE_WITHOUT_LABELS;
    const prisma = tx || getPrismaClient();

    const findWithInclude = async (activeInclude: typeof include) => {
      // Determine if this is a UUID or something else (Order Number)
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          id.trim()
        );

      if (!isUuid) {
        // Query by order number (smart lookup: exact or endsWith)
        this.logger.debug(`Finding order by number (non-UUID input): ${id}`);

        // 1. Exact match
        const exactMatch = await prisma.order.findFirst({
          where: { number: { equals: id.trim(), mode: 'insensitive' } },
          include: activeInclude,
        });
        if (exactMatch) return exactMatch;

        // 2. Ends-with match (e.g., searching "1024" finds "ORD-2024-1024")
        // Only if input is meaningful length to avoid overly broad matches
        if (id.trim().length >= 3) {
          const fuzzyMatch = await prisma.order.findFirst({
            where: { number: { endsWith: id.trim() } },
            include: activeInclude,
            orderBy: { createdAt: 'desc' }, // Prefer most recent if duplicates (e.g. ORD-2023-1024 vs ORD-2024-1024)
          });
          if (fuzzyMatch) return fuzzyMatch;
        }

        return null;
      }

      // Order detail requires full-fidelity fields (status history, notes, item allocation state),
      // so bypass Redis snapshots and fetch directly from the database.
      if (!tx && !options?.includeDetails) {
        try {
          const unified = await getUnifiedOrder(id);
          if (unified) {
            return mapUnifiedToEntity(unified);
          }
        } catch (e) {
          this.logger.error(`Redis get order ${id} failed, falling back to DB`, e);
        }
      }

      if (options?.includeDetails) {
        return prisma.order.findUnique({
          where: { id },
          include: activeInclude,
        }) as Promise<OrderEntity | OrderDetailEntity | null>;
      }

      return super.findById(id, activeInclude, tx) as Promise<OrderEntity | OrderDetailEntity | null>;
    };

    try {
      return await findWithInclude(include);
    } catch (error) {
      if (!isMissingLabelsRelationError(error)) {
        throw error;
      }
      this.logger.warn('Labels table missing; retrying order fetch without labels relation', {
        table: extractPrismaMissingTable(error),
      });
      const fallbackOrder = await findWithInclude(includeWithoutLabels as typeof include);
      return fallbackOrder ? withEmptyLabels(fallbackOrder) : null;
    }
  }

  /**
   * Create order - returns essential data only to avoid Prisma proxy serialization issues
   */
  async createOrder(
    data: Prisma.OrderCreateInput,
    tx?: Prisma.TransactionClient
  ): Promise<{ id: string; customerId: string; number: string }> {
    const prisma = tx || getPrismaClient();

    // Create order with minimal select to avoid serialization overflow across transaction boundary
    const created = await prisma.order.create({
      data,
      select: { id: true, customerId: true, number: true },
    });

    // Invalidate cache
    await this.cache.invalidate('Order:list:*');

    this.logger.info('Order created', { orderId: created.id });

    return created;
  }

  /**
   * Get order with full includes (for use after transaction commits)
   */
  async getOrderWithIncludes(id: string): Promise<OrderEntity | null> {
    const { getBasePrismaClient } = await import('@/lib/db');
    const baseDb = getBasePrismaClient();

    let order = null as any;
    try {
      order = await baseDb.order.findUnique({
        where: { id },
        include: ORDER_DEFAULT_INCLUDE,
      });
    } catch (error) {
      if (!isMissingLabelsRelationError(error)) {
        throw error;
      }
      this.logger.warn('Labels table missing; retrying order includes without labels relation', {
        table: extractPrismaMissingTable(error),
      });
      order = await baseDb.order.findUnique({
        where: { id },
        include: ORDER_DEFAULT_INCLUDE_WITHOUT_LABELS,
      });
      order = order ? withEmptyLabels(order) : null;
    }

    if (!order) return null;

    // Convert to plain object to avoid Prisma proxy issues
    return JSON.parse(JSON.stringify(order)) as OrderEntity;
  }

  /**
   * Update order
   */
  async updateOrder(
    id: string,
    data: Prisma.OrderUpdateInput,
    tx?: Prisma.TransactionClient
  ): Promise<OrderEntity> {
    const prisma = tx || getPrismaClient();

    let order = null as any;
    try {
      order = await prisma.order.update({
        where: { id },
        data,
        include: ORDER_DEFAULT_INCLUDE,
      });
    } catch (error) {
      if (!isMissingLabelsRelationError(error)) {
        throw error;
      }
      this.logger.warn('Labels table missing; retrying order update without labels relation', {
        table: extractPrismaMissingTable(error),
      });
      order = await prisma.order.update({
        where: { id },
        data,
        include: ORDER_DEFAULT_INCLUDE_WITHOUT_LABELS,
      });
      order = withEmptyLabels(order);
    }

    // Invalidate cache
    await this.cache.invalidate(`Order:${id}:*`);
    await this.cache.invalidate('Order:list:*');

    this.logger.info('Order updated', { orderId: id });
    return order;
  }

  /**
   * Update order status
   */
  async updateStatus(
    id: string,
    status: string,
    tx?: Prisma.TransactionClient
  ): Promise<OrderEntity> {
    return this.updateOrder(id, { status: status as any }, tx);
  }

  /**
   * Create status history entry
   */
  async createStatusHistory(
    orderId: string,
    fromStatus: string | null,
    toStatus: string,
    userId: string,
    reason?: string,
    metadata?: Record<string, any>,
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    const prisma = tx || getPrismaClient();

    await prisma.statusHistory.create({
      data: {
        orderId,
        fromStatus: fromStatus as any,
        toStatus: toStatus as any,
        changedBy: userId,
        reason,
        metadata: metadata ? (metadata as any) : undefined,
      },
    });

    this.logger.info('Status history created', { orderId, fromStatus, toStatus });
  }

  async getStatusHistory(orderId: string, tx?: Prisma.TransactionClient) {
    const prisma = tx || getPrismaClient();
    return prisma.statusHistory.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
      include: { changedByUser: true },
    });
  }

  /**
   * Build WHERE clause
   */
  protected buildWhereClause(filters: OrderFilters): Prisma.OrderWhereInput {
    return buildOrderWhereClause(filters);
  }

  private async findOrdersLegacyFallback(
    prisma: Prisma.TransactionClient | ReturnType<typeof getPrismaClient>,
    filters: OrderFilters,
    pagination: PaginationParams,
    sourceError: Prisma.PrismaClientKnownRequestError
  ): Promise<RepositoryResult<OrderEntity>> {
    const { tab: _ignoredTab, ...legacySafeFilters } = filters;
    const legacyWhere = buildOrderWhereClause({
      ...legacySafeFilters,
      includeDeleted: true,
      includeDemo: true,
    });

    const runFallbackQuery = async (
      select: typeof LEGACY_ORDER_SELECT | typeof LEGACY_ORDER_SELECT_MIN
    ) => {
      const [rows, totalCount] = await Promise.all([
        prisma.order.findMany({
          where: legacyWhere,
          select,
          orderBy: { createdAt: 'desc' },
          cursor: pagination.cursor ? { id: pagination.cursor } : undefined,
          take: pagination.limit,
          skip: pagination.cursor ? 1 : 0,
        }),
        prisma.order.count({ where: legacyWhere }).catch(() => 0),
      ]);
      return { rows, totalCount };
    };

    try {
      let fallbackRows: Array<Record<string, any>> = [];
      let fallbackTotal = 0;

      try {
        const fallbackResult = await runFallbackQuery(LEGACY_ORDER_SELECT);
        fallbackRows = fallbackResult.rows as Array<Record<string, any>>;
        fallbackTotal = fallbackResult.totalCount;
      } catch (legacyError) {
        if (!isMissingColumnError(legacyError)) {
          throw legacyError;
        }

        this.logger.warn(
          'Legacy orders fallback still hit missing column; retrying minimal select',
          {
            sourceCode: sourceError.code,
            sourceColumn: extractPrismaMissingColumn(sourceError),
            retryCode: legacyError.code,
            retryColumn: extractPrismaMissingColumn(legacyError),
          }
        );

        const minimalResult = await runFallbackQuery(LEGACY_ORDER_SELECT_MIN);
        fallbackRows = minimalResult.rows as Array<Record<string, any>>;
        fallbackTotal = minimalResult.totalCount;
      }

      const items = fallbackRows.map((row) => normalizeLegacyOrderRow(row));
      const total = fallbackTotal || fallbackRows.length;

      return {
        items: items as OrderEntity[],
        total,
        hasMore: fallbackRows.length === pagination.limit,
        nextCursor:
          fallbackRows.length > 0 && fallbackRows[fallbackRows.length - 1]?.id
            ? String(fallbackRows[fallbackRows.length - 1].id)
            : undefined,
      };
    } catch (fallbackError) {
      if (isMissingColumnError(fallbackError)) {
        this.logger.error(
          'Orders list legacy fallback failed due to missing column; returning empty list',
          fallbackError,
          {
            code: fallbackError.code,
            column: extractPrismaMissingColumn(fallbackError),
          }
        );
      } else {
        this.logger.error(
          'Orders list legacy fallback failed unexpectedly; returning empty list',
          fallbackError
        );
      }
      return {
        items: [],
        total: 0,
        hasMore: false,
        nextCursor: undefined,
      };
    }
  }

  /**
   * Parse sortBy parameter (e.g., 'createdAt:desc') into Prisma orderBy object
   */
  protected buildOrderBy(sortBy?: string): Prisma.OrderOrderByWithRelationInput {
    if (!sortBy) {
      return { createdAt: 'desc' }; // Default sort
    }

    // Parse 'field:direction' format
    const [field, direction] = sortBy.split(':');
    const sortDirection = (direction?.toLowerCase() === 'asc' ? 'asc' : 'desc') as Prisma.SortOrder;

    // Map common sort fields
    const fieldMap: Record<string, Prisma.OrderOrderByWithRelationInput> = {
      createdAt: { createdAt: sortDirection },
      updatedAt: { updatedAt: sortDirection },
      number: { number: sortDirection },
      status: { status: sortDirection },
      totalCents: { totalCents: sortDirection },
      priority: { priority: sortDirection },
    };

    return fieldMap[field] || { createdAt: 'desc' };
  }

  protected getDefaultInclude() {
    return ORDER_DEFAULT_INCLUDE;
  }
}

// Helper to map Redis UnifiedOrder to Prisma OrderEntity shape
export function mapUnifiedToEntity(u: UnifiedOrder): OrderEntity {
  return {
    id: u.id,
    number: u.number,
    status: u.status as OrderStatus,
    createdAt: new Date(u.createdAt),
    updatedAt: new Date(u.updatedAt),
    totalCents: u.totalAmountCents,
    subTotalCents: u.totalAmountCents, // Approx if missing
    taxCents: 0, // Missing in snapshot
    shippingCents: 0,
    discountCents: 0,
    paidAmountCents: u.paidAmountCents ?? 0,
    paymentStatus: (u.paymentStatus as any) || 'PENDING',
    currency: u.currency,
    customerId: u.customerId,
    assignedUserId: u.assignedUserId || null,
    shippingAddressId: u.shippingAddressId,
    billingAddressId: u.shippingAddressId, // Fallback
    channel: u.source === 'woo' ? 'WOOCOMMERCE' : 'MANUAL',
    customer: {
      id: u.customer.id,
      name: u.customer.name,
      email: u.customer.email || null,
      phone: u.customer.phone || null,
      // Mock other fields required by Prisma type if strict
      createdAt: new Date(),
      updatedAt: new Date(),
      clvCents: 0, // Snapshot lacks this
    } as any,
    shippingAddress: {
      id: u.shippingAddressId,
      city: u.shippingAddress.city || '',
      street: u.shippingAddress.street || '',
      lat: u.shippingAddress.lat ?? null,
      lng: u.shippingAddress.lng ?? null,
      // Mock
      type: 'SHIPPING',
      customerId: u.customerId,
      number: u.shippingAddress.number || '',
      floor: u.shippingAddress.floor || null,
      apartment: u.shippingAddress.apartment || null,
      createdAt: new Date(),
      updatedAt: new Date(),
      demo: false,
    } as any,
    billingAddress: null as any, // Often nullable or same
    items: u.items.map((i) => ({
      id: i.id || 'redis-item',
      productId: i.productId,
      sku: i.sku,
      name: i.name,
      qty: i.qty,
      priceCents: i.priceCents,
      totalCents: i.totalCents,
      received: i.received ?? false,
      receivedQuantity: i.receivedQuantity ?? 0,
      allocationStatus: i.allocationStatus ?? 'PENDING',
      supplierId: i.supplierId || null,
      supplier: i.supplierId
        ? { id: i.supplierId, name: (i as any).supplierName || 'Supplier' }
        : null,
      // Mock
      orderId: u.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    })) as any[],
    // Installation
    installationTasks: u.installationTaskId
      ? ([
          {
            id: u.installationTaskId,
            status: u.installation?.status || 'PENDING',
            scheduledDate: u.installation?.scheduledAt
              ? new Date(u.installation.scheduledAt)
              : new Date(),
            technician: u.installation?.installerName
              ? { name: u.installation.installerName }
              : null,
          },
        ] as any[])
      : [],
    assignedUser: u.assignedUser
      ? {
          id: u.assignedUser.id,
          name: u.assignedUser.name,
          email: u.assignedUser.email,
          role: u.assignedUser.role,
        }
      : null,
    // Extras
    wooOrderId: u.wooOrderId ? String(u.wooOrderId) : null,
    city: u.shippingAddress.city || null,
    demo: false,
    // Fields that might be missing or defaulted
    priority: 'MEDIUM',
    notes: null,
    notesToCrew: u.notesToCrew ?? null,
    scheduledAt: u.scheduledAt ? new Date(u.scheduledAt) : null,
    // Fix: Map coordinates to top-level fields for normalizeOrder
    lat: u.shippingAddress.lat ?? (u as any).lat ?? (u as any).latitude ?? null,
    lng: u.shippingAddress.lng ?? (u as any).lng ?? (u as any).longitude ?? null,
    latitude: (u as any).latitude ?? u.shippingAddress.lat ?? (u as any).lat ?? null,
    longitude: (u as any).longitude ?? u.shippingAddress.lng ?? (u as any).lng ?? null,
  } as unknown as OrderEntity;
}
