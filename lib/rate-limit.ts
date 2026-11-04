import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { withIdentityDatabase } from '@/lib/db';
import { isTenantRuntime } from '@/lib/tenancy/context';
import { CacheManager } from '@/lib/cache';

// Rate limit configuration
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum requests per window
  message?: string;
  statusCode?: number;
  keyGenerator?: (req: NextRequest) => string;
  skip?: (req: NextRequest) => boolean | Promise<boolean>;
  onLimitReached?: (req: NextRequest, key: string) => void | Promise<void>;
}

// Default configurations for different endpoint types
export const rateLimitConfigs = {
  // General API endpoints
  default: {
    windowMs: 60 * 1000, // 1 minute
    max: process.env.NODE_ENV === 'development' ? 1000 : 100, // High limit for dev, 100 requests per minute in prod
    message: 'Too many requests from this IP, please try again later.',
    statusCode: 429,
  },

  // Authentication endpoints (more restrictive)
  auth: {
    windowMs: 60 * 1000,
    max: process.env.NODE_ENV === 'development' ? 1000 : 5, // High limit for dev
    message: 'Too many authentication attempts, please try again later.',
    statusCode: 429,
  },

  // Data modification endpoints
  mutation: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
    message: 'Too many modification requests, please slow down.',
    statusCode: 429,
  },

  // Bulk operations
  bulk: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // 10 bulk operations per 5 minutes
    message: 'Too many bulk operations, please wait before trying again.',
    statusCode: 429,
  },

  // External integrations
  integration: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    message: 'Integration rate limit exceeded, please slow down.',
    statusCode: 429,
  },

  // Webhook endpoints (more lenient for external services)
  webhook: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 webhooks per minute
    message: 'Webhook rate limit exceeded.',
    statusCode: 429,
  },

  // Gemini AI endpoints (strict limits for API quota management)
  // Free tier: 15 RPM, 1,500 RPD
  // Using conservative buffer: 10 RPM, 1,400 RPD
  gemini: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // 10 requests per minute (RPM)
    message: 'Gemini AI rate limit exceeded. Free tier allows 10 requests per minute.',
    statusCode: 429,
  },

  // Daily Gemini rate limit (1,400 requests per day with buffer)
  geminiDaily: {
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 1400, // 1,400 requests per day (RPD)
    message: 'Gemini AI daily quota exceeded. Free tier allows 1,400 requests per day.',
    statusCode: 429,
  },
};

// Rate limiter class
export class RateLimiter {
  protected cache: CacheManager;
  protected config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.cache = new CacheManager({
      prefix: 'rate_limit',
      ttl: Math.ceil(config.windowMs / 1000),
      serialize: false,
    });
  }

  getKey(req: NextRequest): string {
    if (this.config.keyGenerator) {
      return this.config.keyGenerator(req);
    }

    // Try to get user identifier from various sources
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded
      ? (forwarded.split(',')[0] || '').trim()
      : req.headers.get('x-real-ip') || req.headers.get('cf-connecting-ip') || 'unknown';

    // Include user agent to differentiate between different clients from same IP
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const userAgentHash = this.hashString(userAgent);

    return `${ip}:${userAgentHash}`;
  }

  protected hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  async check(req: NextRequest): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
    total: number;
  }> {
    // Check if request should be skipped
    if (this.config.skip && (await this.config.skip(req))) {
      return {
        allowed: true,
        remaining: this.config.max,
        resetTime: Date.now() + this.config.windowMs,
        total: this.config.max,
      };
    }

    const key = this.getKey(req);
    // Pre-authentication requests have no business context. Keep their counters in
    // the global PostgreSQL limiter so restarts and separate instances share limits.
    const windowStart = new Date(Math.floor(Date.now() / this.config.windowMs) * this.config.windowMs);
    const current = isTenantRuntime()
      ? (await withIdentityDatabase((db) => db.rateLimitEntry.upsert({
          where: { identifier_endpoint_windowStart: { identifier: createHash('sha256').update(key).digest('hex'), endpoint: req.nextUrl.pathname, windowStart } },
          create: { identifier: createHash('sha256').update(key).digest('hex'), endpoint: req.nextUrl.pathname, windowStart, expiresAt: new Date(windowStart.getTime() + this.config.windowMs) },
          update: { count: { increment: 1 } },
          select: { count: true },
        }))).count
      : (await this.cache.incr(key, Math.ceil(this.config.windowMs / 1000))) || 1;

    const allowed = current <= this.config.max;
    const remaining = Math.max(0, this.config.max - current);
    const resetTime = Date.now() + this.config.windowMs;

    // Call onLimitReached callback if limit exceeded
    if (!allowed && this.config.onLimitReached) {
      await this.config.onLimitReached(req, key);
    }

    return {
      allowed,
      remaining,
      resetTime,
      total: this.config.max,
    };
  }

  async middleware(req: NextRequest): Promise<NextResponse | null> {
    const result = await this.check(req);

    // Add rate limit headers to response
    const headers = new Headers();
    headers.set('X-RateLimit-Limit', this.config.max.toString());
    headers.set('X-RateLimit-Remaining', result.remaining.toString());
    headers.set('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString());

    if (!result.allowed) {
      headers.set('Retry-After', Math.ceil(this.config.windowMs / 1000).toString());

      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: this.config.message || 'Rate limit exceeded',
          },
          retryAfter: Math.ceil(this.config.windowMs / 1000),
        },
        {
          status: this.config.statusCode || 429,
          headers,
        }
      );
    }

    // Store headers to add to successful responses
    (req as any).rateLimitHeaders = headers;
    return null;
  }
}

