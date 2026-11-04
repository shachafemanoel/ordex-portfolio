export const dynamic = 'force-dynamic';

import {
  createSuccessResponse,
  validateRequest,
  withAuth,
  type AuthenticatedUser,
} from '@/lib/api-middleware';
import { logger } from '@/lib/logger';
import { mapErrorToResponse } from '@/lib/server/errors';
import { addManualPayment } from '@/lib/services/orders';
import { OrderPaymentSchema } from '@/lib/validators/order';
import { NextRequest } from 'next/server';
import { z } from 'zod';

const manualPaymentSchema = OrderPaymentSchema.extend({
  notes: z.string().optional(),
});

export const POST = withAuth(
  async (req: NextRequest, user: AuthenticatedUser, { params }: { params: { id: string } }) => {
    try {
      const orderId = params.id;
      const body = (await validateRequest(manualPaymentSchema)(req)) as z.infer<
        typeof manualPaymentSchema
      >;

      const payment = await addManualPayment(orderId, body as any, user.id, body.notes);

      return createSuccessResponse(payment, undefined, 'Payment added successfully');
    } catch (error) {
      logger.error('Failed to add manual payment', error);
      const mapped = mapErrorToResponse(error);
      if (mapped) return mapped;
      throw error;
    }
  }
);
