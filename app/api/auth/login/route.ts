export const dynamic = 'force-dynamic';

import { ValidationError, handleApiError } from '@/lib/api-middleware';
import { ensureInitialized, shouldRunStartupInit } from '@/lib/app-startup';
import { authenticateUser, setSessionCookie } from '@/lib/auth';
import { clearFallbackBlockCookie } from '@/lib/auth/cookies';
import { normalizeEmail } from '@/lib/auth/normalization';
import { logger } from '@/lib/logger';
import { authRateLimit, withRateLimit } from '@/lib/rate-limit';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';


// Helper function to get Hebrew role labels
function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    ADMIN: 'מנהל',
    OPERATIONS: 'עובד כללי',
  };
  return labels[role] || 'עובד כללי';
}

// Login request schema
const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

async function loginHandler(request: NextRequest) {
  try {
    if (shouldRunStartupInit()) {
      try {
        await ensureInitialized();
      } catch (initError) {
        logger.error('Auth startup initialization failed', initError);
        throw new ValidationError('Authentication service unavailable, please try again shortly');
      }
    }
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError(
        'Invalid login data',
        parsed.error.errors,
        parsed.error.errors[0]?.path.join('.') || ''
      );
    }

    const { email, password, rememberMe } = parsed.data;
    // Authenticate user
    let authResult: Awaited<ReturnType<typeof authenticateUser>>;
    try {
      const normalizedEmail = normalizeEmail(email);
      authResult = await authenticateUser(normalizedEmail, password);
    } catch (authError) {
      logger.error('Authentication failed (unexpected)', authError, { email });
      throw new ValidationError('Authentication failed, please try again');
    }
    if (!authResult) {
      // Don't reveal whether email or password was wrong for security
      throw new ValidationError('Invalid email or password');
    }

    const { user, token, refreshToken } = authResult;

    // If rememberMe is requested, use the long-lived refresh token as the session token
    // This ensures the token expiry matches the cookie maxAge (14 days vs 1 hour)
    const sessionToken = rememberMe && refreshToken ? refreshToken : token;

    // Transform AuthenticatedUser to UserDTO format
    const userData = {
      id: user.id,
      email: user.email,
      fullName: user.name || null,
      phone: null,
      isActive: true,
      role: {
        key: user.role,
        label: getRoleLabel(user.role),
      },
      permissions: user.permissions,
      createdAt: new Date(),
    };

    const response = NextResponse.json({
      success: true,
      data: {
        user: userData,
        token: sessionToken, // Include JWT token in response for localStorage storage
      },
      message: 'Login successful',
    });

    setSessionCookie(response, sessionToken, rememberMe ?? false);
    clearFallbackBlockCookie(response);
    return response;
  } catch (error) {
    return handleApiError(error, request);
  }
}

export async function POST(request: NextRequest, ...args: any[]) {
  return withRateLimit(authRateLimit, loginHandler)(request, ...args);
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Auth endpoint is healthy',
    timestamp: new Date().toISOString(),
  });
}
