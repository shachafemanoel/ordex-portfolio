import { isTenantRuntime } from '@/lib/tenancy/context';
import { toAuthenticatedUser } from '@/lib/auth/types';
import { TokenExpiredError } from 'jsonwebtoken';
import { cookies as nextCookies } from 'next/headers';
import type { NextRequest } from 'next/server';

import { isDemo } from '@/lib/featureFlags';
import { SESSION_COOKIE_NAME } from '@/lib/auth/config';
import { FALLBACK_BLOCK_COOKIE, getTokenFromRequest } from '@/lib/auth/cookies';
import { AuthenticationError, SessionExpiredError } from '@/lib/auth/errors';
import { getFallbackUser, isFallbackEnabled } from '@/lib/auth/fallback';
import { verifySessionToken } from '@/lib/auth/tokens';
import type { AuthenticatedUser, SessionPayload } from '@/lib/auth/types';
import { findSessionUserById } from '@/lib/auth/user.server';

export interface VerifiedSession {
  user: AuthenticatedUser;
  token: string;
  payload: SessionPayload;
}

async function resolveUser(userId: string, tenantId?: string, sessionVersion = 0): Promise<AuthenticatedUser> {
  const user = await findSessionUserById(userId);
  if (!user || (user.sessionVersion ?? 0) !== sessionVersion) {
    throw new AuthenticationError('User not found for session.');
  }
  if (isTenantRuntime()) {
    const { resolveTenantMembership } = await import('@/lib/tenancy/session');
    const membership = await resolveTenantMembership(userId, tenantId);
    return toAuthenticatedUser({ ...user, tenantId: membership.tenantId, role: membership.role });
  }
  return user;
}

function buildFallbackPayload(user: AuthenticatedUser): SessionPayload {
  const now = Math.floor(Date.now() / 1000);
  return {
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    iss: 'ordex:fallback',
    aud: 'ordex-app',
    iat: now,
    exp: now + 24 * 60 * 60,
  };
}

async function resolveFallbackSession(
  reason: 'demo' | 'fallback' = 'fallback'
): Promise<VerifiedSession> {
  if (reason === 'demo') {
    const fallbackUser = await getFallbackUser();
    if (!fallbackUser) {
      throw new AuthenticationError('Demo user not configured.');
    }

    return {
      user: { ...fallbackUser, name: fallbackUser.name || 'Demo Admin' },
      token: 'demo-admin-token',
      payload: buildFallbackPayload(fallbackUser),
    };
  }

  if (!isFallbackEnabled()) {
    throw new AuthenticationError('Fallback authentication is disabled.');
  }
  const fallbackUser = await getFallbackUser();
  if (!fallbackUser) {
    throw new AuthenticationError('Fallback user not configured.');
  }

  return {
    user: fallbackUser,
    token: 'fallback-admin',
    payload: buildFallbackPayload(fallbackUser),
  };
}

function isTokenExpiredError(error: unknown): error is TokenExpiredError {
  return (
    error instanceof TokenExpiredError ||
    (typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      (error as any).name === 'TokenExpiredError')
  );
}

export async function verifySessionFromRequest(req: NextRequest): Promise<VerifiedSession> {
  const fallbackBlocked =
    req.cookies.get(FALLBACK_BLOCK_COOKIE)?.value === '1' ||
    req.headers.get('x-ordex-no-fallback') === '1';

  if (isDemo() && !fallbackBlocked) {
    return resolveFallbackSession('demo');
  }

  const token = getTokenFromRequest(req);

  if (!token) {
    if (isFallbackEnabled() && !fallbackBlocked) {
      return resolveFallbackSession('fallback');
    }
    throw new AuthenticationError('No session token provided and fallback is disabled.');
  }

  try {
    const payload = verifySessionToken(token);
    const user = await resolveUser(payload.sub, payload.tenantId, payload.sessionVersion);
    return { user, token, payload };
  } catch (error) {
    if (isTokenExpiredError(error)) {
      throw new SessionExpiredError();
    }

    if (error instanceof AuthenticationError) {
      throw error;
    }

    throw new AuthenticationError('Session verification failed.');
  }
}

export async function verifySession(): Promise<VerifiedSession> {
  const cookieStore = await nextCookies();
  const fallbackBlocked = cookieStore.get(FALLBACK_BLOCK_COOKIE)?.value === '1';

  if (isDemo() && !fallbackBlocked) {
    return resolveFallbackSession('demo');
  }

  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    if (isFallbackEnabled() && !fallbackBlocked) {
      return resolveFallbackSession('fallback');
    }
    throw new AuthenticationError('No session cookie found and fallback is disabled.');
  }

  try {
    const payload = verifySessionToken(token);
    const user = await resolveUser(payload.sub, payload.tenantId, payload.sessionVersion);
    return { user, token, payload };
  } catch (error) {
    if (isTokenExpiredError(error)) {
      throw new SessionExpiredError('Session token expired');
    }

    if (error instanceof AuthenticationError) {
      throw error;
    }
    throw new AuthenticationError('Session verification failed.');
  }
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  try {
    const { user } = await verifySession();
    return user;
  } catch {
    return null;
  }
}
