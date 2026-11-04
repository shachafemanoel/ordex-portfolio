import { normalizeUser } from '@/domain/users/normalizeUser';
import { withAuth, type AuthenticatedUser } from '@/lib/api-middleware';
import { hashPassword, verifyPassword } from '@/lib/auth/hash';
import { prisma, withIdentityDatabase } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ...args: any[]) {
  return withAuth(async (_req: NextRequest, user: AuthenticatedUser) => {
    try {
      // Prefer fresh data from DB (includes phone, activity flags, api token presence)
      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        include: { _count: { select: { assignedOrders: true } } },
      });

      const normalized = normalizeUser({ ...(dbUser ?? user), role: user.role, permissions: user.permissions });

      return NextResponse.json({
        success: true,
        data: normalized,
      });
    } catch (error) {
      console.error('[Auth/Me] Error fetching user profile:', error);
      throw error; // Re-throw to be handled by withAuth
    }
  })(req, ...args);
}

const UpdateProfileSchema = z
  .object({
    name: z.string().min(1, 'Name is required').optional(),
    phone: z.string().max(64, 'Phone too long').optional(),
    currentPassword: z.string().min(1, 'Current password is required').optional(),
    newPassword: z.string().min(8, 'Password must be at least 8 characters').optional(),
  })
  .refine((data) => !(data.newPassword && !data.currentPassword), {
    message: 'Current password is required to set a new password',
    path: ['currentPassword'],
  })
  .refine((data) => Boolean(data.name || data.phone || data.newPassword), {
    message: 'No changes provided',
    path: ['name'],
  });

export async function PATCH(req: NextRequest, ...args: any[]) {
  return withAuth(async (req: NextRequest, user: AuthenticatedUser) => {
    const body = await req.json().catch(() => ({}));
    const parsed = UpdateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'Invalid input', details: parsed.error.flatten() },
        },
        { status: 400 }
      );
    }

    const { name, phone, currentPassword, newPassword } = parsed.data;

    // Load user with password for verification
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: { _count: { select: { assignedOrders: true } } },
    });

    if (!dbUser) {
      return NextResponse.json(
        { success: false, error: { message: 'User not found' } },
        { status: 404 }
      );
    }

    // Handle password change if requested
    if (newPassword) {
      const valid = await verifyPassword(currentPassword!, dbUser.password || '');
      if (!valid) {
        return NextResponse.json(
          { success: false, error: { message: 'Current password is incorrect' } },
          { status: 400 }
        );
      }
    }

    const updateData: Record<string, any> = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (newPassword) {
      updateData.password = await hashPassword(newPassword);
      updateData.sessionVersion = { increment: 1 };
    }

    const updated = await withIdentityDatabase((db) => db.user.update({
      where: { id: user.id },
      data: updateData,
      include: { _count: { select: { assignedOrders: true } } },
    }));

    return NextResponse.json({
      success: true,
      data: normalizeUser({ ...updated, role: user.role, permissions: user.permissions }),
      message: 'Profile updated successfully',
    });
  })(req, ...args);
}
