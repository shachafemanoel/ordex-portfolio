export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth, createSuccessResponse, createErrorResponse } from '@/lib/api-middleware';
import {
  cancelOrder,
  canCancelOrder,
  getCancellationImpact,
} from '@/lib/services/orders/OrderCancellationService';
import { z } from 'zod';

const CancelOrderSchema = z.object({
  reason: z.string().min(1, 'חובה לציין סיבת ביטול'),
  cancelRelatedRecords: z.boolean().optional().default(true),
  force: z.boolean().optional().default(false),
});

/**
 * POST /api/orders/:id/cancel
 * Cancel an order and cleanup related records
 */
export const POST = withAuth(
  async (req: NextRequest, user, { params }: { params: { id: string } }) => {
    try {
      const body = await req.json();
      const validation = CancelOrderSchema.safeParse(body);

      if (!validation.success) {
        return createErrorResponse('נתונים לא תקינים', 400, {
          errors: validation.error.flatten().fieldErrors,
        });
      }

      const { reason, cancelRelatedRecords, force } = validation.data;

      // Check if order can be cancelled
      const eligibility = await canCancelOrder(params.id);
      if (!eligibility.canCancel) {
        return createErrorResponse(eligibility.reason || 'לא ניתן לבטל הזמנה זו', 400, {
          warnings: eligibility.warnings,
        });
      }

      // Cancel the order
      const result = await cancelOrder({
        orderId: params.id,
        reason,
        cancelledBy: user.id,
        cancelRelatedRecords,
        force,
      });

      if (!result.success) {
        return createErrorResponse('שגיאה בביטול ההזמנה', 500, {
          errors: result.errors,
          warnings: result.warnings,
        });
      }

      return createSuccessResponse(result, undefined, 'ההזמנה בוטלה בהצלחה');
    } catch (error) {
      console.error('Error in cancel order API:', error);
      return createErrorResponse('שגיאה בביטול ההזמנה', 500);
    }
  }
);

/**
 * GET /api/orders/:id/cancel
 * Get cancellation eligibility and impact
 */
export const GET = withAuth(
  async (_req: NextRequest, _user, { params }: { params: { id: string } }) => {
    try {
      const [eligibility, impact] = await Promise.all([
        canCancelOrder(params.id),
        getCancellationImpact(params.id),
      ]);

      return createSuccessResponse({
        canCancel: eligibility.canCancel,
        reason: eligibility.reason,
        warnings: eligibility.warnings,
        impact,
      });
    } catch (error) {
      console.error('Error checking cancellation eligibility:', error);
      return createErrorResponse('שגיאה בבדיקת זכאות לביטול', 500);
    }
  }
);
