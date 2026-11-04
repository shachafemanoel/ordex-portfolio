import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as loginHandler } from '@/app/api/auth/login/route';

// Mocks
const authMocks = vi.hoisted(() => ({
  authenticateUser: vi.fn(),
  setSessionCookie: vi.fn(),
}));

vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
  return {
    ...actual,
    authenticateUser: authMocks.authenticateUser,
    setSessionCookie: authMocks.setSessionCookie,
  };
});

// Mock dependencies
vi.mock('@/lib/api-middleware', () => ({
  ValidationError: class extends Error {},
  handleApiError: (err: any) => new Response(JSON.stringify({ error: err.message }), { status: 400 }),
}));

vi.mock('@/lib/app-startup', () => ({
  ensureInitialized: vi.fn().mockResolvedValue(undefined),
  shouldRunStartupInit: vi.fn(() => false),
}));

vi.mock('@/lib/auth/normalization', () => ({
  normalizeEmail: (e: string) => e.toLowerCase(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/rate-limit', () => ({
  withRateLimit: (_: any, handler: any) => handler,
  authRateLimit: {},
}));

const buildRequest = (body: any) => {
  return {
    json: async () => body,
  } as unknown as NextRequest;
};

describe('Auth Expiration Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses short-lived token when rememberMe is false', async () => {
    authMocks.authenticateUser.mockResolvedValue({
      user: { id: '1', email: 'test@example.com', role: 'USER', permissions: [] },
      token: 'short-lived-token',
      refreshToken: 'long-lived-token',
    });

    const request = buildRequest({
      email: 'test@example.com',
      password: 'password',
      rememberMe: false,
    });

    await loginHandler(request);

    expect(authMocks.setSessionCookie).toHaveBeenCalledWith(
      expect.anything(),
      'short-lived-token', // Expect SHORT lived
      false
    );
  });

  it('uses long-lived token (refreshToken) when rememberMe is true', async () => {
    authMocks.authenticateUser.mockResolvedValue({
      user: { id: '1', email: 'test@example.com', role: 'USER', permissions: [] },
      token: 'short-lived-token',
      refreshToken: 'long-lived-token',
    });

    const request = buildRequest({
      email: 'test@example.com',
      password: 'password',
      rememberMe: true,
    });

    await loginHandler(request);

    expect(authMocks.setSessionCookie).toHaveBeenCalledWith(
      expect.anything(),
      'long-lived-token', // Expect LONG lived
      true
    );
  });
});
