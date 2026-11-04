import { normalizeUser } from '@/domain/users/normalizeUser';
import { prisma } from '@/lib/db';
import { UserRole } from '@prisma/client';

export interface UpdateUserData {
  name?: string;
  email?: string;
  phone?: string;
  role?: UserRole;
  isActive?: boolean;
}

/**
 * Update user details
 * @param userId - ID of the user to update
 * @param data - Fields to update
 * @returns Updated and normalized user
 */
export async function updateUser(userId: string, data: UpdateUserData) {
  // Validate that user exists
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!existingUser) {
    throw new Error('User not found');
  }

  // If email is being changed, check for conflicts
  if (data.email && data.email !== existingUser.email) {
    const emailInUse = await prisma.user.findFirst({
      where: {
        email: data.email,
        id: { not: userId },
      },
    });

    if (emailInUse) {
      throw new Error('Email already in use by another user');
    }
  }

  // Update the user
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.role !== undefined && { role: data.role }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
    include: {
      _count: {
        select: { assignedOrders: true },
      },
    },
  });

  return normalizeUser(updatedUser);
}

/**
 * Soft delete a user (mark as inactive)
 * @param userId - ID of the user to delete
 * @param requestingUserId - ID of the user making the request
 * @returns Success status
 */
export async function deleteUser(userId: string, requestingUserId: string) {
  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Prevent default admin from being deleted
  if (user.email === 'admin@ordex.local') {
    throw new Error('Cannot delete the default admin user');
  }

  // Prevent users from deleting themselves
  if (userId === requestingUserId) {
    throw new Error('Cannot delete your own account');
  }

  // Soft delete by marking as inactive
  await prisma.user.update({
    where: { id: userId },
    data: { isActive: false },
  });

  return { success: true, message: 'User deactivated successfully' };
}

/**
 * Get user by ID
 * @param userId - ID of the user
 * @returns Normalized user or null
 */
export async function getUserById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      _count: {
        select: { assignedOrders: true },
      },
    },
  });

  return user ? normalizeUser(user) : null;
}
