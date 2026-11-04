/**
 * Comprehensive Security Middleware for Order Management System
 * Implements CORS, CSP, security headers, and request validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFeatureEnv } from '@/lib/envConfig';

// CORS Configuration
interface CorsConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge: number;
}

// Security Headers Configuration
interface SecurityHeaders {
  [key: string]: string;
}

// Content Security Policy Configuration
interface CspConfig {
  directives: Record<string, string[]>;
  reportOnly?: boolean;
  reportUri?: string;
}

function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function getConfiguredOrigins(): string[] {
  const candidates = [
    process.env.APP_URL,
    process.env.BASE_URL,
    process.env.NEXTAUTH_URL,
    process.env.NEXT_PUBLIC_APP_URL,
  ];

  return Array.from(
    new Set(
      candidates
        .map((value) => normalizeOrigin(value))
        .filter((value): value is string => Boolean(value))
    )
  );
}

/**
 * Get CORS configuration based on environment
 */
function getCorsConfig(): CorsConfig {
  const corsEnv = getFeatureEnv('cors');

  // Production allowed origins come from ALLOWED_ORIGINS / app URL config.
  // The old Railway domain was removed: the project was deleted (Jul 2026) and the
  // *.up.railway.app name could be claimed by someone else.
  const productionOrigins: string[] = [];

  // Development allowed origins
  const developmentOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://0.0.0.0:3000',
  ];

  // Parse custom allowed origins from environment
  const customOrigins = corsEnv?.ALLOWED_ORIGINS
    ? corsEnv.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
    : [];
  const configuredOrigins = getConfiguredOrigins();

  const allowedOrigins =
    process.env.NODE_ENV === 'production'
      ? [...productionOrigins, ...configuredOrigins, ...customOrigins]
      : [...developmentOrigins, ...productionOrigins, ...configuredOrigins, ...customOrigins];

  return {
    allowedOrigins: Array.from(new Set(allowedOrigins.map((origin) => origin.trim()).filter(Boolean))),
    allowedMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-API-Key',
      'X-Client-Version',
      'X-Request-ID',
      'Accept',
      'Origin',
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'X-Request-ID',
      'X-Response-Time',
    ],
    credentials: true,
    maxAge: 86400, // 24 hours
  };
}

/**
 * Get security headers configuration
 */
function getSecurityHeaders(isLocalhost = false): SecurityHeaders {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return {
    // Prevent XSS attacks
    'X-XSS-Protection': '1; mode=block',

    // Prevent MIME type sniffing
    'X-Content-Type-Options': 'nosniff',

    // Control framing
    'X-Frame-Options': 'DENY',

    // Force HTTPS in production (but allow localhost)
    // If localhost, set max-age=0 to CLEAR any existing HSTS policy
    'Strict-Transport-Security': isLocalhost
      ? 'max-age=0' // Clear HSTS on localhost
      : isDevelopment
        ? ''
        : 'max-age=31536000; includeSubDomains; preload',

    // Referrer policy
    'Referrer-Policy': 'strict-origin-when-cross-origin',

    // Permissions policy
    'Permissions-Policy': [
      'camera=()',
      'microphone=()',
      'geolocation=(self)',
      'payment=(self)',
    ].join(', '),

    // Remove powered by header
    'X-Powered-By': '',
  };
}

/**
 * Get Content Security Policy configuration
 */
function getCspConfig(): CspConfig {
  const isDevelopment = process.env.NODE_ENV === 'development';

  const baseDirectives = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      "'unsafe-inline'", // Required for Next.js inline runtime scripts
      'https://maps.googleapis.com',
      'https://maps.gstatic.com',
    ],
    'style-src': [
      "'self'",
      "'unsafe-inline'", // Required for CSS-in-JS and inline styles
      'https://fonts.googleapis.com',
      'https://maps.googleapis.com',
      'https://unpkg.com',
    ],
    'img-src': [
      "'self'",
      'data:',
      'https:',
      'https://*.googleapis.com',
      'https://*.gstatic.com',
      'https://api.mapbox.com',
      'https://*.mapbox.com',
    ],
    'font-src': ["'self'", 'https://fonts.gstatic.com', 'https://r2cdn.perplexity.ai'],
    'connect-src': [
      "'self'",
      'https://api.stripe.com',
      'https://maps.googleapis.com',
      'https://places.googleapis.com',
      'https://oauth2.googleapis.com',
      'https://www.googleapis.com',
      'https://api.twilio.com',
      'https://api.mapbox.com',
      'https://*.mapbox.com',
    ],
    'worker-src': ["'self'", 'blob:'],
    'frame-src': ["'none'"],
    'child-src': ["'self'", 'blob:'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
  };

  // Add development-specific directives
  if (isDevelopment) {
    baseDirectives['script-src'].push("'unsafe-eval'");
    baseDirectives['connect-src'].push(
      'ws://localhost:*',
      'http://localhost:*',
      'https://localhost:*'
    );
  }

  return {
    directives: baseDirectives,
    reportOnly: isDevelopment,
    reportUri: '/api/security/csp-report',
  };
}

