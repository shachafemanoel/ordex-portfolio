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
    const body = await req.json();
    const { until, reason } = body;

    if (!until) {
      return NextResponse.json({ error: 'Missing required field: until' }, { status: 400 });
    }

    const snoozeUntil = new Date(until);
    if (isNaN(snoozeUntil.getTime())) {
       return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }

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

    // 2. Re-compute Drill State with NEW snooze values
    // Note: We compute state BEFORE saving to ensure we save consistent derived fields (lane)
    const snapshot = buildOrderSnapshot(order as any);
    const drillState = computeDrillState({
      snapshot,
      opsChecklistState: order.opsChecklistState as any,
      opsSnoozeUntil: snoozeUntil,
      opsSnoozeReason: reason,
    });

    // 3. Update DB
    await prisma.order.update({
      where: { id },
      data: {
        opsSnoozeUntil: snoozeUntil,
        opsSnoozeReason: reason,
        opsLane: drillState.lane, // Should become WAITING
        opsCurrentTask: drillState.currentTask.taskLabel,
      },
    });

    return NextResponse.json(drillState);
  } catch (error) {
    console.error('Error snoozing order:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
