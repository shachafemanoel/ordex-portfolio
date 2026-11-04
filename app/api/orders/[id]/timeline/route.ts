import { createSuccessResponse, withAuth } from '@/lib/api-middleware';
import { mapErrorToResponse } from '@/lib/server/errors';
import { getOrderActivityTimeline } from '@/lib/services/orders/activityTimeline';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (_req: NextRequest, _user, { params }: { params: { id: string } }) => {
    try {
      const timeline = await getOrderActivityTimeline(params.id);
      return createSuccessResponse(timeline);
    } catch (error) {
      const mapped = mapErrorToResponse(error);
      if (mapped) return mapped;

      console.error('Failed to fetch order timeline', error);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'timeline_fetch_failed',
            message: 'Failed to fetch order timeline',
          },
        },
        { status: 500 }
      );
    }
  }
);
