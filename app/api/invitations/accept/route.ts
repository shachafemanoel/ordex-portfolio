import { handleApiError } from '@/lib/api-middleware';
import { authConfig } from '@/lib/auth/config';
import { clearFallbackBlockCookie, setSessionCookie } from '@/lib/auth/cookies';
import { createSessionToken } from '@/lib/auth/tokens';
import { authRateLimit, withRateLimit } from '@/lib/rate-limit';
import { acceptInvitation } from '@/lib/tenancy/invitations';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

async function accept(req: NextRequest) {
  try {
    const input = z
      .object({
        token: z.string().min(40).max(64),
        name: z.string().trim().min(1).max(120),
        password: z.string().min(1).max(128),
      })
      .parse(await req.json());
    const user = await acceptInvitation(input);
    const token = createSessionToken(user, authConfig.sessionMaxAge);
    const response = NextResponse.json({ success: true, data: { token } });
    setSessionCookie(response, token);
    clearFallbackBlockCookie(response);
    return response;
  } catch (error) {
    return handleApiError(error, req);
  }
}

export const POST = withRateLimit(authRateLimit, accept);
