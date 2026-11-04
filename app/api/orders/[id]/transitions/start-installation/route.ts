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
 * Start installation (AWAITING_INSTALL → INSTALLING)
 * POST /api/orders/[id]/transitions/start-installation
 */
export const POST = withAuth(
  async (req: NextRequest, user: AuthenticatedUser, { params }: { params: { id: string } }) => {
    const startedAt = Date.now();
    const correlationId = req.headers.get('x-correlation-id');

    try {
      const orderId = orderIdSchema.parse(params.id);

      logger.info(`[POST /api/orders/${orderId}/transitions/start-installation] starting`, {
        orderId,
        userId: user.id,
      });

      const updatedOrder = await ordersService.changeOrderStatus(
        orderId,
        {
          newStatus: 'SCHEDULED',
          reason: 'Installation started',
        },
        user.id
      );

      logger.info(`[POST /api/orders/${orderId}/transitions/start-installation] success`, {
        durationMs: Date.now() - startedAt,
        userId: user.id,
        correlationId,
      });

      return createSuccessResponse(updatedOrder, undefined, 'Installation started');
    } catch (error) {
      logger.error(
        `[POST /api/orders/${params.id}/transitions/start-installation] failed`,
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
