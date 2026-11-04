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

const confirmScheduleSchema = z.object({
  scheduledAt: z.string().datetime(),
  installerName: z.string().min(1, 'Installer name is required'),
  installerNotes: z.string().optional(),
});

export const dynamic = 'force-dynamic';

/**
 * Confirm installation schedule (INSTALL_SCHEDULING → AWAITING_INSTALL)
 * POST /api/orders/[id]/transitions/confirm-schedule
 */
export const POST = withAuth(
  async (req: NextRequest, user: AuthenticatedUser, { params }: { params: { id: string } }) => {
    const startedAt = Date.now();
    const correlationId = req.headers.get('x-correlation-id');

    try {
      const orderId = orderIdSchema.parse(params.id);
      const data =
        await validateRequest<z.infer<typeof confirmScheduleSchema>>(confirmScheduleSchema)(req);

      logger.info(`[POST /api/orders/${orderId}/transitions/confirm-schedule] starting`, {
        orderId,
        userId: user.id,
        scheduledAt: data.scheduledAt,
      });

      // Update order with schedule details
      await ordersService.updateOrder(
        orderId,
        {
          scheduledAt: new Date(data.scheduledAt),
          installerName: data.installerName,
          installerNotes: data.installerNotes,
        },
        user.id
      );

      const updatedOrder = await ordersService.changeOrderStatus(
        orderId,
        {
          newStatus: 'AWAITING_INSTALL',
          reason: `Installation scheduled for ${new Date(data.scheduledAt).toLocaleDateString('he-IL')}`,
        },
        user.id
      );

      logger.info(`[POST /api/orders/${orderId}/transitions/confirm-schedule] success`, {
        durationMs: Date.now() - startedAt,
        userId: user.id,
        correlationId,
      });

      return createSuccessResponse(updatedOrder, undefined, 'Installation schedule confirmed');
    } catch (error) {
      logger.error(
        `[POST /api/orders/${params.id}/transitions/confirm-schedule] failed`,
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
