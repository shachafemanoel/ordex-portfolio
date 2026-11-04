/**
 * Actionable Dashboard Items API
 * Returns all items requiring user action with priority ordering
 */

import { getCurrentUser } from '@/lib/auth/verifySession';
import { getActionableDashboardData } from '@/lib/services/dashboard/ActionableItemsService';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await getActionableDashboardData(user.id);

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('[Actionable API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch actionable data' }, { status: 500 });
  }
}
