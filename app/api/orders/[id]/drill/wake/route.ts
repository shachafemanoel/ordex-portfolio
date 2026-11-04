export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { computeDrillState } from '@/lib/services/orders-ops';
import { buildOrderSnapshot } from '@/lib/orders/rules/orderSnapshot';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1. Fetch Order
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        shippingAddress: true,
        calendarEvents: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // 2. Re-compute Drill State with NO snooze
    const snapshot = buildOrderSnapshot(order as any);
    const drillState = computeDrillState({
      snapshot,
      opsChecklistState: order.opsChecklistState as any,
      opsSnoozeUntil: null,
      opsSnoozeReason: null,
    });

    // 3. Update DB
    await prisma.order.update({
      where: { id },
      data: {
        opsSnoozeUntil: null,
        opsSnoozeReason: null,
        opsLane: drillState.lane, // Likely NEEDS_ACTION
        opsCurrentTask: drillState.currentTask.taskLabel,
      },
    });

    return NextResponse.json(drillState);
  } catch (error) {
    console.error('Error waking order:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
