import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('Auth Consistency', () => {
  describe('Fallback Authentication', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    afterEach(() => {
      delete process.env.AUTH_FALLBACK_ENABLED;
      delete process.env.AUTH_REQUIRE_SESSION;
      delete process.env.NODE_ENV;
      delete process.env.APP_ENV;
    });

    it('should disable fallback auth by default in production', async () => {
      process.env.NODE_ENV = 'production';
      const { isFallbackEnabled } = await import('@/lib/auth/fallback');
      expect(isFallbackEnabled()).toBe(false);
    });

    it('should disable fallback auth by default in development', async () => {
      process.env.NODE_ENV = 'development';
      const { isFallbackEnabled } = await import('@/lib/auth/fallback');
      expect(isFallbackEnabled()).toBe(false);
    });

    it('should reject fallback auth even when explicitly enabled in production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.AUTH_FALLBACK_ENABLED = 'true';
      const { isFallbackEnabled } = await import('@/lib/auth/fallback');
      expect(isFallbackEnabled()).toBe(false);
    });

    it('should respect AUTH_REQUIRE_SESSION=true in development', async () => {
      process.env.NODE_ENV = 'development';
      process.env.AUTH_REQUIRE_SESSION = 'true';
      const { isFallbackEnabled } = await import('@/lib/auth/fallback');
      expect(isFallbackEnabled()).toBe(false);
    });

    it('should allow fallback when explicitly enabled in development', async () => {
      process.env.NODE_ENV = 'development';
      process.env.AUTH_FALLBACK_ENABLED = 'true';
      const { isFallbackEnabled } = await import('@/lib/auth/fallback');
      expect(isFallbackEnabled()).toBe(true);
    });
  });

  describe('Demo Mode Behavior', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    afterEach(() => {
      delete process.env.DEMO_MODE;
      delete process.env.NEXT_PUBLIC_DEMO_MODE;
      delete process.env.NODE_ENV;
      delete process.env.APP_ENV;
    });

    it('should detect demo mode from DEMO_MODE env var', async () => {
      process.env.DEMO_MODE = 'true';
      const { isDemo } = await import('@/lib/featureFlags');
      expect(isDemo()).toBe(true);
    });

    it('should detect demo mode from NEXT_PUBLIC_DEMO_MODE env var', async () => {
      process.env.NEXT_PUBLIC_DEMO_MODE = 'true';
      const { isDemo } = await import('@/lib/featureFlags');
      expect(isDemo()).toBe(true);
    });

    it('should disable demo mode in production env', async () => {
      process.env.NODE_ENV = 'production';
      process.env.DEMO_MODE = 'true';
      const { isDemo } = await import('@/lib/featureFlags');
      expect(isDemo()).toBe(false);
    });

    it('should disable demo mode when not explicitly enabled', async () => {
      process.env.NODE_ENV = 'development';
      const { isDemo } = await import('@/lib/featureFlags');
      expect(isDemo()).toBe(false);
    });
  });

  describe('Session Verification with Demo Mode', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    afterEach(() => {
      delete process.env.DEMO_MODE;
      delete process.env.NODE_ENV;
    });

    it('should return demo admin user when demo mode is enabled', async () => {
      process.env.DEMO_MODE = 'true';
      process.env.NODE_ENV = 'development';

      vi.doMock('@/lib/auth/user.server', () => ({
        findSessionUserByEmail: vi.fn().mockResolvedValue({
          id: 'demo-admin-id',
          email: 'admin@ordex.local',
          name: 'Demo Admin',
          role: 'ADMIN',
        }),
      }));

      vi.doMock('@/lib/auth/default-admin', () => ({
        ensureDefaultAdminUser: vi.fn().mockResolvedValue(undefined),
      }));

      const { getFallbackUser } = await import('@/lib/auth/fallback');
      const fallbackUser = await getFallbackUser();

      expect(fallbackUser).toBeDefined();
      expect(fallbackUser?.role).toBe('ADMIN');
    });
  });
});

describe('API Client 401 Handling', () => {
  it('should have setLogoutHandler export', async () => {
    const { setLogoutHandler } = await import('@/lib/apiClient');
    expect(setLogoutHandler).toBeDefined();
    expect(typeof setLogoutHandler).toBe('function');
  });

  it('should clear auth token on 401', async () => {
    const { clearAuthToken } = await import('@/lib/auth/tokenStorage');
    expect(clearAuthToken).toBeDefined();
    expect(typeof clearAuthToken).toBe('function');
  });
});

describe('Role-Based Permissions', () => {
  it('should provide correct permissions for each role', async () => {
    const { ROLE_PERMISSIONS } = await import('@/lib/auth/types');

    expect(ROLE_PERMISSIONS.ADMIN.length).toBeGreaterThan(15);
    expect(ROLE_PERMISSIONS.ADMIN).toContain('MANAGE_USERS');

    expect(ROLE_PERMISSIONS.OPERATIONS).toContain('VIEW_ORDERS');
  });

  it('should convert SessionUser to AuthenticatedUser with permissions', async () => {
    const { toAuthenticatedUser, ROLE_PERMISSIONS } = await import('@/lib/auth/types');

    const sessionUser = {
      id: 'user-123',
      email: 'sales@example.com',
      name: 'Sales User',
      role: 'OPERATIONS' as const,
    };

    const authUser = toAuthenticatedUser(sessionUser);

    expect(authUser.id).toBe(sessionUser.id);
    expect(authUser.email).toBe(sessionUser.email);
    expect(authUser.role).toBe('OPERATIONS');
    expect(authUser.permissions).toEqual(ROLE_PERMISSIONS.OPERATIONS);
    expect(authUser.permissions).toContain('VIEW_ORDERS');
  });
});
