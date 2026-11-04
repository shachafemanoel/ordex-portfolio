export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api-middleware';
import { UserRole } from '@prisma/client';
import { updateUser, deleteUser, getUserById } from '@/lib/server/userService';
import type { AuthenticatedUser } from '@/lib/auth/types';

const UpdateUserSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  email: z.string().email('Invalid email format').optional(),
  phone: z.string().optional(),
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/users/:id - Get user by ID
 */
async function getUser(
  request: NextRequest,
  user: AuthenticatedUser,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id;
    const userData = await getUserById(userId);

    if (!userData) {
      return NextResponse.json(
        { success: false, error: { message: 'User not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: userData });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { success: false, error: { message: 'Failed to fetch user' } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/users/:id - Update user
 */
async function patchUser(
  request: NextRequest,
  user: AuthenticatedUser,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id;
    const body = await request.json();
    const parsed = UpdateUserSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'Invalid input data', details: parsed.error.flatten() },
        },
        { status: 400 }
      );
    }

    const updatedUser = await updateUser(userId, parsed.data);

    return NextResponse.json({
      success: true,
      data: updatedUser,
      message: 'User updated successfully',
    });
  } catch (error) {
    console.error('Error updating user:', error);

    if (error instanceof Error) {
      if (error.message === 'User not found') {
        return NextResponse.json(
          { success: false, error: { message: error.message } },
          { status: 404 }
        );
      }
      if (error.message === 'Email already in use by another user') {
        return NextResponse.json(
          { success: false, error: { message: error.message } },
          { status: 409 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: { message: 'Failed to update user' } },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/users/:id - Delete (deactivate) user
 */
async function removeUser(
  request: NextRequest,
  user: AuthenticatedUser,
  { params }: { params: { id: string } }
) {
  try {
    const userId = params.id;
    const result = await deleteUser(userId, user.id);

    return NextResponse.json({
      success: true,
      data: { message: result.message },
    });
  } catch (error) {
    console.error('Error deleting user:', error);

    if (error instanceof Error) {
      if (error.message === 'User not found') {
        return NextResponse.json(
          { success: false, error: { message: error.message } },
          { status: 404 }
        );
      }
      if (
        error.message === 'Cannot delete the default admin user' ||
        error.message === 'Cannot delete your own account'
      ) {
        return NextResponse.json(
          { success: false, error: { message: error.message } },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(
      { success: false, error: { message: 'Failed to delete user' } },
      { status: 500 }
    );
  }
}

// All operations require ADMIN role
export const GET = withAuth(getUser, { roles: ['ADMIN'] });
export const PATCH = withAuth(patchUser, { roles: ['ADMIN'] });
export const DELETE = withAuth(removeUser, { roles: ['ADMIN'] });
