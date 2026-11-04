export const dynamic = 'force-dynamic';

import {
  createSuccessResponse,
  withAuth,
  type AuthenticatedUser,
} from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { asInternal, mapErrorToResponse } from '@/lib/server/errors';
import { getProductionOrdersService } from '@/lib/services/production';
import { OrderStatus } from '@prisma/client';
import { NextRequest } from 'next/server';

const ordersService = getProductionOrdersService();

export const POST = withAuth(
  async (req: NextRequest, user: AuthenticatedUser, { params }: { params: { id: string } }) => {
    try {
      const orderId = params.id;
      // Fetch history. Assuming this returns recent-first or we sort it.
      const history = await ordersService.getOrderStatusHistory(orderId);
      
      // Filter out duplicate consecutive statuses if any, just in case
      // But simply taking the 2nd most recent is usually enough for "Undo last action"
      
      if (!history || history.length < 2) {
          // If only 1 entry (creation), we can't revert
          return asInternal(new Error("No previous status found"));
      }

      // History usually sorted by createdAt desc by default in services
      // Let's verify type of history items.
      const previousEntry = history[1];
      
      // Cast to OrderStatus to ensure type safety with Prisma enum
      const previousStatus = previousEntry.toStatus as OrderStatus;

      const updatedOrder = await ordersService.changeOrderStatus(
        orderId,
        {
          newStatus: previousStatus,
          reason: 'Undo action (Revert)',
        },
        user.id
      );

      logger.info(`[POST /api/orders/${orderId}/status/revert] reverted to ${previousStatus}`, {
        userId: user.id,
      });

      return createSuccessResponse(updatedOrder, undefined, 'Order status reverted successfully');
    } catch (error) {
      logger.error('Failed to revert status', error);
      const mapped = mapErrorToResponse(error);
      if (mapped) return mapped;
      return asInternal();
    }
  },
  { permissions: ['EDIT_ORDERS'] }
);
