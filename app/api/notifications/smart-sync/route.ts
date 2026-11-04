/**
 * POST /api/notifications/smart-sync
 * Sync smart notifications for all open tasks
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthenticatedUser } from '@/lib/api-middleware';
import { SmartNotifications } from '@/lib/notifications/smart-notifications';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const SyncNotificationsSchema = z.object({
  immediateForUrgent: z.boolean().optional(),
  reminderBeforeDue: z.number().optional(),
  respectBusinessHours: z.boolean().optional(),
  preferredChannel: z.enum(['SMS', 'WHATSAPP', 'EMAIL']).optional(),
});

export const POST = withAuth(
  async (req: NextRequest, _user: AuthenticatedUser) => {
    try {
      const body = await req.json().catch(() => ({}));
      const config = SyncNotificationsSchema.parse(body);

      console.log('[API] Syncing smart notifications for open tasks');

      const result = await SmartNotifications.syncNotificationsForOpenTasks(config);

      return NextResponse.json({
        success: true,
        data: {
          tasksProcessed: result.tasksProcessed,
          notificationsCreated: result.notificationsCreated,
          notificationsSkipped: result.notificationsSkipped,
        },
        message: `נוצרו ${result.notificationsCreated} התראות מתוך ${result.tasksProcessed} משימות`,
      });
    } catch (error: any) {
      console.error('[API] Smart notifications sync error:', error);

      if (error instanceof z.ZodError) {
        return NextResponse.json(
          {
            success: false,
            error: { message: 'נתונים לא תקינים', details: error.errors },
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: { message: 'שגיאה בסנכרון התראות', details: error.message },
        },
        { status: 500 }
      );
    }
  }
);
