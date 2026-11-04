import { UserRole } from '@prisma/client';
import { AuthorizationError } from '@/lib/auth/errors';
import { AuthenticatedUser } from '@/lib/auth/types';

export function requireRole(user: AuthenticatedUser, allowedRoles: readonly UserRole[]) {
  if (!user || !user.role) {
    throw new AuthorizationError('User has no role');
  }
  if (!allowedRoles.includes(user.role)) {
    throw new AuthorizationError(
      `Role ${user.role} is not allowed. Required: ${allowedRoles.join(', ')}`
    );
  }
}
