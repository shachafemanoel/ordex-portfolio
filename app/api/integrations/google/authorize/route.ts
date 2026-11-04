import { createErrorResponse, withAuth } from '@/lib/api-middleware';
import type { AuthenticatedUser } from '@/lib/auth/types';
import { GoogleOAuthCredentialsService } from '@/lib/services/google-workspace/GoogleOAuthCredentialsService';
import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const STATE_COOKIE = 'ordex_google_oauth_state';
const ACTOR_COOKIE = 'ordex_google_oauth_actor';
const COOKIE_MAX_AGE = 600;

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: COOKIE_MAX_AGE,
};

export const GET = withAuth(
  async (_req: NextRequest, user: AuthenticatedUser) => {
    try {
      const svc = new GoogleOAuthCredentialsService();
      if (!svc.isConfigured()) {
        return createErrorResponse('Google OAuth is not configured', 503, {
          code: 'GOOGLE_OAUTH_CONFIG',
        });
      }
      const state = randomBytes(32).toString('hex');
      const url = svc.generateAuthorizationUrl(state);
      const res = NextResponse.redirect(url);
      res.cookies.set(STATE_COOKIE, state, cookieOpts);
      res.cookies.set(ACTOR_COOKIE, user.id, cookieOpts);
      return res;
    } catch (e) {
      console.error('[google/authorize]', e);
      return createErrorResponse('Failed to start Google authorization', 500);
    }
  },
  { roles: ['ADMIN'], permissions: ['MANAGE_INTEGRATIONS'], requireAll: true }
);
