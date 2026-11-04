import { isTenantRuntime } from '@/lib/tenancy/context';
export const dynamic = 'force-dynamic';

import {
  createDataResponse,
  createErrorResponse,
  createPaginatedResponse,
  withErrorHandler,
} from '@/lib/api-middleware';
import { AuthenticationError } from '@/lib/auth/errors';
import { verifySessionFromRequest } from '@/lib/auth/verifySession';
import {
  DELIVERY_FLOW_STATUS_SET,
  reconcileStaleDeliveries,
} from '@/lib/orders/staleDeliveryMonitor';
import { getPrismaClient } from '@/lib/db';
import { logger } from '@/lib/logger';
import { getOrdersService } from '@/lib/services/ServiceFactory';
import { OrderCreateSchema, OrdersQuerySchema } from '@/lib/validators/order';
import { ordersService } from '@/src/server/domain/orders/service';
import { OrderStatus, Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';
import { z } from 'zod';

type OrdersQueryParams = z.infer<typeof OrdersQuerySchema>;

async function getCurrentRequestUser(req: NextRequest) {
  try {
    const { user } = await verifySessionFromRequest(req);
    return user;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return null;
    }
    throw error;
  }
}

/** Ready for field but may have no installation window yet — show on “today” delivery board */
const UNSCHEDULED_READY_STATUSES: OrderStatus[] = [
  'READY',
  'READY_FOR_INSTALL',
  'AWAITING_INSTALL',
  'INSTALL_SCHEDULING',
];

function statusesForUnscheduledReadyBranch(
  requested: OrdersQueryParams['status'] | undefined
): Prisma.OrderWhereInput['status'] {
  const allowed = new Set<OrderStatus>(UNSCHEDULED_READY_STATUSES);
  if (!requested?.length) {
    return { in: UNSCHEDULED_READY_STATUSES };
  }
  const narrowed = requested.filter((s): s is OrderStatus => allowed.has(s as OrderStatus));
  if (!narrowed.length) {
    return { in: [] };
  }
  return { in: narrowed };
}

const SORT_FIELD_MAP: Record<
  OrdersQueryParams['sort'],
  keyof Prisma.OrderOrderByWithRelationInput
> = {
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  scheduledAt: 'scheduledAt',
  number: 'number',
  customerName: 'customerName',
  totalAmount: 'totalCents',
  status: 'status',
};

