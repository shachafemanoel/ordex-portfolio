import { withAuth, type AuthenticatedUser } from '@/lib/api-middleware';
import { listWorkCalendarData } from '@/lib/installations/workCalendar';
import { mapErrorToResponse } from '@/lib/server/errors';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export const GET = withAuth(
  async (req: NextRequest, _user: AuthenticatedUser) => {
    try {
      const dateFromRaw = req.nextUrl.searchParams.get('dateFrom');
      const dateToRaw = req.nextUrl.searchParams.get('dateTo');

      if (!dateFromRaw || !dateToRaw) {
        return NextResponse.json(
          {
            success: false,
            error: { message: 'dateFrom and dateTo are required' },
          },
          { status: 400 }
        );
      }

      const dateFrom = new Date(dateFromRaw);
      const dateTo = new Date(dateToRaw);

      if (Number.isNaN(dateFrom.getTime()) || Number.isNaN(dateTo.getTime())) {
        return NextResponse.json(
          {
            success: false,
            error: { message: 'Invalid date range' },
          },
          { status: 400 }
        );
      }

      const data = await listWorkCalendarData({ dateFrom, dateTo });

      return NextResponse.json({
        success: true,
        data,
      });
    } catch (error) {
      const mapped = mapErrorToResponse(error);
      if (mapped) return mapped;

      console.error('Failed to fetch work calendar tasks:', error);
      return NextResponse.json(
        {
          success: false,
          error: { message: 'Failed to fetch work calendar tasks' },
        },
        { status: 500 }
      );
    }
  },
  { permissions: ['EDIT_ORDERS'] }
);
