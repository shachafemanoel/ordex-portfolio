import { normalizePayment } from '@/domain/payments/normalizePayment';
import {
  ApiError,
  createSuccessResponse,
  validateRequest,
  withAuth,
  type AuthenticatedUser,
} from '@/lib/api-middleware';
import {
  UNIFIED_ORDER_INCLUDE,
  mapOrderToUnified,
  upsertUnifiedOrder,
} from '@/lib/data/ordersRedis';
import { prisma } from '@/lib/db';
import { asInternal, mapErrorToResponse } from '@/lib/server/errors';
import {
  updateOrderPaymentSummary,
  upsertOrderPayment,
  type PaymentSummaryUpdatePayload,
} from '@/lib/services/orders';
import { syncOrderOperationalState } from '@/lib/services/orders/statusRecalculation';
import { OrderPaymentSchema, type OrderPaymentInput } from '@/lib/validators/order';
import { OrderWorkflowService } from '@/services/orderWorkflowService';
import { PaymentStatus } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

type RouteContext = { params: { id: string } };

async function assertLocalPayment(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { wooIntegrationId: true },
  });
  if (order?.wooIntegrationId)
    throw new ApiError('STORE_OWNS_PAYMENT', 'תשלום להזמנה מהחנות מתעדכן ב-WooCommerce', 409);
}

const PaymentSummarySchema = z.object({
  paidAmountCents: z.number().int().min(0).optional(),
  paymentStatus: z.nativeEnum(PaymentStatus).optional(),
  lastPaymentAt: z
    .union([z.preprocess((val) => (val ? new Date(val as string) : undefined), z.date()), z.null()])
    .optional(),
});

export const dynamic = 'force-dynamic';

export const PUT = withAuth(
  async (req: NextRequest, user: AuthenticatedUser, { params }: RouteContext) => {
    try {
      await assertLocalPayment(params.id);
      const payload = (await validateRequest(OrderPaymentSchema)(req)) as OrderPaymentInput;
      const { order, payment } = await upsertOrderPayment(params.id, payload, user.id);
      const workflowPayload = await OrderWorkflowService.getOrderWithWorkflow(order.id);
      await syncOrderOperationalState(order.id, { actorId: user.id, reason: 'עדכון תשלום' });
      const fullOrder = await prisma.order.findUnique({
        where: { id: order.id },
        include: UNIFIED_ORDER_INCLUDE,
      });
      if (fullOrder) {
        await upsertUnifiedOrder(mapOrderToUnified(fullOrder as any));
      }

      return createSuccessResponse({
        ...workflowPayload,
        payment: normalizePayment(payment),
      });
    } catch (error) {
      const mapped = mapErrorToResponse(error);
      if (mapped) return mapped;
      if (error instanceof ApiError) {
        return NextResponse.json(
          {
            ok: false,
            error: error.code ? String(error.code).toLowerCase() : 'internal_error',
            detail: error.details ?? error.message,
            success: false,
          },
          { status: error.statusCode }
        );
      }
      console.error(`PUT /api/orders/${params.id}/payment error`, error);
      return asInternal();
    }
  }
);

export const PATCH = withAuth(
  async (req: NextRequest, _user: AuthenticatedUser, { params }: RouteContext) => {
    try {
      await assertLocalPayment(params.id);
      const payload = (await validateRequest(PaymentSummarySchema)(
        req
      )) as PaymentSummaryUpdatePayload;
      await updateOrderPaymentSummary(params.id, payload);
      await syncOrderOperationalState(params.id, {
        actorId: _user.id,
        reason: 'עדכון סכום/סטטוס תשלום',
      });
      const fullOrder = await prisma.order.findUnique({
        where: { id: params.id },
        include: UNIFIED_ORDER_INCLUDE,
      });
      if (fullOrder) {
        await upsertUnifiedOrder(mapOrderToUnified(fullOrder as any));
      }
      const workflowPayload = await OrderWorkflowService.getOrderWithWorkflow(params.id);

      return createSuccessResponse(workflowPayload);
    } catch (error) {
      const mapped = mapErrorToResponse(error);
      if (mapped) return mapped;
      if (error instanceof ApiError) {
        return NextResponse.json(
          {
            ok: false,
            error: error.code ? String(error.code).toLowerCase() : 'internal_error',
            detail: error.details ?? error.message,
            success: false,
          },
          { status: error.statusCode }
        );
      }
      console.error(`PATCH /api/orders/${params.id}/payment error`, error);
      return asInternal();
    }
  }
);
