export const dynamic = 'force-dynamic';

import {
  ApiError,
  createSuccessResponse,
  validateRequest,
  withAuth,
  type AuthenticatedUser,
} from '@/lib/api-middleware';
import { getStatusLabel, ORDER_STATUS_TRANSITIONS } from '@/lib/orderStatus';
import { asInternal, mapErrorToResponse } from '@/lib/server/errors';
import { getProductionOrdersService } from '@/lib/services/production';
import { validateStatusTransitionConditions } from '@/lib/workflow-requirements';
import { OrderStatus } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const ordersService = getProductionOrdersService();

const advanceStatusSchema = z.object({
  targetStatus: z.string().optional(), // If not provided, will try to find next logical status
  reason: z.string().optional(),
});

export const POST = withAuth(
  async (req: NextRequest, user: AuthenticatedUser, { params }: { params: { id: string } }) => {
    try {
      const orderId = params.id;
      const data = (await validateRequest(advanceStatusSchema)(req)) as z.infer<
        typeof advanceStatusSchema
      >;

      // 1. Get current order to check requirements
      const order = await ordersService.getOrderById(orderId);
      if (!order) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Order not found' } },
          { status: 404 }
        );
      }

      let targetStatus = data.targetStatus as OrderStatus | undefined;

      // 2. If no target status, try to infer the next one
      if (!targetStatus) {
        const transitions = ORDER_STATUS_TRANSITIONS[order.status] || [];
        // Find first non-cancelled status
        targetStatus = transitions.find((s) => s !== 'CANCELLED');

        if (!targetStatus) {
           return NextResponse.json(
            {
              success: false,
              error: {
                code: 'NO_TRANSITION',
                message: `No logical next status found from ${getStatusLabel(order.status)}`
              }
            },
            { status: 400 }
          );
        }
      }

      // 3. Validate Requirements
      const validation = validateStatusTransitionConditions(order, targetStatus);
      if (!validation.isValid) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'REQUIREMENTS_NOT_MET',
              message: 'Cannot advance status: Requirements not met',
              details: {
                errors: validation.errors,
                warnings: validation.warnings,
              },
            },
          },
          { status: 400 }
        );
      }

      // 4. Perform Transition
      const updatedOrder = await ordersService.changeOrderStatus(
        orderId,
        {
          newStatus: targetStatus,
          reason: data.reason || 'Manual advance via workflow',
        },
        user.id
      );

      return createSuccessResponse(updatedOrder, undefined, `Advanced to ${getStatusLabel(targetStatus)}`);
    } catch (error) {
      console.error(`[POST /api/orders/${params.id}/advance-status] failed`, error);
      const mapped = mapErrorToResponse(error);
      if (mapped) return mapped;

      if (error instanceof ApiError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: error.code,
              message: error.message,
              details: error.details,
            },
          },
          { status: error.statusCode }
        );
      }
      return asInternal();
    }
  }
);
