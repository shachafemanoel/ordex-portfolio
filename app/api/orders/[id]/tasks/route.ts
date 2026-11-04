export const dynamic = 'force-dynamic';

import { createErrorResponse, createSuccessResponse, withAuth } from '@/lib/api-middleware';
import { NextRequest } from 'next/server';
import { ActionError, executeAction, type OpsActionType } from '@/src/server/services/ops-actions.service';
import { z } from 'zod';

const OrderTaskActionSchema = z.object({
  actionType: z.enum(['START', 'COMPLETE', 'DEFER', 'SPLIT', 'CANCEL', 'SET_CUSTOMER_WAIT']),
  payload: z
    .object({
      reason: z.string().optional(),
      until: z.string().datetime().optional(),
      items: z
        .array(
          z.object({
            productId: z.string(),
            qty: z.number().int().min(1),
          })
        )
        .optional(),
      estimatedDays: z.number().int().min(1).max(60).optional(),
    })
    .optional()
    .default({}),
});

export const POST = withAuth(
  async (req: NextRequest, user, { params }: { params: { id: string } }) => {
    try {
      const body = await req.json();
      const parsed = OrderTaskActionSchema.parse(body);

      const result = await executeAction(
        params.id,
        parsed.actionType as OpsActionType,
        parsed.payload,
        user.id
      );

      return createSuccessResponse(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return createErrorResponse('Invalid order task payload', 400, error.flatten());
      }
      if (error instanceof ActionError) {
        return createErrorResponse(error.message, error.statusCode);
      }
      return createErrorResponse(
        error instanceof Error ? error.message : 'Failed to execute order task',
        500
      );
    }
  }
);

