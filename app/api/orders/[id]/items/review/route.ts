export const dynamic = 'force-dynamic';

import {
  createDataResponse,
  createErrorResponse,
  withAuth,
  type AuthenticatedUser,
} from '@/lib/api-middleware';
import { getOrdersService } from '@/lib/services/ServiceFactory';
import { NextRequest } from 'next/server';
import { z } from 'zod';

const reviewSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    received: z.boolean().optional(),
    allocationStatus: z.enum(['PENDING', 'ALLOCATED', 'OUT_OF_STOCK', 'ON_ORDER']).optional(),
  })),
});

export const POST = withAuth(
  async (req: NextRequest, user: AuthenticatedUser, { params }: { params: { id: string } }) => {
    try {
      const body = await req.json();
      const { items } = reviewSchema.parse(body);
      const service = getOrdersService();
      // Using existing updateOrderItems but we might need to extend it for allocationStatus
      const order = await service.updateOrderItems(params.id, items as any, user.id);
      return createDataResponse(order, req);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse('Validation error', 400, error.format());
      }
      throw error;
    }
  }
);
