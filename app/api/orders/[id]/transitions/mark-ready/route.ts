import { createSuccessResponse, withAuth, type AuthenticatedUser } from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { asInternal, mapErrorToResponse } from '@/lib/server/errors';
import { getProductionOrdersService } from '@/lib/services/production';
import { NextRequest } from 'next/server';
import { z } from 'zod';

const ordersService = getProductionOrdersService();
const orderIdSchema = z.string().trim().min(1, 'Order ID is required');

export const dynamic = 'force-dynamic';

/**
 * Mark order as ready (DRAFT → TO_DO/READY)
 * POST /api/orders/[id]/transitions/mark-ready
 */
export const POST = withAuth(
  async (req: NextRequest, user: AuthenticatedUser, { params }: { params: { id: string } }) => {
    const startedAt = Date.now();
    const correlationId = req.headers.get('x-correlation-id');

    try {
      const orderId = orderIdSchema.parse(params.id);

      logger.info(`[POST /api/orders/${orderId}/transitions/mark-ready] starting`, {
        orderId,
        userId: user.id,
      });

      const updatedOrder = await ordersService.changeOrderStatus(
        orderId,
        {
          newStatus: 'TO_DO',
          reason: 'Order marked as ready for processing',
        },
        user.id
      );

      logger.info(`[POST /api/orders/${orderId}/transitions/mark-ready] success`, {
        durationMs: Date.now() - startedAt,
        userId: user.id,
        correlationId,
      });

      return createSuccessResponse(updatedOrder, undefined, 'Order marked as ready');
    } catch (error) {
      logger.error(
        `[POST /api/orders/${params.id}/transitions/mark-ready] failed`,
        error instanceof Error ? error : new Error(String(error)),
        {
          durationMs: Date.now() - startedAt,
          userId: user.id,
          correlationId,
        }
      );
      const mapped = mapErrorToResponse(error);
      if (mapped) return mapped;

      return asInternal();
    }
  },
  { permissions: ['EDIT_ORDERS'] }
);
