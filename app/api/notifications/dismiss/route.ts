export const dynamic = 'force-dynamic';

import { withAuth, type AuthenticatedUser } from '@/lib/api-middleware';
import { NotificationService } from '@/lib/notifications/service';
import { NextRequest, NextResponse } from 'next/server';

export const POST = withAuth(async (req: NextRequest, user: AuthenticatedUser) => {
  try {
    const body = await req.json();

    if (!body.notificationId) {
      return NextResponse.json({ success: false, error: 'Missing notificationId' }, { status: 400 });
    }

    // Try to delete if persistent
    const deleted = await NotificationService.deleteNotification(user.id, body.notificationId);

    // If not persistent (or not found in DB), assume it's smart and dismiss it
    if (!deleted) {
        await NotificationService.dismissSmartNotification(user.id, body.notificationId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to dismiss notification', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
});
