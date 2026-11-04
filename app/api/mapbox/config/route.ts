import { NextResponse } from 'next/server';

import { getMapboxAccessToken, getMapboxStyleId } from '@/lib/mapbox/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const token = getMapboxAccessToken();
  const styleId = getMapboxStyleId();

  if (!token) {
    return NextResponse.json(
      { error: { message: 'Mapbox is not configured' } },
      { status: 404 }
    );
  }

  return NextResponse.json({
    data: {
      token,
      styleId,
    },
  });
}
