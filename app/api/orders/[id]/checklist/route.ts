export const dynamic = 'force-dynamic';

import { createDataResponse, createErrorResponse, withErrorHandler } from '@/lib/api-middleware';
import { getCurrentUser } from '@/lib/auth/verifySession';
import { prisma } from '@/lib/db';
import { ChecklistState } from '@/lib/workflow-gates';
import { NextRequest } from 'next/server';
import { z } from 'zod';

const ChecklistUpdateSchema = z.object({
  itemId: z.string(),
  isChecked: z.boolean(),
});

export const POST = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const user = await getCurrentUser();
    if (!user) {
      return createErrorResponse('Unauthorized', 401);
    }

    const body = await req.json();
    const validation = ChecklistUpdateSchema.safeParse(body);

    if (!validation.success) {
      return createErrorResponse('Validation Error', 400, validation.error.format());
    }

    const { itemId, isChecked } = validation.data;
    const orderId = params.id;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return createErrorResponse('Order not found', 404);
    }

    const currentChecklist = (order.checklistState as unknown as ChecklistState) || {};
    const updatedChecklist = {
      ...currentChecklist,
      [itemId]: isChecked,
    };

    await prisma.eventLog.create({
      data: {
        orderId,
        userId: user.id,
        type: 'CHECKLIST_UPDATE',
        payload: {
          itemId,
          isChecked,
        },
      },
    });

    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        checklistState: updatedChecklist,
      },
    });

    return createDataResponse(updatedOrder, req);
  }
);
