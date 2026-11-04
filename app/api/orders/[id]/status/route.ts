import {
  createSuccessResponse,
  validateRequest,
  ValidationError,
  withAuth,
  type AuthenticatedUser,
} from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { asInternal, mapErrorToResponse } from '@/lib/server/errors';
import { getProductionOrdersService } from '@/lib/services/production';
import { statusUpdateSchema } from '@/lib/validators/order';
import { OrderStatus } from '@prisma/client';
import { NextRequest } from 'next/server';
import { z } from 'zod';

const ordersService = getProductionOrdersService();
const orderIdSchema = z.string().trim().min(1, 'Order ID is required');

export const dynamic = 'force-dynamic';

export const POST = withAuth(
  async (req: NextRequest, user: AuthenticatedUser, { params }: { params: { id: string } }) => {
    const startedAt = Date.now();
    const correlationId = req.headers.get('x-correlation-id');

    try {
      const orderId = orderIdSchema.parse(params.id);
      const data = (await validateRequest(statusUpdateSchema)(req)) as z.infer<
        typeof statusUpdateSchema
      >;

      logger.info(`[POST /api/orders/${orderId}/status] starting`, {
        orderId,
        userId: user.id,
        requestData: {
          status: data.status,
          reason: data.reason,
          installerName: data.installerName,
          installerNotes: data.installerNotes,
          installAt: data.installAt,
        },
      });

      // Update installer details first if provided
      if (data.installerName || data.installerNotes || data.installAt) {
        // If we have extra data, we should update the order metadata/fields as well.
        try {
          const updated = await ordersService.updateOrder(
            orderId,
            {
              installerName: data.installerName,
              installerNotes: data.installerNotes,
              scheduledAt: data.installAt ? new Date(data.installAt) : undefined,
            },
            user.id
          );

          // Optimization: If the updateOrder (via auto-transition) already reached the target status,
          // we can skip the specific status change call to avoid redundancy or errors.
          if (updated.status === data.status) {
            logger.info(
              `[POST /api/orders/${orderId}/status] status already updated to ${data.status} via updateOrder side-effects`
            );
            return createSuccessResponse(updated, undefined, 'Order status updated successfully');
          }
        } catch (updateError) {
          logger.warn(
            `[POST /api/orders/${orderId}/status] failed to update order details before status change`,
            { error: updateError }
          );
          // We continue to status change even if update failed? Or should we fail?
          // Let's log and continue, validation errors would have been caught earlier.
        }
      }

      // Cancelling and holding must say why; the reason is kept in the status history.
      if ((data.status === 'CANCELLED' || data.status === 'ON_HOLD') && !data.reason?.trim()) {
        throw new ValidationError('יש לציין סיבה', { targetStatus: data.status }, 'reason');
      }

      // Handle cancellation via specialized service if status is CANCELLED
      if (data.status === 'CANCELLED') {
        const { cancelOrder } = await import('@/lib/services/orders/OrderCancellationService');
        const cancelResult = await cancelOrder({
          orderId,
          reason: (data.reason ?? '').trim(),
          cancelledBy: user.id,
          cancelRelatedRecords: true,
        });

        if (!cancelResult.success) {
          throw new Error(cancelResult.errors?.[0] || 'Failed to cancel order');
        }

        const updatedOrder = await ordersService.getOrderById(orderId);
        return createSuccessResponse(updatedOrder, undefined, 'Order cancelled successfully');
      }

      const updatedOrder = await ordersService.changeOrderStatus(
        orderId,
        {
          newStatus: data.status as OrderStatus,
          reason: data.reason,
        },
        user.id
      );

      logger.info(`[POST /api/orders/${orderId}/status] success`, {
        durationMs: Date.now() - startedAt,
        userId: user.id,
        correlationId,
      });

      return createSuccessResponse(updatedOrder, undefined, 'Order status updated successfully');
    } catch (error) {
      const errorDetails = {
        durationMs: Date.now() - startedAt,
        userId: user.id,
        correlationId,
        orderId: params.id,
        errorType: error?.constructor?.name || typeof error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        errorData: error && typeof error === 'object' ? { ...error } : undefined,
      };

      logger.error(
        `[POST /api/orders/${params.id}/status] failed with ${errorDetails.errorType}`,
        error instanceof Error ? error : new Error(String(error)),
        errorDetails
      );

      const mapped = mapErrorToResponse(error);
      if (mapped) return mapped;

      return asInternal();
    }
  },
  { permissions: ['EDIT_ORDERS'] }
);

// Keep GET for history compatibility
export const GET = withAuth(
  async (_req: NextRequest, _user: AuthenticatedUser, { params }: { params: { id: string } }) => {
    const statusHistory = await ordersService.getOrderStatusHistory(params.id);
    return createSuccessResponse(statusHistory);
  },
  { permissions: ['VIEW_ORDERS'] }
);
