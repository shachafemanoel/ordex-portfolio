/**
 * Dashboard Snapshot API
 * Provides comprehensive dashboard data including KPIs, status counts, timeline, and recent orders
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDashboardSnapshot } from '@/lib/demo/dashboard';
import { createSuccessResponse } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    const snapshot = await getDashboardSnapshot();
    return createSuccessResponse(snapshot);
  } catch (error) {
    console.error('Dashboard snapshot API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to fetch dashboard snapshot',
          code: 'DASHBOARD_SNAPSHOT_ERROR',
        },
      },
      { status: 500 }
    );
  }
}
