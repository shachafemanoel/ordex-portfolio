import {
  ApiError,
  createDataResponse,
  createErrorResponse,
  validateRequest,
  withAuth,
  type AuthenticatedUser,
} from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { asInternal, mapErrorToResponse } from '@/lib/server/errors';
import { getProductionOrdersService } from '@/lib/services/production';
import { OrderUpdateSchema } from '@/lib/validation';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// Use centralized service factory for production
const productionOrdersService = getProductionOrdersService();
const orderIdSchema = z.string().trim().min(1, 'Order ID is required');

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (req: NextRequest, user: AuthenticatedUser, { params }: { params: { id: string } }) => {
    const orderId = params.id;
    const startedAt = Date.now();
    logger.debug(`[GET /api/orders/${orderId}] request`, {
      orderId,
      userId: user?.id,
      correlationId: req.headers.get('x-correlation-id'),
    });

    try {
      const order = await productionOrdersService.getOrderById(orderId);
      if (!order) {
        return createErrorResponse('Order not found', 404, { code: 'NOT_FOUND' });
      }

      logger.debug(`[GET /api/orders/${orderId}] success`, {
        durationMs: Date.now() - startedAt,
        source: 'found',
        hasOrder: Boolean(order?.id),
        itemCount: order?.items?.length ?? 0,
      });
      return createDataResponse(order, req);
    } catch (error) {
      logger.error(
        `[GET /api/orders/${orderId}] failed`,
        error instanceof Error ? error : new Error(String(error)),
        {
          durationMs: Date.now() - startedAt,
          orderId,
          userId: user?.id,
        }
      );
      const mapped = mapErrorToResponse(error);
      if (mapped) return mapped;

      if (error instanceof ApiError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: error.code,
              message: error.message,
              details: error.details,
            },
          },
          { status: error.statusCode }
        );
      }

      return asInternal();
    }
  }
);

export const PATCH = withAuth(
  async (req: NextRequest, user: AuthenticatedUser, { params }: { params: { id: string } }) => {
    const startedAt = Date.now();
    const correlationId = req.headers.get('x-correlation-id');

    try {
      const orderId = orderIdSchema.parse(params.id);
      const data = (await validateRequest(OrderUpdateSchema)(req)) as z.infer<
        typeof OrderUpdateSchema
      >;
      const order = await productionOrdersService.updateOrder(
        orderId,
        {
          ...data,
          assignedUserId: data.assignedUserId ?? undefined,
        },
        user.id
      );

      logger.info(`[PATCH /api/orders/${orderId}] success`, {
        durationMs: Date.now() - startedAt,
        userId: user.id,
        correlationId,
      });

      return createDataResponse(order, req);
    } catch (error) {
      logger.error(
        `[PATCH /api/orders/${params.id}] failed`,
        error instanceof Error ? error : new Error(String(error)),
        {
          durationMs: Date.now() - startedAt,
          userId: user.id,
          correlationId,
        }
      );

      const mapped = mapErrorToResponse(error);
      if (mapped) return mapped;

      if (error instanceof ApiError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: error.code,
              message: error.message,
              details: error.details,
            },
          },
          { status: error.statusCode }
        );
      }

      return asInternal();
    }
  }
);

export const DELETE = withAuth(
  async (req: NextRequest, user: AuthenticatedUser, { params }: { params: { id: string } }) => {
    try {
      await productionOrdersService.delete(params.id, user.id);
      return createDataResponse({ id: params.id }, req);
    } catch (error) {
      const mapped = mapErrorToResponse(error);
      if (mapped) return mapped;
      if (error instanceof ApiError) {
        return NextResponse.json(
          {
            ok: false,
            error: error.code ? String(error.code).toLowerCase() : 'internal_error',
            detail: error.details ?? error.message,
            success: false,
          },
          { status: error.statusCode }
        );
      }
      console.error(`DELETE /api/orders/${params.id} error`, error);
      return asInternal();
    }
  }
);