function buildOrderWhereClause(params: OrdersQueryParams): Prisma.OrderWhereInput {
  const where: Prisma.OrderWhereInput = {};
  const includeDeleted = params.includeDeleted ?? false;
  if (!includeDeleted) {
    where.deletedAt = null;
  }

  if (params.demo !== undefined) {
    where.demo = params.demo;
  } else if (!params.includeDemo) {
    where.demo = false;
  }

  if (params.status?.length) {
    where.status = { in: params.status };
  }

  if (params.clientId) {
    where.customerId = params.clientId;
  }

  if (params.userId) {
    where.assignedUserId = params.userId;
  }

  if (params.city) {
    where.city = params.city;
  }

  if (params.q) {
    where.OR = [
      { number: { contains: params.q, mode: 'insensitive' } },
      { customerName: { contains: params.q, mode: 'insensitive' } },
      { customer: { name: { contains: params.q, mode: 'insensitive' } } },
      { customer: { email: { contains: params.q, mode: 'insensitive' } } },
      { customer: { phone: { contains: params.q } } },
    ];
  }

  if (params.dateFrom || params.dateTo) {
    const createdAtFilter: Prisma.DateTimeFilter = {};
    if (params.dateFrom) {
      const from = new Date(params.dateFrom);
      if (!Number.isNaN(from.getTime())) {
        createdAtFilter.gte = from;
      }
    }
    if (params.dateTo) {
      const to = new Date(params.dateTo);
      if (!Number.isNaN(to.getTime())) {
        createdAtFilter.lte = to;
      }
    }
    if (Object.keys(createdAtFilter).length) {
      where.createdAt = createdAtFilter;
    }
  }

  if (params.scheduledAtFrom && params.scheduledAtTo) {
    const from = new Date(params.scheduledAtFrom);
    const to = new Date(params.scheduledAtTo);
    if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
      const start = new Date(from);
      start.setHours(0, 0, 0, 0);
      const end = new Date(to);
      end.setHours(23, 59, 59, 999);
      where.scheduledAt = {
        gte: start,
        lte: end,
      };
    }
  } else if (params.scheduledAt && params.includeUnscheduledReady) {
    const date = new Date(params.scheduledAt);
    if (!Number.isNaN(date.getTime())) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      const nullBranchStatus = statusesForUnscheduledReadyBranch(params.status);
      const hasNullBranch =
        nullBranchStatus &&
        typeof nullBranchStatus === 'object' &&
        'in' in nullBranchStatus &&
        Array.isArray(nullBranchStatus.in) &&
        nullBranchStatus.in.length > 0;

      if (hasNullBranch) {
        where.AND = [
          ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
          {
            OR: [
              { scheduledAt: { gte: start, lte: end } },
              { AND: [{ scheduledAt: null }, { status: nullBranchStatus }] },
            ],
          },
        ];
      } else {
        where.scheduledAt = {
          gte: start,
          lte: end,
        };
      }
    }
  } else if (params.scheduledAt) {
    const date = new Date(params.scheduledAt);
    if (!Number.isNaN(date.getTime())) {
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

  return where;
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentRequestUser(req);
  if (!user) {
    return createErrorResponse('Unauthorized', 401);
  }

  const { searchParams } = new URL(req.url);
  const query = Object.fromEntries(searchParams.entries());

  const parseResult = OrdersQuerySchema.safeParse(query);
  if (!parseResult.success) {
    return createErrorResponse('Invalid query parameters', 400, parseResult.error.format());
  }

  const params = parseResult.data;
  const shouldReconcileStaleDeliveries =
    Boolean(params.scheduledAt) ||
    Boolean(params.scheduledAtFrom && params.scheduledAtTo) ||
    params.status?.some((status) => DELIVERY_FLOW_STATUS_SET.has(status as any)) === true;

  if (shouldReconcileStaleDeliveries) {
    await reconcileStaleDeliveries();
  }

  const page = Math.max(1, params.page);
  const limit = Math.max(1, params.limit);
  const orderByField = SORT_FIELD_MAP[params.sort] ?? 'createdAt';
  const orderBy = {
    [orderByField]: params.dir,
  } as Prisma.OrderOrderByWithRelationInput;
  const skip = (page - 1) * limit;
  const where = buildOrderWhereClause(params);
  const include = (params.includeItems
    ? {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            _count: {
              select: {
                orders: true,
              },
            },
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
            allocationStatus: true,
            receivedQuantity: true,
            installedQuantity: true,
            supplierId: true,
            remarks: true,
            productId: true,
          },
        },
        shippingAddress: {
          select: {
            street: true,
            number: true,
            city: true,
            lat: true,
            lng: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      }
    : {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            _count: {
              select: {
                orders: true,
              },
            },
          },
        },
        shippingAddress: {
          select: {
            street: true,
            number: true,
            city: true,
            lat: true,
            lng: true,
          },
        },
        _count: {
          select: {
            items: true,
          },
        },
      }) as unknown as Prisma.OrderInclude;

  const [orders, total] = await Promise.all([
    ordersService.getOrders({
      where,
      orderBy,
      skip,
      take: limit,
      include,
    }),
    ordersService.getOrdersCount({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasNext = page < totalPages;

  return createPaginatedResponse(
    orders,
    {
      total,
      page,
      perPage: limit,
      totalPages,
      hasNext,
      hasPrev: page > 1,
    },
    req
  );
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const user = await getCurrentRequestUser(req);
  if (!user) {
    return createErrorResponse('Unauthorized', 401);
  }

  try {
    const body = await req.json();


    const validation = OrderCreateSchema.safeParse(body);

    if (!validation.success) {
      console.warn(
        '[API/Orders] Validation Failed:',
        JSON.stringify(validation.error.format(), null, 2)
      );
      return createErrorResponse('Validation Error', 400, validation.error.format());
    }

    const { clientInstrumentation, ...orderCreatePayload } = validation.data;
    if (clientInstrumentation?.orderWizardDurationMs != null) {
      logger.info('order_create_wizard_duration_ms', {
        ms: clientInstrumentation.orderWizardDurationMs,
        userId: user.id,
      });
    }

    const service = getOrdersService();
    console.log('[API/Orders] Creating order for user:', user.id);
    const order = await service.createOrder(orderCreatePayload as any, user.id);
    console.log('[API/Orders] Order created successfully:', order.id);

    const wizardMs = clientInstrumentation?.orderWizardDurationMs;
    if (wizardMs != null) {
      await getPrismaClient().order.update({
        where: { id: order.id },
        data: { wizardDurationMs: wizardMs },
      });
    }

    // Background geocoding (non-blocking)
    if (order.id && !isTenantRuntime()) {
      import('@/lib/services/geocoding/GeminiGeocodingService')
        .then(({ GeminiGeocodingService }) => {
          const geocodingService = new GeminiGeocodingService();
          return geocodingService.geocodeOrder(order.id);
        })
        .then((success) => {
          if (success) {
            console.log('[API/Orders] Order geocoded successfully:', order.id);
          } else {
            console.warn('[API/Orders] Geocoding failed for order:', order.id);
          }
        })
        .catch((err) => {
          console.error('[API/Orders] Geocoding error:', err);
        });
    }

    return createDataResponse(order, req);
  } catch (err: any) {
    console.error('[API/Orders] FATAL ERROR:', err);
    if (err instanceof Error) {
      console.error(err.stack);
    }
    throw err; // Re-throw for withErrorHandler to handle, but now we have it in logs
  }
});
