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

const completeSchema = z.object({
  notes: z.string().optional(),
  completedAt: z.string().datetime().optional(),
});

export const dynamic = 'force-dynamic';

/**
 * Complete installation (INSTALLING → SUPPLIED/COMPLETED)
 * POST /api/orders/[id]/transitions/complete
 */
export const POST = withAuth(
  async (req: NextRequest, user: AuthenticatedUser, { params }: { params: { id: string } }) => {
    const startedAt = Date.now();
    const correlationId = req.headers.get('x-correlation-id');

    try {
      const orderId = orderIdSchema.parse(params.id);
      const data = (await validateRequest(completeSchema)(req)) as z.infer<typeof completeSchema>;

      logger.info(`[POST /api/orders/${orderId}/transitions/complete] starting`, {
        orderId,
        userId: user.id,
      });

      // Update completion details if provided
      if (data.completedAt) {
        await ordersService.updateOrder(
          orderId,
          {
            completedAt: new Date(data.completedAt),
          },
          user.id
        );
      }

      const updatedOrder = await ordersService.changeOrderStatus(
        orderId,
        {
          newStatus: 'SUPPLIED',
          reason: data.notes || 'Installation completed successfully',
        },
        user.id
      );

      logger.info(`[POST /api/orders/${orderId}/transitions/complete] success`, {
        durationMs: Date.now() - startedAt,
        userId: user.id,
        correlationId,
      });

      return createSuccessResponse(updatedOrder, undefined, 'Order completed');
    } catch (error) {
      logger.error(
        `[POST /api/orders/${params.id}/transitions/complete] failed`,
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
