/**
 * Enhanced JWT Validation and Authentication System
 * Provides secure token validation with refresh token rotation and security checks
 */

import { logger } from '@/lib/enhanced-logger';

export interface JWTPayload {
  userId: string;
  email: string;
  role: string;
  sessionId: string;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
  jti: string; // JWT ID for tracking
}

export interface RefreshTokenPayload {
  userId: string;
  sessionId: string;
  tokenVersion: number;
  iat: number;
  exp: number;
  jti: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  sessionId: string;
  tokenVersion?: number;
}

export interface TokenValidationResult {
  isValid: boolean;
  user?: AuthenticatedUser;
  error?: string;
  needsRefresh?: boolean;
  remainingTime?: number;
}

export interface TokenSecurityCheck {
  isValid: boolean;
  issues: string[];
  severity: 'low' | 'medium' | 'high';
}

export class JWTValidator {
  private jwtSecret: string;
  private refreshSecret: string;
  private issuer: string;
  private audience: string;
  private tokenLifetime: number; // seconds
  private refreshLifetime: number; // seconds
  private blacklistedTokens = new Set<string>();

  constructor() {
    const jwtSecret = process.env.JWT_SECRET;
    const refreshSecret = process.env.JWT_REFRESH_SECRET;

    if (!jwtSecret || !refreshSecret) {
      logger.error('JWT configuration error: secrets are missing', {
        component: 'jwt-validator',
        security: true,
        severity: 'critical',
      });
      throw new Error(
        `JWT configuration error: ${!jwtSecret ? 'JWT_SECRET' : 'JWT_REFRESH_SECRET'} is not configured`
      );
    }

    this.jwtSecret = jwtSecret;
    this.refreshSecret = refreshSecret;
    this.issuer = process.env.JWT_ISSUER || 'ordex-oms';
    this.audience = process.env.JWT_AUDIENCE || 'ordex-oms-api';
    this.tokenLifetime = parseInt(process.env.JWT_LIFETIME || '900'); // 15 minutes default
    this.refreshLifetime = parseInt(process.env.JWT_REFRESH_LIFETIME || '604800'); // 7 days default
  }

  /**
   * Generate a new access token
   */
  async generateAccessToken(
    user: Pick<AuthenticatedUser, 'id' | 'email' | 'role'>,
    sessionId: string
  ): Promise<string> {
    const crypto = await import('crypto');
    const now = Math.floor(Date.now() / 1000);

    const payload: JWTPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      sessionId,
      iat: now,
      exp: now + this.tokenLifetime,
      iss: this.issuer,
      aud: this.audience,
      jti: crypto.randomUUID(),
    };

