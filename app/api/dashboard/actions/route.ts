/**
 * Dashboard Actions API
 * Handles snooze/reminder and quick action operations
 */

export const dynamic = 'force-dynamic';

import { getCurrentUser } from '@/lib/auth/verifySession';
import { snoozeItem, SnoozeRequest } from '@/lib/services/dashboard/ActionableItemsService';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const snoozeSchema = z.object({
  itemId: z.string(),
  itemType: z.enum(['TASK', 'ORDER_ACTION', 'INSTALLATION', 'DELIVERY', 'PAYMENT', 'STOCK']),
  snoozeUntil: z.string().transform((s) => new Date(s)),
  orderId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = snoozeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const snoozeRequest: SnoozeRequest = {
      ...parsed.data,
      userId: user.id,
    };

    const result = await snoozeItem(snoozeRequest);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: 'תזכורת נוצרה בהצלחה',
        taskId: result.taskId,
      });
    }

    return NextResponse.json({ error: 'Failed to create reminder' }, { status: 500 });
  } catch (error) {
    console.error('[Dashboard Actions] Snooze error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