/**
 * Apply CORS headers to response
 */
function applyCorsHeaders(
  request: NextRequest,
  response: NextResponse,
  config: CorsConfig
): NextResponse {
  const origin = request.headers.get('origin');
  const isAllowedOrigin = origin && config.allowedOrigins.includes(origin);

  if (isAllowedOrigin || config.allowedOrigins.includes('*')) {
    response.headers.set('Access-Control-Allow-Origin', origin || '*');
  }

  response.headers.set('Access-Control-Allow-Methods', config.allowedMethods.join(', '));

  response.headers.set('Access-Control-Allow-Headers', config.allowedHeaders.join(', '));

  response.headers.set('Access-Control-Expose-Headers', config.exposedHeaders.join(', '));

  if (config.credentials) {
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  response.headers.set('Access-Control-Max-Age', config.maxAge.toString());

  return response;
}

/**
 * Apply security headers to response
 */
function applySecurityHeaders(response: NextResponse, headers: SecurityHeaders): NextResponse {
  Object.entries(headers).forEach(([key, value]) => {
    if (value) {
      response.headers.set(key, value);
    } else {
      response.headers.delete(key);
    }
  });

  return response;
}

/**
 * Apply Content Security Policy to response
 */
function applyCspHeaders(response: NextResponse, config: CspConfig): NextResponse {
  const cspString = Object.entries(config.directives)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ');

  const headerName = config.reportOnly
    ? 'Content-Security-Policy-Report-Only'
    : 'Content-Security-Policy';

  response.headers.set(headerName, cspString);

  return response;
}

/**
 * Validate request origin against allowed origins
 */
function validateOrigin(request: NextRequest, config: CorsConfig): boolean {
  const origin = request.headers.get('origin');

  // Allow requests without origin (e.g., direct API calls)
  if (!origin) {
    return true;
  }

  // Allow localhost origins in non-production environments only
  const isLocalhost =
    origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('0.0.0.0');
  if (isLocalhost) {
    const requestOrigin = normalizeOrigin(origin);
    const requestUrlOrigin = normalizeOrigin(request.nextUrl.origin);
    const configuredOrigins = new Set(config.allowedOrigins.map((value) => normalizeOrigin(value)).filter(Boolean));
    const isExplicitlyConfigured =
      (requestOrigin && configuredOrigins.has(requestOrigin)) ||
      (requestUrlOrigin && requestOrigin === requestUrlOrigin);

    if (process.env.NODE_ENV === 'production' && !isExplicitlyConfigured) {
      console.warn('[Security] Localhost origin rejected in production:', origin);
      return false;
    }
    return true;
  }

  const isAllowed = config.allowedOrigins.includes(origin) || config.allowedOrigins.includes('*');
  if (!isAllowed) {
    console.warn('[Security] Origin not in allowed list:', origin);
  }

  return isAllowed;
}

/**
 * Check if request is a preflight CORS request
 */
function isPreflightRequest(request: NextRequest): boolean {
  return request.method === 'OPTIONS' && request.headers.has('access-control-request-method');
}

/**
 * Handle preflight CORS request
 */
function handlePreflightRequest(request: NextRequest, config: CorsConfig): NextResponse {
  const response = new NextResponse(null, { status: 204 });
  return applyCorsHeaders(request, response, config);
}

/**
 * Validate request headers for suspicious patterns
 */
function validateRequestHeaders(request: NextRequest): boolean {
  const suspiciousPatterns = [/<script/i, /javascript:/i, /vbscript:/i, /data:text\/html/i];

  const headersToCheck = ['referer', 'user-agent', 'x-forwarded-for'];

  for (const headerName of headersToCheck) {
    const headerValue = request.headers.get(headerName);
    if (headerValue) {
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(headerValue)) {
          console.warn(`Suspicious header detected: ${headerName} = ${headerValue}`);
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Main security middleware function
 */
export function securityMiddleware(request: NextRequest): NextResponse | null {
  const corsConfig = getCorsConfig();

  // Handle preflight requests
  if (isPreflightRequest(request)) {
    return handlePreflightRequest(request, corsConfig);
  }

  // Validate origin
  if (!validateOrigin(request, corsConfig)) {
    const origin = request.headers.get('origin');
    console.error(`[Security] Origin not allowed: ${origin}`);
    // In development, allow the request to proceed but log the violation
    if (process.env.NODE_ENV !== 'development') {
      return new NextResponse('Origin not allowed', { status: 403 });
    }
  }

  // Validate request headers
  if (!validateRequestHeaders(request)) {
    return new NextResponse('Invalid request headers', { status: 400 });
  }

  // For regular requests, return null to continue processing
  // Headers will be applied in the response phase
  return null;
}

/**
 * Apply security headers to response
 */
export function applySecurityToResponse(
  request: NextRequest,
  response: NextResponse
): NextResponse {
  if (process.env.TENANT_ENFORCEMENT === 'true') {
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
  }

  const corsConfig = getCorsConfig();
  const cspConfig = getCspConfig();

  // Detect localhost safely from request headers (works in Edge runtime)
  const host = request.headers.get('host') || '';
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');

  // Apply CORS headers
  response = applyCorsHeaders(request, response, corsConfig);

  // Apply security headers (pass isLocalhost to clear HSTS if needed)
  const securityHeaders = getSecurityHeaders(isLocalhost);
  response = applySecurityHeaders(response, securityHeaders);

  // Apply CSP headers
  response = applyCspHeaders(response, cspConfig);

  // Add request tracking header
  const existingReqId = response.headers.get('X-Request-ID');
  const correlationFromReq = request.headers.get('x-correlation-id');
  const requestId = existingReqId || correlationFromReq || crypto.randomUUID();
  response.headers.set('X-Request-ID', requestId);
  if (!response.headers.get('X-Correlation-ID')) {
    response.headers.set('X-Correlation-ID', requestId);
  }

  // Add response time header
  const responseTime = Date.now() - (request as any).startTime;
  if (responseTime) {
    response.headers.set('X-Response-Time', `${responseTime}ms`);
  }

  return response;
}

/**
 * Rate limiting based on IP and endpoint
 */
export interface RateLimitInfo {
  isAllowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

/**
 * Extract real IP address from request
 */
export function getRealIpAddress(request: NextRequest): string {
  // Check various headers in order of preference
  const headers = [
    'cf-connecting-ip', // Cloudflare
    'x-forwarded-for', // Load balancers/proxies
    'x-real-ip', // Nginx
    'x-client-ip', // Apache
  ];

  for (const header of headers) {
    const value = request.headers.get(header);
    if (value) {
      // Take the first IP if there are multiple
      const ip = (value.split(',')[0] || '').trim();
      if (ip && ip !== 'unknown') {
        return ip;
      }
    }
  }

  // Fallback to connection IP
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

/**
 * Security audit logging
 */
export interface SecurityEvent {
  type:
    | 'cors_violation'
    | 'suspicious_headers'
    | 'rate_limit_exceeded'
    | 'webhook_validation_failed'
    | 'unauthorized_access';
  ip: string;
  userAgent?: string;
  url: string;
  details?: Record<string, any>;
  timestamp: Date;
}

export function logSecurityEvent(
  request: NextRequest,
  event: Omit<SecurityEvent, 'ip' | 'timestamp'>
): void {
  const securityEvent: SecurityEvent = {
    ...event,
    ip: getRealIpAddress(request),
    timestamp: new Date(),
  };

  // Log to console in development, structured logging in production
  if (process.env.NODE_ENV === 'production') {
    console.error('SECURITY_EVENT', JSON.stringify(securityEvent));
  } else {
    console.warn('Security Event:', securityEvent);
  }

  // In production, you might want to send this to a security monitoring service
  // like Datadog, Sentry, or custom logging infrastructure
}
