/**
 * Feature flag helpers for server-side configuration.
 *
 * Feature flags are controlled via environment variables and read on the server only.
 * We treat values of "true", "1", and "on" (case insensitive) as enabled.
 */

export const FeatureFlags = {
  UNIFIED_STATUS_ENGINE: 'FF_UNIFIED_STATUS_ENGINE',
  WOO_NEW_STACK: 'FF_WOO_NEW_STACK',
  USE_MOBILE_PRODUCT_CARD: 'FF_USE_MOBILE_PRODUCT_CARD',
  MOBILE_UI_V2: 'FF_MOBILE_UI_V2',
  // Legacy aliases kept for backward compatibility in older UI/debug pages.
  USE_MOBILE_UI: 'FF_MOBILE_UI_V2',
  USE_MOBILE_BOTTOM_NAV: 'FF_MOBILE_UI_V2',
  ENABLE_AI_RISK_ASSESSMENT: 'ENABLE_AI_RISK_ASSESSMENT',
  ENABLE_AI_FINANCIAL_ADVICE: 'ENABLE_AI_FINANCIAL_ADVICE',
} as const;

export type FeatureFlag = (typeof FeatureFlags)[keyof typeof FeatureFlags];

export function isAIFeatureEnabled(feature: 'RISK' | 'FINANCIAL'): boolean {
  const flagName =
    feature === 'RISK'
      ? FeatureFlags.ENABLE_AI_RISK_ASSESSMENT
      : FeatureFlags.ENABLE_AI_FINANCIAL_ADVICE;
  return isFeatureEnabled(flagName, false);
}

const TRUE_VALUES = new Set(['true', '1', 'on', 'enabled', 'yes']);
const PRODUCTION_ENV_VALUES = new Set(['production', 'prod', 'live']);

/**
 * Checks if the provided feature flag is enabled.
 */
export function isFeatureEnabled(flag: FeatureFlag, defaultValue = false): boolean {
  const raw = process.env[flag];
  if (!raw) {
    return defaultValue;
  }

  return TRUE_VALUES.has(raw.trim().toLowerCase());
}

/**
 * Convenience helper that ensures flags are only evaluated on the server runtime.
 * Throws if accessed during build-time to avoid leaking to the client bundle.
 */
export function assertServerSideFlag(flag: FeatureFlag, defaultValue = false): boolean {
  if (typeof window !== 'undefined') {
    throw new Error(`Feature flag ${flag} accessed on client runtime`);
  }
  return isFeatureEnabled(flag, defaultValue);
}

/**
 * Check if the application is running in demo mode.
 * Demo mode disables authentication and uses pre-populated demo data.
 */
export function isDemo(): boolean {
  const runtimeEnvs = [process.env.APP_ENV, process.env.NODE_ENV];
  if (runtimeEnvs.some((value) => PRODUCTION_ENV_VALUES.has((value || '').trim().toLowerCase()))) {
    return false;
  }

  const demoMode = process.env.DEMO_MODE || process.env.NEXT_PUBLIC_DEMO_MODE;
  return TRUE_VALUES.has(
    String(demoMode || '')
      .trim()
      .toLowerCase()
  );
}

/**
 * Check if Redis order cache is enabled.
 * When enabled, orders are cached in Redis for faster retrieval.
 */
export function useRedisOrderCache(): boolean {
  const cacheEnabled = process.env.REDIS_ORDER_CACHE || process.env.USE_REDIS_ORDER_CACHE;
  // Default to true if not explicitly disabled
  if (!cacheEnabled) {
    return true;
  }
  return TRUE_VALUES.has(String(cacheEnabled).trim().toLowerCase());
}
