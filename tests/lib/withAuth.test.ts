import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const verifySessionMock = vi.hoisted(() => ({
  verifySessionFromRequest: vi.fn(),
}));

vi.mock('@/lib/auth/verifySession', () => verifySessionMock);

import { ROLE_PERMISSIONS } from '@/lib/auth/types';
import { withAuth } from '@/lib/api-middleware';
import { AuthenticationError, SessionExpiredError } from '@/lib/auth/errors';
import { SESSION_COOKIE_NAME } from '@/lib/auth/config';

const buildRequest = (url: string, init: RequestInit): NextRequest => {
  const request = new Request(url, init);
  const nextRequest = request as unknown as NextRequest & {
    cookies: {
      get: (name: string) => { name: string; value: string } | undefined;
      set: (name: string, value: string) => void;
      delete: (name: string) => void;
      has: (name: string) => boolean;
    };
    nextUrl: URL;
  };

  const cookieStore = new Map<string, string>();
  nextRequest.cookies = {
    get: (name: string) =>
      cookieStore.has(name) ? { name, value: cookieStore.get(name)! } : undefined,
    set: (name: string, value: string) => {
      cookieStore.set(name, value);
    },
    delete: (name: string) => {
      cookieStore.delete(name);
    },
    has: (name: string) => cookieStore.has(name),
  };
  nextRequest.nextUrl = new URL(url);

  return nextRequest;
};

describe('withAuth middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows authenticated users through', async () => {
    verifySessionMock.verifySessionFromRequest.mockResolvedValueOnce({
      user: {
        id: 'admin-1',
        email: 'admin@example.com',
        role: 'ADMIN',
        permissions: ROLE_PERMISSIONS.ADMIN,
      },
      token: 'token',
      payload: {
        sub: 'admin-1',
        email: 'admin@example.com',
        role: 'ADMIN',
        iss: 'ordex',
        aud: 'ordex-app',
        iat: Date.now() / 1000,
        exp: Date.now() / 1000 + 3600,
      },
    });

    const handler = withAuth(async () => Response.json({ ok: true }));
    const response = await handler(buildRequest('http://localhost/api/secure', { method: 'GET' }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
  });

  it('rejects unauthenticated users with 401', async () => {
    verifySessionMock.verifySessionFromRequest.mockRejectedValueOnce(new AuthenticationError());

    const handler = withAuth(async () => Response.json({ ok: true }));
    const response = await handler(buildRequest('http://localhost/api/secure', { method: 'GET' }));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.success).toBe(false);
  });

  it('clears session cookie when session has expired', async () => {
    verifySessionMock.verifySessionFromRequest.mockRejectedValueOnce(new SessionExpiredError());

    const handler = withAuth(async () => Response.json({ ok: true }));
    const response = await handler(buildRequest('http://localhost/api/secure', { method: 'GET' }));

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe('session_expired');
    const setCookieHeader = response.headers.get('set-cookie');
    expect(setCookieHeader).toBeTruthy();
    const cookiePattern = new RegExp(`${SESSION_COOKIE_NAME}=;`);
    expect(setCookieHeader).toMatch(cookiePattern);
    expect(setCookieHeader).toMatch(/Max-Age=0/);
  });

  it('enforces role-based access control', async () => {
    verifySessionMock.verifySessionFromRequest.mockResolvedValueOnce({
      user: {
        id: 'sales-1',
        email: 'sales@example.com',
        role: 'SALES',
        permissions: ROLE_PERMISSIONS.SALES,
      },
      token: 'token',
      payload: {
        sub: 'sales-1',
        email: 'sales@example.com',
        role: 'SALES',
        iss: 'ordex',
        aud: 'ordex-app',
        iat: Date.now() / 1000,
        exp: Date.now() / 1000 + 3600,
      },
    });

    const handler = withAuth(async () => Response.json({ ok: true }), { roles: ['ADMIN'] });
    const response = await handler(buildRequest('http://localhost/api/admin', { method: 'GET' }));

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.success).toBe(false);
  });
});
