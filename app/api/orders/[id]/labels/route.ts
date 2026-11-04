export const dynamic = 'force-dynamic';

import {
  createDataResponse,
  createErrorResponse,
  withErrorHandler,
} from '@/lib/api-middleware';
import { getCurrentUser } from '@/lib/auth/verifySession';
import { LabelService } from '@/lib/services/orders/LabelService';
import { NextRequest } from 'next/server';
import { z } from 'zod';

const SetLabelsSchema = z.object({
  labelIds: z.array(z.string()),
});

const AssignLabelSchema = z.object({
  labelId: z.string(),
  action: z.enum(['assign', 'unassign']),
});

export const POST = withErrorHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const user = await getCurrentUser();
  if (!user) {
    return createErrorResponse('Unauthorized', 401);
  }

  const { id: orderId } = await params;
  const body = await req.json();

  const service = new LabelService();

  // Handle bulk set
  if (body.labelIds) {
    const validation = SetLabelsSchema.safeParse(body);
    if (!validation.success) {
      return createErrorResponse('Validation Error', 400, validation.error.format());
    }
    const order = await service.setOrderLabels(orderId, validation.data.labelIds);
    if (!order) {
      return createErrorResponse('Order not found', 404);
    }
    return createDataResponse(order, req);
  }

  // Handle single assign/unassign
  const validation = AssignLabelSchema.safeParse(body);
  if (!validation.success) {
    return createErrorResponse('Validation Error', 400, validation.error.format());
  }

  const { labelId, action } = validation.data;
  let order;

  if (action === 'assign') {
    order = await service.assignLabelToOrder(orderId, labelId);
  } else {
    order = await service.unassignLabelFromOrder(orderId, labelId);
  }
  if (!order) {
    return createErrorResponse('Order not found', 404);
  }

  return createDataResponse(order, req);
});
