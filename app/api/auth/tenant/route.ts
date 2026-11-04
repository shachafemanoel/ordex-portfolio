import { authConfig } from '@/lib/auth/config';
import { setSessionCookie } from '@/lib/auth/cookies';
import { createSessionToken } from '@/lib/auth/tokens';
import { tenantRoute } from '@/lib/tenancy/api';
import { resolveTenantMembership } from '@/lib/tenancy/session';
import { NextResponse } from 'next/server';
import { z } from 'zod';

export const POST = tenantRoute(async (req, user) => {
  const { tenantId } = z.object({ tenantId: z.string().min(1).max(100) }).parse(await req.json());
  const membership = await resolveTenantMembership(user.id, tenantId);
  const token = createSessionToken(
    { ...user, tenantId: membership.tenantId, role: membership.role },
    authConfig.sessionMaxAge
  );
  const response = NextResponse.json({
    success: true,
    data: { token, tenantId: membership.tenantId },
  });
  setSessionCookie(response, token);
  return response;
});
