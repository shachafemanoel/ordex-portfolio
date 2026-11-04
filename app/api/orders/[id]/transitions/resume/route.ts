import {
  createErrorResponse,
  createSuccessResponse,
  withAuth,
  type AuthenticatedUser,
} from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { asBadRequest, asInternal, mapErrorToResponse } from '@/lib/server/errors';
import { getProductionOrdersService } from '@/lib/services/production';
import { NextRequest } from 'next/server';
import { z } from 'zod';

const ordersService = getProductionOrdersService();
const orderIdSchema = z.string().trim().min(1, 'Order ID is required');

export const dynamic = 'force-dynamic';

/**
 * Resume order from hold (ON_HOLD → Previous Status)
 * POST /api/orders/[id]/transitions/resume
 *
 * Note: This endpoint attempts to restore the order to its previous status
 * before it was put on hold. If no previous status is available, it defaults to TO_DO.
 */
export const POST = withAuth(
  async (req: NextRequest, user: AuthenticatedUser, { params }: { params: { id: string } }) => {
    const startedAt = Date.now();
    const correlationId = req.headers.get('x-correlation-id');

    try {
      const orderId = orderIdSchema.parse(params.id);

      logger.info(`[POST /api/orders/${orderId}/transitions/resume] starting`, {
        orderId,
        userId: user.id,
      });

      // Get order to check current status
      const order = await ordersService.getOrderById(orderId);

      if (!order) {
        return createErrorResponse('Order not found', 404);
      }

      if (order.status !== 'ON_HOLD') {
        return asBadRequest('Order is not on hold');
      }

      // Get status history to find previous status
      const history = await ordersService.getOrderStatusHistory(orderId);

      // Find the status before ON_HOLD
      let previousStatus = 'TO_DO'; // Default fallback
      for (let i = 0; i < history.length; i++) {
        if (history[i].toStatus === 'ON_HOLD' && i + 1 < history.length) {
          previousStatus = history[i + 1].fromStatus || 'TO_DO';
          break;
        }
      }

      const updatedOrder = await ordersService.changeOrderStatus(
        orderId,
        {
          newStatus: previousStatus as any,
          reason: `Resumed from hold, returning to ${previousStatus}`,
        },
        user.id
      );

      logger.info(`[POST /api/orders/${orderId}/transitions/resume] success`, {
        durationMs: Date.now() - startedAt,
        userId: user.id,
        correlationId,
        previousStatus,
      });

      return createSuccessResponse(updatedOrder, undefined, 'Order resumed from hold');
    } catch (error) {
      logger.error(
        `[POST /api/orders/${params.id}/transitions/resume] failed`,
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
