export const dynamic = 'force-dynamic';

import {
  ApiError,
  createSuccessResponse,
  validateRequest,
  withAuth,
  type AuthenticatedUser,
} from '@/lib/api-middleware';
import { asInternal, mapErrorToResponse } from '@/lib/server/errors';
import { getProductionOrdersService } from '@/lib/services/production';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const ordersService = getProductionOrdersService();

const updateItemsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      received: z.boolean(),
    })
  ),
});

export const PATCH = withAuth(
  async (req: NextRequest, user: AuthenticatedUser, { params }: { params: { id: string } }) => {
    try {
      const orderId = params.id;
      const data = (await validateRequest(updateItemsSchema)(req)) as z.infer<
        typeof updateItemsSchema
      >;

      const updatedOrder = await ordersService.updateOrderItems(
        orderId,
        data.items,
        user.id
      );

      return createSuccessResponse(updatedOrder, undefined, 'Order items updated');
    } catch (error) {
      console.error(`[PATCH /api/orders/${params.id}/items-availability] failed`, error);
      const mapped = mapErrorToResponse(error);
      if (mapped) return mapped;

      if (error instanceof ApiError) {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: error.code,
              message: error.message,
            },
          },
          { status: error.statusCode }
        );
      }
      return asInternal();
    }
  }
);
