export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api-middleware';
import { createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const sendToSupplierSchema = z.object({
  estimatedSupplyAt: z.string().transform(str => new Date(str)),
});

/**
 * POST /api/orders/:id/items/:itemId/send-to-supplier
 *
 * Mark an order item as sent to supplier with estimated delivery date
 */
export const POST = withAuth(
  async (req: NextRequest, user, { params }: { params: { id: string; itemId: string } }) => {
    try {
      const { id: orderId, itemId } = params;

      // Validate request body
      const body = await req.json();
      const { estimatedSupplyAt } = sendToSupplierSchema.parse(body);

      // Verify order item exists
      const orderItem = await prisma.orderItem.findUnique({
        where: { id: itemId },
        include: {
          order: {
            select: {
              id: true,
              number: true,
            },
          },
        },
      });

      if (!orderItem) {
        return createErrorResponse('Order item not found', 404);
      }

      if (orderItem.orderId !== orderId) {
        return createErrorResponse('Order item does not belong to this order', 400);
      }

      // Update item with supplier tracking info
      const updatedItem = await prisma.orderItem.update({
        where: { id: itemId },
        data: {
          sentToSupplierAt: new Date(),
          estimatedSupplyAt,
          allocationStatus: 'ON_ORDER',
        },
      });

      // TODO: Recompute order ops state and update cache
      // This would call computeOrderOpsState and update order.opsStatus/opsLane

      return createSuccessResponse({
        item: updatedItem,
        message: 'Item marked as sent to supplier',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse('Invalid request data', 400, {
          errors: error.errors,
        });
      }
      console.error('Failed to mark item as sent to supplier:', error);
      return createErrorResponse('Failed to update item', 500);
    }
  }
);
