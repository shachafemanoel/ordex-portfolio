import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function parseHeaderNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: NextRequest) {
  const lat =
    parseHeaderNumber(request.headers.get('x-vercel-ip-latitude')) ??
    parseHeaderNumber(request.headers.get('x-latitude'));
  const lng =
    parseHeaderNumber(request.headers.get('x-vercel-ip-longitude')) ??
    parseHeaderNumber(request.headers.get('x-longitude'));

  if (lat === null || lng === null) {
    return NextResponse.json({ data: null });
  }

  return NextResponse.json({
    data: {
      lat,
      lng,
      city: request.headers.get('x-vercel-ip-city') || null,
      country: request.headers.get('x-vercel-ip-country') || null,
      source: 'ip',
    },
  });
}
