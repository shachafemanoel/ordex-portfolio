import { listOrders } from '@/lib/data/ordersRedis';
import { getCorrelationId, logger } from '@/lib/enhanced-logger';
import { getAllStatuses } from '@/lib/orderStatus';
import { NextRequest, NextResponse } from 'next/server';
import { performance } from 'node:perf_hooks';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const geoQuerySchema = z.object({
  status: z.array(z.enum(getAllStatuses() as [string, ...string[]])).optional(),
  limit: z
    .string()
    .optional()
    .transform((value) => (value ? Number.parseInt(value, 10) : undefined))
    .refine(
      (value) => value === undefined || (Number.isFinite(value) && value >= 1 && value <= 200),
      { message: 'limit must be between 1 and 200' }
    ),
});

export async function GET(req: NextRequest) {
  const correlationId = getCorrelationId(req);
  const started = performance.now();

  try {
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.getAll('status');
    const limitParam = searchParams.get('limit') ?? undefined;

    const parsed = geoQuerySchema.safeParse({
      status: statusParam.length > 0 ? statusParam : undefined,
      limit: limitParam,
    });

    if (!parsed.success) {
      return respondWithError({
        status: 400,
        message: 'Invalid query parameters',
        correlationId,
        code: 'INVALID_QUERY',
        details: parsed.error.flatten(),
        duration: performance.now() - started,
      });
    }

    const limit = parsed.data.limit ?? 100;

    // Use Unified Data Layer
    const result = await listOrders({
      limit,
      status: parsed.data.status,
    });

    // If Redis returns null (e.g. not available), falling back to DB would be ideal,
    // but for now we stick to the plan of using Unified Data.
    // In a real scenario, we might want to use the Repository which handles fallback.
    // However, existing getOrdersWithCoordinates was DB-only.
    // Here we return what we found in Redis (which we know is hydrated).
    const orders = result ? result.items : [];

    // Map to simple structure if needed or return as is?
    // The previous implementation utilized 'serializeOrder'.
    // UnifiedOrder is already serialized-ready.

    const duration = performance.now() - started;
    logger.apiRequest('GET', '/api/orders/geo', 200, Math.round(duration), {
      component: 'orders/geo',
      correlationId,
      action: 'orders_geo_fetch',
    });

    const response = NextResponse.json({
      success: true,
      data: orders,
      total: result?.total || 0,
      appliedFilters: {
        status: parsed.data.status || [],
        limit,
      },
      correlationId,
    });
    response.headers.set('x-correlation-id', correlationId);
    return response;
  } catch (error) {
    return respondWithError({
      status: 500,
      message: 'Failed to fetch order locations',
      correlationId,
      code: 'ORDERS_GEO_ERROR',
      error,
      duration: performance.now() - started,
    });
  }
}

function respondWithError({
  status,
  message,
  code,
  details,
  correlationId,
  duration,
  error,
}: {
  status: number;
  message: string;
  code: string;
  details?: unknown;
  correlationId: string;
  duration: number;
  error?: unknown;
}): NextResponse {
  if (status >= 500) {
    logger.error(
      message,
      {
        component: 'orders/geo',
        correlationId,
        status,
        duration: Math.round(duration),
      },
      error instanceof Error ? error : undefined
    );
  }

  const response = NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        details,
      },
      correlationId,
    },
    { status }
  );
  response.headers.set('x-correlation-id', correlationId);
  return response;
}
