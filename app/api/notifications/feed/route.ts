import { createDataResponse, withAuth, type AuthenticatedUser } from '@/lib/api-middleware';
import { NotificationService } from '@/lib/notifications/service';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (_req: NextRequest, user: AuthenticatedUser) => {
  try {
    const notifications = await NotificationService.getUserNotifications(user.id);
    return createDataResponse(notifications);
  } catch (error) {
    console.error('Failed to fetch notifications feed', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch notifications',
      },
      { status: 500 }
    );
  }
});
