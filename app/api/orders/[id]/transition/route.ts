import {
  createSuccessResponse,
  validateRequest,
  withAuth,
  type AuthenticatedUser,
} from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { normalizeOrderStatus } from '@/lib/orderStatus';
import { asInternal, mapErrorToResponse } from '@/lib/server/errors';
import { getProductionOrdersService } from '@/lib/services/production';
import { NextRequest } from 'next/server';
import { z } from 'zod';

const ordersService = getProductionOrdersService();

const transitionSchema = z.object({
  toStatus: z.string().min(1, 'יעד סטטוס נדרש'),
  note: z.string().max(500).optional(),
  action: z.record(z.any()).optional(),
});

export const dynamic = 'force-dynamic';

export const POST = withAuth(
  async (req: NextRequest, user: AuthenticatedUser, { params }: { params: { id: string } }) => {
    const startedAt = Date.now();
    const correlationId = req.headers.get('x-correlation-id');

    try {
      const data = (await validateRequest(transitionSchema)(req)) as z.infer<
        typeof transitionSchema
      >;
      const orderId = params.id;
      const targetStatus = normalizeOrderStatus(data.toStatus);

      logger.info(`[POST /api/orders/${orderId}/transition] start`, {
        orderId,
        userId: user.id,
        targetStatus,
        correlationId,
      });

      const updated = await ordersService.changeOrderStatus(
        orderId,
        {
          newStatus: targetStatus,
          reason: data.note,
          metadata: data.action ? { action: data.action } : undefined,
        },
        user.id
      );

      return createSuccessResponse(updated, undefined, 'הסטטוס עודכן בהצלחה');
    } catch (error) {
      logger.error(
        `[POST /api/orders/${params.id}/transition] failed`,
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
