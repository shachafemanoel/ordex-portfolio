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

const scheduleSchema = z.object({
  installerName: z.string().optional(),
  installerNotes: z.string().optional(),
});

export const dynamic = 'force-dynamic';

/**
 * Move order to scheduling phase (TO_DO/READY → INSTALL_SCHEDULING)
 * POST /api/orders/[id]/transitions/schedule
 */
export const POST = withAuth(
  async (req: NextRequest, user: AuthenticatedUser, { params }: { params: { id: string } }) => {
    const startedAt = Date.now();
    const correlationId = req.headers.get('x-correlation-id');

    try {
      const orderId = orderIdSchema.parse(params.id);
      const data = await validateRequest<z.infer<typeof scheduleSchema>>(scheduleSchema)(req);

      logger.info(`[POST /api/orders/${orderId}/transitions/schedule] starting`, {
        orderId,
        userId: user.id,
      });

      // Update installer details if provided
      if (data.installerName || data.installerNotes) {
        await ordersService.updateOrder(
          orderId,
          {
            installerName: data.installerName,
            installerNotes: data.installerNotes,
          },
          user.id
        );
      }

      const updatedOrder = await ordersService.changeOrderStatus(
        orderId,
        {
          newStatus: 'INSTALL_SCHEDULING',
          reason: 'Order moved to installation scheduling',
        },
        user.id
      );

      logger.info(`[POST /api/orders/${orderId}/transitions/schedule] success`, {
        durationMs: Date.now() - startedAt,
        userId: user.id,
        correlationId,
      });

      return createSuccessResponse(updatedOrder, undefined, 'Order moved to scheduling');
    } catch (error) {
      logger.error(
        `[POST /api/orders/${params.id}/transitions/schedule] failed`,
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
