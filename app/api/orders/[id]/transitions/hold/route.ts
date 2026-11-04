import {
  createSuccessResponse,
  validateRequest,
  withAuth,
  type AuthenticatedUser,
} from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { asInternal, mapErrorToResponse } from '@/lib/server/errors';
import { getProductionOrdersService } from '@/lib/services/production';
import { NextRequest } from 'next/server';
import { z } from 'zod';

const ordersService = getProductionOrdersService();
const orderIdSchema = z.string().trim().min(1, 'Order ID is required');

const holdSchema = z.object({
  reason: z.string().min(1, 'Hold reason is required'),
});

export const dynamic = 'force-dynamic';

/**
 * Put order on hold (Any status → ON_HOLD)
 * POST /api/orders/[id]/transitions/hold
 */
export const POST = withAuth(
  async (req: NextRequest, user: AuthenticatedUser, { params }: { params: { id: string } }) => {
    const startedAt = Date.now();
    const correlationId = req.headers.get('x-correlation-id');

    try {
      const orderId = orderIdSchema.parse(params.id);
      const data = (await validateRequest(holdSchema)(req)) as z.infer<typeof holdSchema>;

      logger.info(`[POST /api/orders/${orderId}/transitions/hold] starting`, {
        orderId,
        userId: user.id,
        reason: data.reason,
      });

      const updatedOrder = await ordersService.changeOrderStatus(
        orderId,
        {
          newStatus: 'ON_HOLD',
          reason: data.reason,
        },
        user.id
      );

      logger.info(`[POST /api/orders/${orderId}/transitions/hold] success`, {
        durationMs: Date.now() - startedAt,
        userId: user.id,
        correlationId,
      });

      return createSuccessResponse(updatedOrder, undefined, 'Order put on hold');
    } catch (error) {
      logger.error(
        `[POST /api/orders/${params.id}/transitions/hold] failed`,
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