    return this.signToken(payload, this.jwtSecret);
  }

  /**
   * Generate a new refresh token
   */
  async generateRefreshToken(
    userId: string,
    sessionId: string,
    tokenVersion: number
  ): Promise<string> {
    const crypto = await import('crypto');
    const now = Math.floor(Date.now() / 1000);

    const payload: RefreshTokenPayload = {
      userId,
      sessionId,
      tokenVersion,
      iat: now,
      exp: now + this.refreshLifetime,
      jti: crypto.randomUUID(),
    };

    return this.signToken(payload, this.refreshSecret);
  }

  /**
   * Validate an access token
   */
  async validateAccessToken(token: string): Promise<TokenValidationResult> {
    try {
      if (!token) {
        return { isValid: false, error: 'No token provided' };
      }

      // Check if token is blacklisted
      if (this.blacklistedTokens.has(token)) {
        logger.security('Attempted use of blacklisted token', 'medium', {
          component: 'jwt-validator',
        });
        return { isValid: false, error: 'Token has been revoked' };
      }

      const payload = (await this.verifyToken(token, this.jwtSecret)) as JWTPayload;

      // Security checks
      const securityCheck = this.performSecurityChecks(payload);
      if (!securityCheck.isValid) {
        logger.security(
          `JWT security check failed: ${securityCheck.issues.join(', ')}`,
          securityCheck.severity,
          {
            component: 'jwt-validator',
            issues: securityCheck.issues,
          }
        );
        return { isValid: false, error: 'Token failed security validation' };
      }

      // Check expiration with grace period
      const now = Math.floor(Date.now() / 1000);
      const remainingTime = payload.exp - now;

      if (remainingTime < 0) {
        return {
          isValid: false,
          error: 'Token expired',
          needsRefresh: true,
        };
      }

      // Check if token needs refresh (less than 5 minutes remaining)
      const needsRefresh = remainingTime < 300;

      return {
        isValid: true,
        user: {
          id: payload.userId,
          email: payload.email,
          role: payload.role,
          sessionId: payload.sessionId,
        },
        needsRefresh,
        remainingTime,
      };
    } catch (error) {
      logger.warn(
        'JWT validation failed',
        {
          component: 'jwt-validator',
        },
        error as Error | undefined
      );

      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Token validation failed',
      };
    }
  }

  /**
   * Validate a refresh token
   */
  async validateRefreshToken(token: string): Promise<{
    isValid: boolean;
    payload?: RefreshTokenPayload;
    error?: string;
  }> {
    try {
      if (!token || this.blacklistedTokens.has(token)) {
        return { isValid: false, error: 'Invalid or revoked refresh token' };
      }

      const payload = (await this.verifyToken(token, this.refreshSecret)) as RefreshTokenPayload;

      // Additional validation for refresh tokens
      if (!payload.userId || !payload.sessionId || typeof payload.tokenVersion !== 'number') {
        return { isValid: false, error: 'Malformed refresh token' };
      }

      return { isValid: true, payload };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Refresh token validation failed',
      };
    }
  }

  /**
   * Perform security checks on JWT payload
   */
  private performSecurityChecks(payload: JWTPayload): TokenSecurityCheck {
    const issues: string[] = [];
    let severity: 'low' | 'medium' | 'high' = 'low';

    // Check required fields
    const requiredFields: (keyof JWTPayload)[] = [
      'userId',
      'email',
      'role',
      'sessionId',
      'iat',
      'exp',
      'iss',
      'aud',
      'jti',
    ];

    for (const field of requiredFields) {
      if (!payload[field]) {
        issues.push(`Missing required field: ${field}`);
        severity = 'high';
      }
    }

    // Check issuer and audience
    if (payload.iss !== this.issuer) {
      issues.push('Invalid issuer');
      severity = 'high';
    }

    if (payload.aud !== this.audience) {
      issues.push('Invalid audience');
      severity = 'high';
    }

    // Check token age (issued at)
    const now = Math.floor(Date.now() / 1000);
    const tokenAge = now - payload.iat;
    const maxAge = this.tokenLifetime + 300; // 5 minute grace period

    if (tokenAge > maxAge) {
      issues.push('Token is too old');
      severity = 'medium';
    }

    if (payload.iat > now + 60) {
      // 1 minute clock skew tolerance
      issues.push('Token issued in the future');
      severity = 'high';
    }

    // Check email format
    if (payload.email && !this.isValidEmail(payload.email)) {
      issues.push('Invalid email format in token');
      severity = 'medium';
    }

    // Check role validity
    const validRoles = ['admin', 'sales', 'purchasing', 'installer'];
    if (payload.role && !validRoles.includes(payload.role)) {
      issues.push('Invalid role in token');
      severity = 'medium';
    }

    return {
      isValid: issues.length === 0,
      issues,
      severity,
    };
  }

  /**
   * Blacklist a token (logout, security breach, etc.)
   */
  blacklistToken(token: string): void {
    this.blacklistedTokens.add(token);

    // Clean up old blacklisted tokens periodically
    if (this.blacklistedTokens.size > 10000) {
      this.cleanupBlacklist();
    }

    logger.info('Token blacklisted', {
      component: 'jwt-validator',
      audit: true,
    });
  }

  /**
   * Clean up expired blacklisted tokens
   */
  private cleanupBlacklist(): void {
    // In a production system, you'd want to store blacklisted tokens
    // in a persistent store (Redis, Database) with TTL
    const currentSize = this.blacklistedTokens.size;

    // For memory efficiency, keep only recent tokens
    // This is a simplified approach - production systems should use Redis/DB
    if (currentSize > 5000) {
      this.blacklistedTokens.clear();
      logger.info('Blacklist cleaned up', {
        component: 'jwt-validator',
        previousSize: currentSize,
      });
    }
  }

  /**
   * Sign a token with the given secret
   */
  private async signToken(payload: any, secret: string): Promise<string> {
    // In a real implementation, you'd use a proper JWT library like 'jsonwebtoken'
    // This is a simplified version for demonstration
    const crypto = await import('crypto');

    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payloadString = Buffer.from(JSON.stringify(payload)).toString('base64url');

    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${header}.${payloadString}`)
      .digest('base64url');

    return `${header}.${payloadString}.${signature}`;
  }

  /**
   * Verify a token with the given secret
   */
  private async verifyToken(token: string, secret: string): Promise<any> {
    const crypto = await import('crypto');

    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    const [header, payload, signature] = parts;

    // Verify signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${header}.${payload}`)
      .digest('base64url');

    if (signature !== expectedSignature) {
      throw new Error('Invalid token signature');
    }

    // Parse payload
    const payloadObj = JSON.parse(Buffer.from(payload, 'base64url').toString());

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payloadObj.exp && payloadObj.exp < now) {
      throw new Error('Token expired');
    }

    return payloadObj;
  }

  /**
   * Validate email format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Get token info without full validation (for debugging)
   */
  getTokenInfo(token: string): { header: any; payload: any; isExpired: boolean } | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      const now = Math.floor(Date.now() / 1000);
      const isExpired = payload.exp < now;

      return { header, payload, isExpired };
    } catch {
      return null;
    }
  }

  /**
   * Generate a session ID
   */
  generateSessionId(): string {
    return crypto.randomUUID();
  }
}

