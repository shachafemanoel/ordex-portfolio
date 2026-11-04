import { NextRequest, NextResponse } from 'next/server';

import { normalizeUser } from '@/domain/users/normalizeUser';
import { withAuth, type AuthenticatedUser } from '@/lib/api-middleware';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (_req: NextRequest, user: AuthenticatedUser) => {
  return NextResponse.json({
    success: true,
    data: normalizeUser(user as any),
  });
});
