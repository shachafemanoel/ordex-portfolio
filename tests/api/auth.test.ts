import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POST as loginHandler } from '@/app/api/auth/login/route';
import { POST as registerHandler } from '@/app/api/auth/register/route';
import { GET as meHandler } from '@/app/api/auth/me/route';

process.env.VITEST = 'true';
process.env.NODE_ENV = 'test';
process.env.BCRYPT_ROUNDS = '1'; // Use minimal rounds for faster tests

const prismaMocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

const startupMock = vi.hoisted(() => ({
  ensureInitialized: vi.fn().mockResolvedValue(undefined),
  shouldRunStartupInit: vi.fn(() => false),
}));

vi.mock('@/lib/db', () => ({
  withIdentityDatabase: (fn: any) => fn({ user: { findUnique: prismaMocks.findUnique } }),
  prisma: {
    user: {
      findUnique: prismaMocks.findUnique,
      create: prismaMocks.create,
      update: prismaMocks.update,
    },
  },
}));

vi.mock('@/lib/db/user-role-compat', () => ({ ensureUserRoleEnumCompatibility: vi.fn() }));
vi.mock('@/lib/app-startup', () => startupMock);

vi.mock('@/lib/auth/config', () => ({
  SESSION_COOKIE_NAME: 'ordex.sid',
  authConfig: {
    jwtSecret: 'test-secret-32-characters-long-value',
    jwtIssuer: 'ordex',
    jwtAudience: 'ordex-app',
    sessionMaxAge: 3600,
    rememberMaxAge: 1209600,
  },
}));

const verifySessionMock = vi.hoisted(() => ({
  verifySessionFromRequest: vi.fn(),
}));

vi.mock('@/lib/auth/verifySession', () => verifySessionMock);

// Mock rate limiter to pass through without actual rate limiting
vi.mock('@/lib/rate-limit', () => ({
  withRateLimit: vi.fn((_config, handler) => handler),
  authRateLimit: {},
  RateLimitPresets: {},
}));

const authMocks = vi.hoisted(() => ({
  getUserByEmail: vi.fn(),
  createUser: vi.fn(),
}));

// Partially mock auth helpers so we can stub register/me behaviour while preserving hashing utilities
vi.mock('@/lib/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');

  return {
    ...actual,
    getUserByEmail: authMocks.getUserByEmail,
    createUser: authMocks.createUser,
  };
});

const findUnique = prismaMocks.findUnique;
const getUserByEmailMock = authMocks.getUserByEmail;
const createUserMock = authMocks.createUser;

import { hashPassword } from '@/lib/auth';
import { ROLE_PERMISSIONS } from '@/lib/auth/types';

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

describe('Authentication API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AUTH_JWT_SECRET = 'test-secret-32-characters-long-value';
    // The mocked identity lookup covers the single-business path; tenant lookups are tested against the database.
    delete process.env.TENANT_ENFORCEMENT;
  });

  describe('POST /api/auth/login', () => {
    it('returns a session token for valid credentials', { timeout: 60000 }, async () => {
      const passwordHash = await hashPassword('StrongPass123');

      findUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'sales@example.com',
        name: 'Sally Sales',
        role: 'OPERATIONS',
        password: passwordHash,
        isActive: true,
      });

      const request = buildRequest('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'sales@example.com', password: 'StrongPass123' }),
      });

      const response = await loginHandler(request);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.user).toMatchObject({
        id: 'user-1',
        email: 'sales@example.com',
        role: { key: 'OPERATIONS', label: 'עובד כללי' },
      });
      expect(response.cookies.get('ordex.sid')?.value).toBeDefined();
    });

    it('rejects invalid credentials', async () => {
      const passwordHash = await hashPassword('StrongPass123');

      findUnique.mockResolvedValueOnce({
        id: 'user-1',
        email: 'sales@example.com',
        name: 'Sally Sales',
        role: 'OPERATIONS',
        password: passwordHash,
        isActive: true,
      });

      const request = buildRequest('http://localhost/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'sales@example.com', password: 'WrongPassword' }),
      });

      const response = await loginHandler(request);
      expect(response.status).toBe(400);
      const body = await response.json();
      expect(body.success).toBe(false);
    });
  });

  describe('POST /api/auth/register', () => {
    it('allows admins to register new users', async () => {
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
      getUserByEmailMock.mockResolvedValueOnce(null);
      createUserMock.mockImplementationOnce(async ({ email, name, role }) => ({
        id: 'new-user',
        email,
        name,
        role,
        permissions: ROLE_PERMISSIONS[role],
      }));

      const request = buildRequest('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Pat Purchasing',
          email: 'purchasing@example.com',
          password: 'SecurePass456',
          role: 'OPERATIONS',
        }),
      });

      const response = await registerHandler(request);
      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data.user).toMatchObject({
        id: 'new-user',
        email: 'purchasing@example.com',
        role: { key: 'OPERATIONS', label: 'עובד כללי' },
      });
      expect(createUserMock).toHaveBeenCalledWith({
        name: 'Pat Purchasing',
        email: 'purchasing@example.com',
        password: 'SecurePass456',
        role: 'OPERATIONS',
      });
    });

    it('prevents duplicate registrations', async () => {
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
      getUserByEmailMock.mockResolvedValueOnce({
        id: 'existing-user',
        email: 'purchasing@example.com',
        role: 'OPERATIONS',
        permissions: ROLE_PERMISSIONS.PURCHASING,
      });

      const request = buildRequest('http://localhost/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Pat Purchasing',
          email: 'purchasing@example.com',
          password: 'SecurePass456',
          role: 'OPERATIONS',
        }),
      });

      const response = await registerHandler(request);
      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.success).toBe(false);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns the authenticated user profile', async () => {
      verifySessionMock.verifySessionFromRequest.mockResolvedValueOnce({
        user: {
          id: 'sales-1',
          email: 'sales@example.com',
          name: 'Sally Sales',
          role: 'OPERATIONS',
          permissions: ROLE_PERMISSIONS.OPERATIONS,
        },
        token: 'token',
        payload: {
          sub: 'sales-1',
          email: 'sales@example.com',
          role: 'OPERATIONS',
          iss: 'ordex',
          aud: 'ordex-app',
          iat: Date.now() / 1000,
          exp: Date.now() / 1000 + 3600,
        },
      });

      const request = buildRequest('http://localhost/api/auth/me', {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      const response = await meHandler(request);
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.success).toBe(true);
      expect(body.data).toMatchObject({
        id: 'sales-1',
        email: 'sales@example.com',
        role: { key: 'OPERATIONS', label: 'עובד כללי' },
      });
    });
  });
});
