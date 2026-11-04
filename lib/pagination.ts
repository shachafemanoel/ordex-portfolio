import { z } from 'zod';

// Pagination Schema
export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  direction: z.enum(['forward', 'backward']).default('forward'),
});

// Cursor-based pagination types
export interface CursorPagination {
  cursor?: string;
  limit: number;
  direction: 'forward' | 'backward';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  nextCursor?: string;
  prevCursor?: string;
  hasNext: boolean;
  hasPrev: boolean;
  limit: number;
}

// Generic cursor pagination utility
export async function paginateWithCursor<T extends { id: string; createdAt: Date }>(
  model: any,
  options: {
    where?: any;
    orderBy?: any;
    include?: any;
    select?: any;
  } & CursorPagination
): Promise<PaginatedResult<T>> {
  const { cursor, limit, direction, where, orderBy, include, select } = options;

  // Default ordering by createdAt DESC, then by id for consistency
  const defaultOrderBy = [{ createdAt: 'desc' as const }, { id: 'desc' as const }];

  const actualOrderBy = orderBy || defaultOrderBy;

  // Reverse order for backward pagination
  const queryOrderBy =
    direction === 'backward'
      ? actualOrderBy.map((order: any) => {
          const key = Object.keys(order)[0] as string;
          const dir = (order as Record<string, 'asc' | 'desc'>)[key] === 'desc' ? 'asc' : 'desc';
          return { [key]: dir } as any;
        })
      : actualOrderBy;

  // Build cursor condition
  let cursorCondition = {};
  if (cursor) {
    try {
      const cursorData = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));

      // For createdAt + id ordering
      if (cursorData.createdAt && cursorData.id) {
        cursorCondition =
          direction === 'forward'
            ? {
                OR: [
                  { createdAt: { lt: new Date(cursorData.createdAt) } },
                  {
                    AND: [
                      { createdAt: new Date(cursorData.createdAt) },
                      { id: { lt: cursorData.id } },
                    ],
                  },
                ],
              }
            : {
                OR: [
                  { createdAt: { gt: new Date(cursorData.createdAt) } },
                  {
                    AND: [
                      { createdAt: new Date(cursorData.createdAt) },
                      { id: { gt: cursorData.id } },
                    ],
                  },
                ],
              };
      }
    } catch (error) {
      console.warn('Invalid cursor provided:', cursor);
      cursorCondition = {};
    }
  }

  // Combine where conditions
  const finalWhere = where ? { AND: [where, cursorCondition] } : cursorCondition;

  // Fetch items (limit + 1 to check if there are more)
  const items = await model.findMany({
    where: Object.keys(finalWhere).length > 0 ? finalWhere : undefined,
    orderBy: queryOrderBy,
    take: limit + 1,
    ...(include && { include }),
    ...(select && { select }),
  });

  // Get total count (cached or optimized)
  const total = await getTotalCount(model, where);

  // Determine if there are more items
  const hasMore = items.length > limit;
  if (hasMore) {
    items.pop(); // Remove the extra item
  }

  // Reverse items for backward pagination to maintain correct order
  const finalItems = direction === 'backward' ? items.reverse() : items;

  // Create cursors
  let nextCursor: string | undefined;
  let prevCursor: string | undefined;

  if (finalItems.length > 0) {
    const firstItem = finalItems[0];
    const lastItem = finalItems[finalItems.length - 1];

    // Next cursor (for forward pagination)
    if (hasMore || direction === 'backward') {
      nextCursor = createCursor(lastItem);
    }

    // Previous cursor (for backward pagination)
    if (cursor || direction === 'forward') {
      prevCursor = createCursor(firstItem);
    }
  }

  return {
    items: finalItems,
    total,
    nextCursor,
    prevCursor,
    hasNext: direction === 'forward' ? hasMore : !!cursor,
    hasPrev: direction === 'backward' ? hasMore : !!cursor,
    limit,
  };
}

// Create cursor from item
function createCursor(item: any): string {
  const cursorData = {
    id: item.id,
    createdAt: item.createdAt.toISOString(),
  };
  return Buffer.from(JSON.stringify(cursorData)).toString('base64');
}

// Optimized total count with caching
const countCache = new Map<string, { count: number; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getTotalCount(model: any, where?: any): Promise<number> {
  const cacheKey = JSON.stringify(where || {});
  const cached = countCache.get(cacheKey);

  if (cached && cached.expiry > Date.now()) {
    return cached.count;
  }

  const count = await model.count({ where });
  countCache.set(cacheKey, { count, expiry: Date.now() + CACHE_TTL });

  return count;
}

// Convert cursor pagination to offset-based for backward compatibility
export function convertCursorToOffset(
  paginatedResult: PaginatedResult<any>,
  currentPage: number = 1
): {
  items: any[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
} {
  const totalPages = Math.max(1, Math.ceil(paginatedResult.total / paginatedResult.limit));

  return {
    items: paginatedResult.items,
    meta: {
      total: paginatedResult.total,
      page: currentPage,
      limit: paginatedResult.limit,
      totalPages,
      hasNext: paginatedResult.hasNext,
      hasPrev: paginatedResult.hasPrev,
    },
  };
}

// Validation helper
export function validatePagination(params: any): CursorPagination {
  return paginationSchema.parse(params);
}
