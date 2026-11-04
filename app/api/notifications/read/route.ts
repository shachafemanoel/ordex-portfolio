export const dynamic = 'force-dynamic';

import { withAuth, type AuthenticatedUser } from '@/lib/api-middleware';
import { NotificationService } from '@/lib/notifications/service';
import { NextRequest, NextResponse } from 'next/server';

export const POST = withAuth(async (req: NextRequest, user: AuthenticatedUser) => {
  try {
    const body = await req.json();

    if (body.all) {
      await NotificationService.markAllAsRead(user.id);
    } else if (body.notificationId) {
      await NotificationService.markAsRead(user.id, body.notificationId);
    } else {
      return NextResponse.json({ success: false, error: 'Missing notificationId' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to mark notification as read', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
});
