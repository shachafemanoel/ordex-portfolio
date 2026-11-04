export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { computeDrillState } from '@/lib/services/orders-ops';
import { buildOrderSnapshot } from '@/lib/orders/rules/orderSnapshot';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        shippingAddress: true,
        calendarEvents: true,
        payments: true, // Fetch payments for recovery rule
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const snapshot = buildOrderSnapshot(order as any);
    const drillState = computeDrillState({
      snapshot,
      opsChecklistState: order.opsChecklistState as any,
      opsSnoozeUntil: order.opsSnoozeUntil,
      opsSnoozeReason: order.opsSnoozeReason,
    });

    return NextResponse.json(drillState);
  } catch (error) {
    console.error('Error fetching drill state:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
