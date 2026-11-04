export const dynamic = 'force-dynamic';

import { createErrorResponse, createSuccessResponse, withAuth } from '@/lib/api-middleware';
import { NextRequest } from 'next/server';
import { ActionError, executeAction, type OpsActionType } from '@/src/server/services/ops-actions.service';
import { z } from 'zod';

const DeliveryTaskActionSchema = z.object({
  actionType: z.enum(['MARK_PICKED', 'MARK_DELIVERED', 'DEFER', 'SET_CUSTOMER_WAIT']),
  payload: z
    .object({
      reason: z.string().optional(),
      until: z.string().datetime().optional(),
      estimatedDeliveryAt: z.string().datetime().optional(),
    })
    .optional()
    .default({}),
});

export const POST = withAuth(
  async (req: NextRequest, user, { params }: { params: { id: string } }) => {
    try {
      const body = await req.json();
      const parsed = DeliveryTaskActionSchema.parse(body);

      const result = await executeAction(
        params.id,
        parsed.actionType as OpsActionType,
        parsed.payload,
        user.id
      );

      return createSuccessResponse(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse('Invalid delivery task payload', 400, error.flatten());
      }
      if (error instanceof ActionError) {
        return createErrorResponse(error.message, error.statusCode);
      }
      return createErrorResponse(
        error instanceof Error ? error.message : 'Failed to execute delivery task',
        500
      );
    }
  }
);

