import { NextResponse, type NextRequest } from 'next/server';
import { withAuthApiRoute } from '@/lib/auth/withAuthApiRoute';
import { getExecutiveDashboardData } from '@/services/executiveDashboardService';

export const dynamic = 'force-dynamic';

async function handler(_req: NextRequest) {
  try {
    const data = await getExecutiveDashboardData();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Executive dashboard error', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to load executive dashboard' } },
      { status: 500 }
    );
  }
}

export const GET = withAuthApiRoute(handler);
