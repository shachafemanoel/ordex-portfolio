import { NextRequest, NextResponse } from 'next/server';

import {
  isDeliveryPlanningConfigured,
  planDeliveryRoute,
  planningRequestSchema,
} from '@/lib/delivery-route-planning';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!isDeliveryPlanningConfigured()) {
    return NextResponse.json({ error: { message: 'Mapbox is not configured' } }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = planningRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          message: 'Invalid planning payload',
          details: parsed.error.flatten(),
        },
      },
      { status: 400 }
    );
  }

  const data = await planDeliveryRoute({
    ...parsed.data,
    autoSplit: true,
  });

  return NextResponse.json({ data });
}