// Create rate limiter instances
export const defaultRateLimit = new RateLimiter(rateLimitConfigs.default);
export const authRateLimit = new RateLimiter(rateLimitConfigs.auth);
export const mutationRateLimit = new RateLimiter(rateLimitConfigs.mutation);
export const bulkRateLimit = new RateLimiter(rateLimitConfigs.bulk);
export const integrationRateLimit = new RateLimiter(rateLimitConfigs.integration);
export const webhookRateLimit = new RateLimiter(rateLimitConfigs.webhook);
export const geminiRateLimit = new RateLimiter(rateLimitConfigs.gemini);
export const geminiDailyRateLimit = new RateLimiter(rateLimitConfigs.geminiDaily);

// Utility function to create custom rate limiter
export function createRateLimit(config: RateLimitConfig): RateLimiter {
  return new RateLimiter(config);
}

// Higher-order function to wrap API handlers with rate limiting
export function withRateLimit(
  rateLimiter: RateLimiter,
  handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
    // Check rate limit
    const rateLimitResponse = await rateLimiter.middleware(req);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Execute the original handler
    // Next.js 15: params is a Promise. Await it if it exists in the context (last arg).
    const context = args[args.length - 1];
    if (context && context.params && typeof context.params.then === 'function') {
      const resolvedParams = await context.params;
      args[args.length - 1] = { ...context, params: resolvedParams };
    }

    const response = await handler(req, ...args);

    // Add rate limit headers to successful responses
    const rateLimitHeaders = (req as any).rateLimitHeaders;
    if (rateLimitHeaders) {
      rateLimitHeaders.forEach((value: string, key: string) => {
        response.headers.set(key, value);
      });
    }

    return response;
  };
}

// Specialized rate limiters for common use cases
export const withDefaultRateLimit = (handler: any) => withRateLimit(defaultRateLimit, handler);
export const withAuthRateLimit = (handler: any) => withRateLimit(authRateLimit, handler);
export const withMutationRateLimit = (handler: any) => withRateLimit(mutationRateLimit, handler);
export const withBulkRateLimit = (handler: any) => withRateLimit(bulkRateLimit, handler);
export const withIntegrationRateLimit = (handler: any) =>
  withRateLimit(integrationRateLimit, handler);
export const withWebhookRateLimit = (handler: any) => withRateLimit(webhookRateLimit, handler);
export const withGeminiRateLimit = (handler: any) => withRateLimit(geminiRateLimit, handler);

// Progressive rate limiting (stricter limits for repeated violations)
// Note: Progressive rate limiter removed due to TS private member constraints.

// Health check for rate limiting system
export async function rateLimitHealthCheck(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  cacheHealth: { redis: boolean; fallback: boolean };
  activeRateLimits?: number;
}> {
  try {
    const cacheHealth = await defaultRateLimit['cache'].health();

    return {
      status: cacheHealth.redis ? 'healthy' : 'degraded',
      cacheHealth,
    };
  } catch (error) {
    console.error('Rate limit health check failed:', error);
    return {
      status: 'unhealthy',
      cacheHealth: { redis: false, fallback: false },
    };
  }
}
