import { withAuth, type AuthenticatedUser } from '@/lib/api-middleware';
import { getSmartScheduleRecommendationsForOrder } from '@/lib/orders/smartScheduleService';
import { mapErrorToResponse } from '@/lib/server/errors';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (req: NextRequest, _user: AuthenticatedUser, { params }: { params: { id: string } }) => {
    try {
      const searchParams = req.nextUrl.searchParams;
      const limit = searchParams.get('limit');
      const lookaheadDays = searchParams.get('days');

      const data = await getSmartScheduleRecommendationsForOrder({
        orderId: params.id,
        limit: limit ? Number.parseInt(limit, 10) : undefined,
        lookaheadDays: lookaheadDays ? Number.parseInt(lookaheadDays, 10) : undefined,
      });

      return NextResponse.json({
        success: true,
        data,
      });
    } catch (error) {
      const mapped = mapErrorToResponse(error);
      if (mapped) return mapped;

      if (error instanceof Error && error.message === 'Order not found') {
        return NextResponse.json(
          {
            success: false,
            error: { message: 'Order not found', code: 'not_found' },
          },
          { status: 404 }
        );
      }

      console.error('Failed to build schedule recommendations:', error);
      return NextResponse.json(
        {
          success: false,
          error: { message: 'Failed to build schedule recommendations' },
        },
        { status: 500 }
      );
    }
  },
  { permissions: ['EDIT_ORDERS'] }
);