// Singleton instance
export const jwtValidator = new JWTValidator();

/**
 * Middleware helper to extract and validate JWT from request
 */
export async function validateJWTFromRequest(request: Request): Promise<{
  isValid: boolean;
  user?: AuthenticatedUser;
  error?: string;
  needsRefresh?: boolean;
}> {
  try {
    // Check Authorization header
    const authHeader = request.headers.get('authorization');
    let token: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // Fallback to cookie if no bearer token
    if (!token) {
      const cookies = request.headers.get('cookie');
      if (cookies) {
        const match = cookies.match(/(?:^|;\s*)session=([^;]+)/);
        token = match?.[1] || null;
      }
    }

    if (!token) {
      return { isValid: false, error: 'No token provided' };
    }

    const result = await jwtValidator.validateAccessToken(token);
    return result;
  } catch (error) {
    logger.error(
      'JWT validation middleware error',
      {
        component: 'jwt-validator',
      },
      error as Error | undefined
    );

    return {
      isValid: false,
      error: 'Authentication validation failed',
    };
  }
}

/**
 * Token refresh flow
 */
export async function refreshAccessToken(
  refreshToken: string,
  getUserById: (userId: string) => Promise<AuthenticatedUser | null>
): Promise<{
  success: boolean;
  accessToken?: string;
  newRefreshToken?: string;
  error?: string;
}> {
  try {
    const validation = await jwtValidator.validateRefreshToken(refreshToken);

    if (!validation.isValid || !validation.payload) {
      return { success: false, error: validation.error };
    }

    // Get current user data
    const user = await getUserById(validation.payload.userId);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Check if token version is still valid
    if (user.tokenVersion !== undefined && user.tokenVersion !== validation.payload.tokenVersion) {
      return { success: false, error: 'Refresh token version mismatch' };
    }

    // Generate new tokens
    const accessToken = await jwtValidator.generateAccessToken(user, validation.payload.sessionId);
    const newRefreshToken = await jwtValidator.generateRefreshToken(
      user.id,
      validation.payload.sessionId,
      user.tokenVersion || 0
    );

    // Blacklist old refresh token
    jwtValidator.blacklistToken(refreshToken);

    return {
      success: true,
      accessToken,
      newRefreshToken,
    };
  } catch (error) {
    logger.error(
      'Token refresh failed',
      {
        component: 'jwt-validator',
      },
      error as Error | undefined
    );

    return {
      success: false,
      error: 'Token refresh failed',
    };
  }
}
