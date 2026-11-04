export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api-middleware';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/db';
import { computeDrillState } from '@/lib/services/orders-ops';
import { buildOrderSnapshot } from '@/lib/orders/rules/orderSnapshot';

/**
 * GET /api/orders/:id/ops-state
 *
 * Compute and return the operational state for an order
 */
export const GET = withAuth(
  async (req: NextRequest, user, { params }: { params: { id: string } }) => {
    try {
      const { id } = await params;

      // Fetch order with items
      const order = await prisma.order.findUnique({
        where: { id },
        include: {
          items: true,
          shippingAddress: true,
          calendarEvents: true,
        },
      });

      if (!order) {
        return createErrorResponse('Order not found', 404);
      }

      // Build snapshot
      const snapshot = buildOrderSnapshot(order as any);

      // Compute drill state
      const drillState = computeDrillState({
        snapshot,
        opsChecklistState: order.opsChecklistState as any,
        opsSnoozeUntil: order.opsSnoozeUntil,
        opsSnoozeReason: order.opsSnoozeReason,
      });

      // Map to OpsState (backward compatibility)
      const opsState = {
        lane: drillState.lane,
        label: drillState.currentTask.taskLabelHe, // Use Hebrew label as the main label
        color: drillState.color,
        requirements: drillState.requirements,
      };

      return createSuccessResponse({
        opsState,
        order: {
          id: order.id,
          number: order.number,
          status: order.status,
        },
      });
    } catch (error) {
      console.error('Failed to compute ops state:', error);
      return createErrorResponse('Failed to compute operational state', 500);
    }
  }
);
