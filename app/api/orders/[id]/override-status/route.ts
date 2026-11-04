import {
  ApiError,
  createSuccessResponse,
  withAuth,
  type AuthenticatedUser,
} from '@/lib/api-middleware';
import { prisma } from '@/lib/db';
import { getStatusLabel, normalizeOrderStatus } from '@/lib/orderStatus';
import { validateTransition } from '@/lib/status-machine';
import { OrderStatus } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const OverrideSchema = z.object({
  toStatus: z.nativeEnum(OrderStatus),
  reason: z.string().trim().min(2, 'יש לציין סיבה לעקיפה').max(500),
});

export const POST = withAuth(
  async (req: NextRequest, user: AuthenticatedUser, { params }: { params: { id: string } }) => {
    // Overriding skips the transition conditions (never the transition table), so only a
    // business admin may do it, and the reason is kept in the status history.
    if (user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, error: { message: 'רק מנהל העסק יכול לעקוף תנאי מעבר' } },
        { status: 403 }
      );
    }

    try {
      const body = await req.json();
      const parsed = OverrideSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: { message: 'בקשה לא תקינה', details: parsed.error.flatten() } },
          { status: 400 }
        );
      }

      const target = normalizeOrderStatus(parsed.data.toStatus);
      const order = await prisma.order.findUnique({ where: { id: params.id } });
      if (!order) throw new ApiError('order_not_found', 'Order not found', 404);

      const current = normalizeOrderStatus(order.status);
      const validation = validateTransition(current, target);
      if (!validation.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: {
              message: `לא ניתן לעבור מ"${getStatusLabel(current)}" ל"${getStatusLabel(target)}"`,
            },
          },
          { status: 400 }
        );
      }

      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT set_config('app.transition_override_reason', ${parsed.data.reason}, true)`;
        await tx.order.update({
          where: { id: params.id },
          data: { status: target, statusV2: target, statusUpdatedAt: new Date() },
        });
        await tx.statusHistory.create({
          data: {
            orderId: params.id,
            fromStatus: current,
            toStatus: target,
            changedBy: user.id,
            reason: parsed.data.reason,
            metadata: { manualOverride: true },
          },
        });
      });

      return createSuccessResponse({ orderId: params.id, status: target });
    } catch (error) {
      console.error('override-status error', error);
      return NextResponse.json(
        { success: false, error: { message: 'שגיאה בעדכון סטטוס' } },
        { status: 500 }
      );
    }
  }
);
