export const dynamic = 'force-dynamic';

import { getCurrentUser } from '@/lib/auth/verifySession';
import { prisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const updateItemsSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      receivedQuantity: z.number().optional(),
      status: z.enum(['PENDING', 'ORDERED', 'RECEIVED', 'INSTALLED', 'CANCELLED']).optional(),
      // Add other fields as needed
    })
  ),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { items } = updateItemsSchema.parse(body);

    // Verify order exists and access?
    // For now assuming access control is handled or open for authenticated users.

    const result = await prisma.$transaction(
      items.map((item) =>
        prisma.orderItem.update({
          where: { id: item.id },
          data: {
            receivedQuantity: item.receivedQuantity,
            status: item.status as any,
          },
        })
      )
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Error updating order items:', error);
    return NextResponse.json({ error: 'Failed to update items' }, { status: 500 });
  }
}
