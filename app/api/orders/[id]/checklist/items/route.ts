export const dynamic = 'force-dynamic';

import { prisma as db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: orderId } = await params;
    const { itemsChecklist } = await request.json();

    if (!orderId) {
      return NextResponse.json({ success: false, error: 'Missing order ID' }, { status: 400 });
    }

    const order = await db.order.update({
      where: { id: orderId },
      data: {
        itemsChecklist,
        lastActionAt: new Date(), // Update staleness
      },
    });

    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    console.error('Failed to update items checklist:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update items checklist' },
      { status: 500 }
    );
  }
}
