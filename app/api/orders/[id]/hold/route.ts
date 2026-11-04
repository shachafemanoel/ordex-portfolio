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

const holdSchema = z.object({
  reason: z.string().trim().min(1, 'יש לציין סיבה'),
});

export const POST = withAuth(
  async (req: NextRequest, user: AuthenticatedUser, { params }: { params: { id: string } }) => {
    try {
      const body = await req.json();
      const { reason } = holdSchema.parse(body);
      const service = getOrdersService();
      const order = await service.holdOrder(params.id, reason, user.id);
      return createDataResponse(order, req);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse('Validation error', 400, error.format());
      }
      throw error;
    }
  }
);
