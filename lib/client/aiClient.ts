/**
 * Centralized AI Client
 *
 * Features:
 * - Persists cacheId per "screen + entityId" in sessionStorage
 * - Deduplicates in-flight identical requests
 * - Debounces text input triggers (configurable)
 * - Stale-while-revalidate: shows cached result immediately then refreshes
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AIRequestOptions {
  /** Route path (e.g., '/api/ai/analyze-dashboard') */
  route: string;
  /** HTTP method (default: 'GET') */
  method?: 'GET' | 'POST';
  /** Request body for POST requests */
  body?: Record<string, unknown>;
  /** Cache key (screen + entityId, e.g., 'dashboard' or 'order:123') */
  cacheKey?: string;
  /** Skip cache and force refresh */
  forceRefresh?: boolean;
  /** Debounce delay in ms (for text inputs) */
  debounceMs?: number;
}

export interface AIResponse<T = unknown> {
  ok: boolean;
  data?: T;
  cacheId?: string | null;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  error?: { code: string; message: string };
  /** Metadata for UI */
  _meta?: {
    fromCache: boolean;
    lastUpdated: string;
    tokensUsed?: number;
  };
}

export interface CachedResult<T = unknown> {
  data: T;
  cacheId: string | null;
  timestamp: string;
  tokensUsed?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Storage Keys
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_PREFIX = 'ai_cache:';
const CACHE_ID_PREFIX = 'ai_cacheId:';

function getCacheKey(cacheKey: string, route: string): string {
  return `${CACHE_PREFIX}${cacheKey}:${route}`;
}

function getCacheIdKey(cacheKey: string, route: string): string {
  return `${CACHE_ID_PREFIX}${cacheKey}:${route}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// In-Flight Deduplication
// ─────────────────────────────────────────────────────────────────────────────

const inFlightRequests = new Map<string, Promise<AIResponse<unknown>>>();

function getRequestKey(route: string, method: string, body?: Record<string, unknown>): string {
  return `${method}:${route}:${body ? JSON.stringify(body) : ''}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Debounce Registry
// ─────────────────────────────────────────────────────────────────────────────

const debounceTimers = new Map<string, NodeJS.Timeout>();

function debounce<T>(key: string, fn: () => Promise<T>, delayMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const existing = debounceTimers.get(key);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(async () => {
      debounceTimers.delete(key);
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }, delayMs);

    debounceTimers.set(key, timer);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getFromSessionStorage<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const item = sessionStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch {
    return null;
  }
}

function setToSessionStorage(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // Storage full or not available
    console.warn('[aiClient] Failed to store in sessionStorage:', e);
  }
}

function getCachedResult<T>(cacheKey: string, route: string): CachedResult<T> | null {
  return getFromSessionStorage<CachedResult<T>>(getCacheKey(cacheKey, route));
}

function setCachedResult<T>(cacheKey: string, route: string, result: CachedResult<T>): void {
  setToSessionStorage(getCacheKey(cacheKey, route), result);
}

function getStoredCacheId(cacheKey: string, route: string): string | null {
  return getFromSessionStorage<string>(getCacheIdKey(cacheKey, route));
}

function setStoredCacheId(cacheKey: string, route: string, cacheId: string): void {
  setToSessionStorage(getCacheIdKey(cacheKey, route), cacheId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Request Function
// ─────────────────────────────────────────────────────────────────────────────

async function executeRequest<T>(options: AIRequestOptions): Promise<AIResponse<T>> {
  const { route, method = 'GET', body, cacheKey, forceRefresh = false } = options;

  // Build URL with cacheId if available
  let url = route;
  const storedCacheId = cacheKey ? getStoredCacheId(cacheKey, route) : null;

  if (method === 'GET' && storedCacheId && !forceRefresh) {
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}cacheId=${encodeURIComponent(storedCacheId)}`;
  }

  const requestInit: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (method === 'POST' && body) {
    const bodyWithCacheId =
      storedCacheId && !forceRefresh ? { ...body, cacheId: storedCacheId } : body;
    requestInit.body = JSON.stringify(bodyWithCacheId);
  }

  let result: Response;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    result = await fetch(url, { ...requestInit, signal: controller.signal });
    clearTimeout(timeout);
  } catch (err: any) {
    return {
      ok: false,
      error: { code: 'FETCH_ERROR', message: err?.message || 'Network error' },
    };
  }

  if (!result.ok) {
    return {
      ok: false,
      error: { code: 'FETCH_ERROR', message: `HTTP ${result.status}` },
    };
  }

  const data = await result.json().catch(() => null);

  // Handle standardized response format { ok, data, cacheId, usage }
  if (data && typeof data === 'object' && 'ok' in data) {
    const aiResult = data as AIResponse<T>;

    // Store cacheId for future requests
    if (aiResult.cacheId && cacheKey) {
      setStoredCacheId(cacheKey, route, aiResult.cacheId);
    }

    // Cache the result
    if (aiResult.ok && aiResult.data && cacheKey) {
      setCachedResult<T>(cacheKey, route, {
        data: aiResult.data,
        cacheId: aiResult.cacheId ?? null,
        timestamp: new Date().toISOString(),
        tokensUsed: aiResult.usage?.totalTokens,
      });
    }

    return {
      ...aiResult,
      _meta: {
        fromCache: false,
        lastUpdated: new Date().toISOString(),
        tokensUsed: aiResult.usage?.totalTokens,
      },
    };
  }

  // Legacy response format (direct data)
  return {
    ok: true,
    data: data as T,
    _meta: {
      fromCache: false,
      lastUpdated: new Date().toISOString(),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Make an AI API request with caching, deduplication, and optional debouncing
 */
export async function aiRequest<T = unknown>(options: AIRequestOptions): Promise<AIResponse<T>> {
  const { route, method = 'GET', body, cacheKey, forceRefresh = false, debounceMs } = options;

  // Debounce if specified
  if (debounceMs && debounceMs > 0 && cacheKey) {
    return debounce(
      `debounce:${cacheKey}:${route}`,
      () => aiRequest<T>({ ...options, debounceMs: undefined }),
      debounceMs
    );
  }

  // Check for in-flight duplicate
  const requestKey = getRequestKey(route, method, body);
  const inFlight = inFlightRequests.get(requestKey);
  if (inFlight && !forceRefresh) {
    return inFlight as Promise<AIResponse<T>>;
  }

  // Return cached result immediately if available (stale-while-revalidate)
  if (cacheKey && !forceRefresh) {
    const cached = getCachedResult<T>(cacheKey, route);
    if (cached) {
      // Return cached immediately, then refresh in background
      const cachedResponse: AIResponse<T> = {
        ok: true,
        data: cached.data,
        cacheId: cached.cacheId,
        _meta: {
          fromCache: true,
          lastUpdated: cached.timestamp,
          tokensUsed: cached.tokensUsed,
        },
      };

      // Background refresh (fire and forget)
      executeRequest<T>({ ...options, forceRefresh: true }).catch(console.warn);

      return cachedResponse;
    }
  }

  // Execute request with deduplication
  const request = executeRequest<T>(options);
  inFlightRequests.set(requestKey, request as Promise<AIResponse<unknown>>);

  try {
    return await request;
  } finally {
    inFlightRequests.delete(requestKey);
  }
}

/**
 * Make a GET request to an AI endpoint
 */
export function aiGet<T = unknown>(
  route: string,
  options?: Omit<AIRequestOptions, 'route' | 'method'>
): Promise<AIResponse<T>> {
  return aiRequest<T>({ ...options, route, method: 'GET' });
}

/**
 * Make a POST request to an AI endpoint
 */
export function aiPost<T = unknown>(
  route: string,
  body: Record<string, unknown>,
  options?: Omit<AIRequestOptions, 'route' | 'method' | 'body'>
): Promise<AIResponse<T>> {
  return aiRequest<T>({ ...options, route, method: 'POST', body });
}

/**
 * Clear cached data for a specific route
 */
export function clearAICache(cacheKey: string, route?: string): void {
  if (typeof window === 'undefined') return;

  if (route) {
    sessionStorage.removeItem(getCacheKey(cacheKey, route));
    sessionStorage.removeItem(getCacheIdKey(cacheKey, route));
  } else {
    // Clear all cache for this key
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (
        key &&
        (key.startsWith(`${CACHE_PREFIX}${cacheKey}:`) ||
          key.startsWith(`${CACHE_ID_PREFIX}${cacheKey}:`))
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => sessionStorage.removeItem(key));
  }
}

/**
 * Get cached metadata without making a request
 */
export function getAICacheInfo(
  cacheKey: string,
  route: string
): { lastUpdated: string; tokensUsed?: number } | null {
  const cached = getCachedResult(cacheKey, route);
  if (!cached) return null;

  return {
    lastUpdated: cached.timestamp,
    tokensUsed: cached.tokensUsed,
  };
}

/**
 * Check if a cached result exists
 */
export function hasAICache(cacheKey: string, route: string): boolean {
  return getCachedResult(cacheKey, route) !== null;
}

// ─────────────────────────────────────────────────────────────────────────────
// React Hook
// ─────────────────────────────────────────────────────────────────────────────

/**
 * React hook for AI requests with automatic state management
 */
export function useAIRequest<T = unknown>(
  options: AIRequestOptions & {
    /** Auto-fetch on mount (default: false for expensive panels) */
    autoFetch?: boolean;
    /** Callback when data changes */
    onData?: (data: T) => void;
  }
) {
  // This is a placeholder - will be implemented when updating components
  // For now, components should use aiRequest directly
  throw new Error('useAIRequest not yet implemented - use aiRequest directly');
}
