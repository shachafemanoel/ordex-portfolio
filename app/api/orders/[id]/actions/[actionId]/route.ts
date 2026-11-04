export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth/verifySession';
import { ORDER_ACTION_HANDLERS } from '@/lib/server/actions/orderActionHandlers';
import { ORDER_ACTIONS } from '@/lib/actions/orderActions';
import { prisma } from '@/lib/db';

export async function POST(
  request: NextRequest,
  props: { params: Promise<{ id: string; actionId: string }> }
) {
  try {
    const { user } = await verifySession();
    if (!user) {
        return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const params = await props.params;
    const { id: orderId, actionId } = params;

    // Check availability
    const handler = ORDER_ACTION_HANDLERS[actionId];
    const actionDef = ORDER_ACTIONS.find(a => a.id === actionId);

    if (!handler || !actionDef) {
        return NextResponse.json({ message: 'Action not found' }, { status: 404 });
    }

    // Load order for availability check
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
        return NextResponse.json({ message: 'Order not found' }, { status: 404 });
    }

    // Validate availability
    // Note: casting order as any because action definition might use enriched types,
    // but basic status check usually works with raw prisma result.
    if (!actionDef.isAvailable(order as any)) {
         const reason = actionDef.unavailableReason?.(order as any) || 'Action not available';
         return NextResponse.json({ message: reason }, { status: 400 });
    }

    const payload = await request.json();

    // Validate payload
    if (actionDef.payloadSchema) {
        const validation = actionDef.payloadSchema.safeParse(payload);
        if (!validation.success) {
            return NextResponse.json({
                message: 'נתונים לא תקינים',
                errors: validation.error.format(),
                detail: validation.error.errors.map(e => e.message).join(', ')
            }, { status: 400 });
        }
    }

    const result = await handler(orderId, payload, user.id);

    return NextResponse.json(result);
  } catch (error: any) {
      console.error(`Action ${props.params ? (await props.params).actionId : 'unknown'} failed:`, error);
      return NextResponse.json({ message: error.message || 'Internal Error' }, { status: 500 });
  }
}
