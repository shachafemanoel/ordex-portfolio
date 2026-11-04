export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { computeDrillState, OpsLane } from '@/lib/services/orders-ops';
import { buildOrderSnapshot } from '@/lib/orders/rules/orderSnapshot';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { taskLabel, stepId, checked } = body;

    if (!taskLabel || !stepId || typeof checked !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required fields: taskLabel, stepId, checked' },
        { status: 400 }
      );
    }

    // 1. Fetch Order with relations needed for snapshot
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        shippingAddress: true,
        calendarEvents: true,
        // Assuming relatedPurchaseOrders logic is handled via other means or minimal check
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // 2. Load existing checklist state
    const existingChecklist = (order.opsChecklistState as Record<string, Record<string, boolean>>) || {};

    // 3. Update the specific key
    const updatedChecklist = {
      ...existingChecklist,
      [taskLabel]: {
        ...(existingChecklist[taskLabel] || {}),
        [stepId]: checked,
      },
    };

    // 4. Re-compute Drill State to get new derived fields
    const snapshot = buildOrderSnapshot(order as any); // Cast as needed for relations
    const drillState = computeDrillState({
      snapshot,
      opsChecklistState: updatedChecklist,
      opsSnoozeUntil: order.opsSnoozeUntil,
      opsSnoozeReason: order.opsSnoozeReason,
    });

    // 5. Update DB
    await prisma.order.update({
      where: { id },
      data: {
        opsChecklistState: updatedChecklist,
        opsLane: drillState.lane,
        opsCurrentTask: drillState.currentTask.taskLabel,
        // We could store opsStatus if we had a mapping, but for now lane/task is enough
      },
    });

    return NextResponse.json(drillState);
  } catch (error) {
    console.error('Error updating checklist:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
