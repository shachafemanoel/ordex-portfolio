import { NextRequest, NextResponse } from 'next/server';
import { OrderStatus } from '@prisma/client';
import { prisma } from '@/lib/db';
import { isDemo } from '@/lib/featureFlags';

const ALLOWED_ACTIONS = ['approve', 'cancel'] as const;

export const dynamic = 'force-dynamic';

type DemoAction = (typeof ALLOWED_ACTIONS)[number];

const DEMO_APPROVED_STATUS: OrderStatus = OrderStatus.CONFIRMED;

function mapActionToStatus(action: DemoAction): OrderStatus {
  return action === 'approve' ? DEMO_APPROVED_STATUS : OrderStatus.CANCELLED;
}

export async function POST(request: NextRequest) {
  if (!isDemo()) {
    return NextResponse.json({ error: 'Demo actions are disabled' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const orderId: string | undefined = body?.orderId;
    const action: DemoAction | undefined = ALLOWED_ACTIONS.includes(body?.action)
      ? body.action
      : undefined;

    if (!orderId || !action) {
      return NextResponse.json({ error: 'orderId and action are required' }, { status: 400 });
    }

    const order = await prisma.order.update({
      where: { id: orderId, demo: true },
      data: {
        status: mapActionToStatus(action),
      },
      include: {
        customer: true,
      },
    });

    return NextResponse.json({
      id: order.id,
      status: order.status,
      updatedAt: order.updatedAt,
    });
  } catch (error) {
    console.error('Failed to execute demo order action', error);
    return NextResponse.json({ error: 'Failed to execute action' }, { status: 500 });
  }
}
