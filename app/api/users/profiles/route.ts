import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/api-middleware';
import { listUsersWithProfiles } from '@/lib/services/users/UserProfilesService';
import { z } from 'zod';
import { UserRole } from '@prisma/client';

const QuerySchema = z.object({
  role: z.nativeEnum(UserRole).optional(),
});

export const GET = withAuth(async (req: NextRequest) => {
  const url = new URL(req.url);
  const raw = Object.fromEntries(url.searchParams);
  const params = QuerySchema.parse(raw);

  const users = await listUsersWithProfiles(params.role);
  return NextResponse.json({ success: true, data: users });
});

export const dynamic = 'force-dynamic';
