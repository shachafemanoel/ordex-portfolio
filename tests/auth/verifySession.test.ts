import { TokenExpiredError } from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthenticationError, SessionExpiredError } from '@/lib/auth/errors';
import { getCurrentUser, verifySession, verifySessionFromRequest } from '@/lib/auth/verifySession';

const fallbackUser = {
  id: 'user-1',
  email: 'admin@ordex.local',
  name: 'Ordex Admin',
  role: 'ADMIN' as const,
  permissions: [],
};

const mockGetTokenFromRequest = vi.fn();
const mockGetFallbackUser = vi.fn();
const mockIsFallbackEnabled = vi.fn();
const mockCookies = vi.fn();
const mockClearExpiredSessionCookie = vi.fn();
const verifySessionTokenMock = vi.fn();

vi.mock('@/lib/auth/cookies', () => ({
  FALLBACK_BLOCK_COOKIE: 'ordex-no-fallback',
  getTokenFromRequest: (req: any) => mockGetTokenFromRequest(req),
  getSessionCookie: vi.fn(),
}));

vi.mock('@/lib/auth/fallback', () => ({
  getFallbackUser: () => mockGetFallbackUser(),
  isFallbackEnabled: () => mockIsFallbackEnabled(),
}));

vi.mock('@/lib/auth/user.server', () => ({
  findSessionUserById: vi.fn(),
}));

vi.mock('@/lib/auth/tokens', () => ({
  verifySessionToken: (...args: any[]) => verifySessionTokenMock(...args),
}));

vi.mock('@/lib/auth/sessionActions', () => ({
  clearExpiredSessionCookie: () => mockClearExpiredSessionCookie(),
}));

vi.mock('next/headers', () => ({
  cookies: () => mockCookies(),
}));

vi.mock('@/lib/featureFlags', () => ({
  isDemo: () => false,
}));

vi.mock('@/lib/auth/config', () => ({
  SESSION_COOKIE_NAME: 'ordex.sid',
}));

const mockRequest = {
  cookies: { get: () => undefined },
  headers: { get: () => null },
};

describe('verifySession auth fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTokenFromRequest.mockReturnValue(null);
    mockGetFallbackUser.mockResolvedValue(fallbackUser);
    mockIsFallbackEnabled.mockReturnValue(true);
    mockCookies.mockReturnValue({
      get: () => undefined,
    });
    verifySessionTokenMock.mockReset();
  });

  it('returns fallback user for request verification when no token exists and fallback is enabled', async () => {
    const session = await verifySessionFromRequest({
      cookies: { get: () => undefined },
      headers: { get: () => undefined },
    } as any);
    expect(session.user).toEqual(fallbackUser);
    expect(session.token).toBe('fallback-admin');
    expect(session.payload.sub).toBe(fallbackUser.id);
  });

  it('throws AuthenticationError for request verification when no token exists and fallback is disabled', async () => {
    mockIsFallbackEnabled.mockReturnValue(false);
    await expect(
      verifySessionFromRequest({
        cookies: { get: () => undefined },
        headers: { get: () => undefined },
      } as any)
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('returns fallback user for server verification when no session cookie and fallback is enabled', async () => {
    const session = await verifySession();
    expect(session.user).toEqual(fallbackUser);
    expect(session.token).toBe('fallback-admin');
  });

  it('throws AuthenticationError for server verification when no session cookie and fallback is disabled', async () => {
    mockIsFallbackEnabled.mockReturnValue(false);
    await expect(verifySession()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('throws AuthenticationError when fallback user is unavailable', async () => {
    mockGetFallbackUser.mockResolvedValueOnce(null);
    await expect(
      verifySessionFromRequest({
        cookies: { get: () => undefined },
        headers: { get: () => undefined },
      } as any)
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('throws SessionExpiredError when request token has expired', async () => {
    mockGetTokenFromRequest.mockReturnValueOnce('expired-token');
    verifySessionTokenMock.mockImplementationOnce(() => {
      throw new TokenExpiredError('jwt expired', new Date());
    });

    await expect(
      verifySessionFromRequest({
        cookies: { get: () => undefined },
        headers: { get: () => undefined },
      } as any)
    ).rejects.toBeInstanceOf(SessionExpiredError);
  });

  it('throws SessionExpiredError when cookie token has expired', async () => {
    const deleteCookie = vi.fn();
    mockCookies.mockReturnValue({
      get: () => ({ value: 'expired-cookie-token' }),
      delete: deleteCookie,
    });
    verifySessionTokenMock.mockImplementationOnce(() => {
      throw new TokenExpiredError('jwt expired', new Date());
    });

    await expect(verifySession()).rejects.toBeInstanceOf(SessionExpiredError);
  });

  it('returns null when getCurrentUser encounters expiration', async () => {
    mockCookies.mockReturnValue({
      get: () => ({ value: 'expired-cookie-token' }),
    });
    verifySessionTokenMock.mockImplementationOnce(() => {
      throw new TokenExpiredError('jwt expired', new Date());
    });

    const user = await getCurrentUser();

    expect(user).toBeNull();
  });
});
