/**
 * Authentication logout endpoint
 * Clears JWT tokens and invalidates session
 */

export const dynamic = 'force-dynamic';

import { handleApiError } from '@/lib/api-middleware';
import { clearSessionCookie } from '@/lib/auth';
import { setFallbackBlockCookie } from '@/lib/auth/cookies';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Create response
    const response = NextResponse.json({
      success: true,
      message: 'Logout successful',
    });

    clearSessionCookie(response);
    setFallbackBlockCookie(response);

    return response;
  } catch (error) {
    return handleApiError(error, request);
  }
}

// GET method for logout (for redirect-based logout)
export async function GET(request: NextRequest) {
  return POST(request);
}
