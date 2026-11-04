import type { AuthenticatedUser } from '@/lib/auth/types';
import { getDefaultAdminEmail } from '@/lib/auth/defaults';
import { ensureDefaultAdminUser } from '@/lib/auth/default-admin';
import { findSessionUserByEmail } from '@/lib/auth/user.server';
import { isDemo } from '@/lib/featureFlags';

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on', 'enabled']);

export function isFallbackEnabled(): boolean {
  if (typeof process === 'undefined') {
    return false; // SECURITY: Disabled by default on client
  }

  // Explicit check for production environment
  const nodeEnv = (process.env.NODE_ENV || '').trim().toLowerCase();
  const appEnv = (process.env.APP_ENV || '').trim().toLowerCase();
  const productionNames = new Set(['production', 'prod', 'live']);
  const isProduction = productionNames.has(nodeEnv) || productionNames.has(appEnv);

  if (isProduction) {
    // Production never permits fallback authentication.
    return false;
  }

  // In non-production, check for explicit disabling via AUTH_REQUIRE_SESSION
  const requireSession = process.env.AUTH_REQUIRE_SESSION;
  if (requireSession && TRUE_VALUES.has(requireSession.trim().toLowerCase())) {
    return false;
  }

  // In non-production, fallback can be enabled via AUTH_FALLBACK_ENABLED
  const flag = process.env.AUTH_FALLBACK_ENABLED;
  if (!flag) {
    return false; // SECURITY FIX: Default to disabled instead of enabled
  }

  return TRUE_VALUES.has(flag.trim().toLowerCase());
}

function buildCacheKey(email: string) {
  return `fallback:${email}`;
}

const fallbackCache = new Map<string, { user: AuthenticatedUser; ts: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCachedFallback(email: string): AuthenticatedUser | null {
  const key = buildCacheKey(email);
  const entry = fallbackCache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    fallbackCache.delete(key);
    return null;
  }

  return entry.user;
}

function setCachedFallback(email: string, user: AuthenticatedUser) {
  const key = buildCacheKey(email);
  fallbackCache.set(key, { user, ts: Date.now() });
}

export async function getFallbackUser(): Promise<AuthenticatedUser | null> {
  const fallbackAllowed = isFallbackEnabled() || isDemo();
  if (!fallbackAllowed) {
    return null;
  }

  const email = getDefaultAdminEmail();

  const cached = getCachedFallback(email);
  if (cached) {
    return cached;
  }

  try {
    let user = await findSessionUserByEmail(email);
    if (!user) {
      await ensureDefaultAdminUser();
      user = await findSessionUserByEmail(email);
    }

    if (user) {
      setCachedFallback(email, user);
    }

    return user ?? null;
  } catch (error) {
    console.warn('Auth fallback failed to resolve default admin user', error);
    return null;
  }
}
