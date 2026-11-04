import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe('active authentication runtime configuration', () => {
  it('boots with the session signing key without requiring unused legacy JWT keys', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DATABASE_URL', 'postgresql://synthetic@localhost/retzef_test');
    vi.stubEnv('AUTH_JWT_SECRET', 'synthetic-active-session-key-at-least-thirty-two-characters');
    vi.stubEnv('JWT_SECRET', undefined);
    vi.stubEnv('JWT_REFRESH_SECRET', undefined);
    vi.stubEnv('SKIP_ENV_VALIDATION', undefined);
    const environment = await import('@/lib/envConfig');
    expect(environment.isProduction).toBe(true);
  });
  it('rejects a missing active session signing key in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DATABASE_URL', 'postgresql://synthetic@localhost/retzef_test');
    vi.stubEnv('AUTH_JWT_SECRET', undefined);
    vi.stubEnv('SKIP_ENV_VALIDATION', undefined);
    await expect(import('@/lib/envConfig')).rejects.toThrow('AUTH_JWT_SECRET');
  });
});
