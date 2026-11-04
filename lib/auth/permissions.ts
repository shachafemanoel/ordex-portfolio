import { AuthorizationError } from '@/lib/auth/errors';
import type { AuthenticatedUser, Permission } from '@/lib/auth/types';

export function requirePermissions(
  user: AuthenticatedUser,
  permissions: readonly Permission[],
  requireAll: boolean = false
): void {
  const hasPermission = requireAll
    ? permissions.every((permission) => user.permissions.includes(permission))
    : permissions.some((permission) => user.permissions.includes(permission));

  if (!hasPermission) {
    throw new AuthorizationError(`Missing required permissions: ${permissions.join(', ')}`);
  }
}
