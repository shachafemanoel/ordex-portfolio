/**
 * POST /api/notifications/retry-overdue
 * Create retry notifications for overdue tasks
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthenticatedUser } from '@/lib/api-middleware';
import { SmartNotifications } from '@/lib/notifications/smart-notifications';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const RetryNotificationsSchema = z.object({
  retryAfterHours: z.number().optional(),
  maxRetries: z.number().optional(),
});

export const POST = withAuth(
  async (req: NextRequest, _user: AuthenticatedUser) => {
    try {
      const body = await req.json().catch(() => ({}));
      const config = RetryNotificationsSchema.parse(body);

      console.log('[API] Creating retry notifications for overdue tasks');

      const result = await SmartNotifications.createRetryNotificationsForOverdueTasks(config);

      return NextResponse.json({
        success: true,
        data: {
          tasksFound: result.tasksFound,
          notificationsCreated: result.notificationsCreated,
        },
        message: `נוצרו ${result.notificationsCreated} התראות חוזרות עבור ${result.tasksFound} משימות באיחור`,
      });
    } catch (error: any) {
      console.error('[API] Retry notifications error:', error);

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
          error: { message: 'שגיאה ביצירת התראות חוזרות', details: error.message },
        },
        { status: 500 }
      );
    }
  }
);
