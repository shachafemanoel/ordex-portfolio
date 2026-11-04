export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ message: 'Customer 360 view not implemented' }, { status: 501 });
}
