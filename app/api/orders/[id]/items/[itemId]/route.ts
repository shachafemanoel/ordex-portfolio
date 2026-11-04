export const dynamic = 'force-dynamic';

import { getCurrentUser } from '@/lib/auth/verifySession';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const updateItemSchema = z.object({
  status: z.enum(['PENDING', 'ORDERED', 'RECEIVED', 'INSTALLED', 'CANCELLED']).optional(),
  quantity: z.number().int().positive().optional(),
  remarks: z.string().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: orderId, itemId } = await params;
    const user = await getCurrentUser();
    const json = await request.json();
    const body = updateItemSchema.parse(json);

    // Verify item belongs to order
    const item = await prisma.orderItem.findFirst({
      where: {
        id: itemId,
        orderId,
      },
    });

    if (!item) {
      return new NextResponse('Item not found', { status: 404 });
    }

    const updatedItem = await prisma.orderItem.update({
      where: { id: itemId },
      data: {
        ...(body.status && { status: body.status }),
        ...(body.quantity && { quantity: body.quantity }),
        ...(body.remarks && { remarks: body.remarks }),
      },
    });

    return NextResponse.json(updatedItem);
  } catch (error) {
    console.error('[ORDER_ITEM_UPDATE]', error);
    if (error instanceof z.ZodError) {
      return new NextResponse('Invalid request data', { status: 400 });
    }
    return new NextResponse('Internal Error', { status: 500 });
  }
}
