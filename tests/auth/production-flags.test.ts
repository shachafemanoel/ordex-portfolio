import { afterEach, describe, expect, it, vi } from 'vitest';
import { isDemo } from '@/lib/featureFlags';
import { isFallbackEnabled } from '@/lib/auth/fallback';

afterEach(() => vi.unstubAllEnvs());

describe('production authentication flags', () => {
  it.each(['production', 'prod', 'live'])('does not allow demo in APP_ENV=%s', (appEnv) => {
    vi.stubEnv('APP_ENV', appEnv);
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('DEMO_MODE', 'true');
    vi.stubEnv('AUTH_FALLBACK_ENABLED', 'true');
    expect(isDemo()).toBe(false);
    expect(isFallbackEnabled()).toBe(false);
  });

  it('does not let APP_ENV override a production NODE_ENV', () => {
    vi.stubEnv('APP_ENV', 'development');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('DEMO_MODE', 'true');
    vi.stubEnv('AUTH_FALLBACK_ENABLED', 'true');
    expect(isDemo()).toBe(false);
    expect(isFallbackEnabled()).toBe(false);
  });
});
