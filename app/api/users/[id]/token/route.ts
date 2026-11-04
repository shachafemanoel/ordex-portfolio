export const dynamic = 'force-dynamic';

import { normalizeRoleKey } from '@/domain/roles/normalizeRole';
import { createSessionToken } from '@/lib/auth/tokens';
import type { AuthenticatedUser } from '@/lib/auth/types';
import { withAuth } from '@/lib/api-middleware';
import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// Use a very long expiration for API tokens (10 years)
const API_TOKEN_MAX_AGE = 10 * 365 * 24 * 60 * 60;

/**
 * POST /api/users/:id/token - Generate a new API token for a user
 */
async function generateUserToken(
  request: NextRequest,
  user: AuthenticatedUser,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id;

    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: { message: 'User not found' } },
        { status: 404 }
      );
    }

    if (!targetUser.isActive) {
      return NextResponse.json(
        { success: false, error: { message: 'User is inactive' } },
        { status: 400 }
      );
    }

    // Generate a long-lived JWT
    const token = createSessionToken(
      {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
        role: normalizeRoleKey(targetUser.role),
      },
      API_TOKEN_MAX_AGE
    );

    // Store the token (or a hash of it, but currently we store raw to verify existence/invalidation via replacement)
    // Storing the full token allows us to check "if exists" and potentially revoke specific tokens if we changed logic to check DB.
    // Since our verifySession checks DB user existence/active status, revocation is done by deactivating user.
    // Storing it here allows us to overwrite old tokens, effectively "rotating" them if we enforced a match.
    // Currently, verifySession doesn't check this field, but we store it to indicate "this user has an API token"
    // and to potentially support stricter validation in the future.

    // NOTE: 'apiToken' field does not exist in User schema yet.
    // await prisma.user.update({
    //   where: { id: userId },
    //   data: { apiToken: token },
    // });

    return NextResponse.json({
      success: true,
      data: { token },
    });
  } catch (error) {
    console.error('Error generating token:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to generate token' } },
      { status: 500 }
    );
  }
}

// Only ADMINs can generate tokens for users
export const POST = withAuth(generateUserToken, { roles: ['ADMIN'] });
