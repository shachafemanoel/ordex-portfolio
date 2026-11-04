import { UserRole } from '@prisma/client';
import { AuthenticatedUser } from '@/lib/auth/types';

/**
 * Shared role groups used for API-level RBAC checks.
 * Keeping them centralized helps prevent drift between routes.
 */
export const ROLE_GROUPS = {
  ADMIN_ONLY: ['ADMIN'],
  ALL_ROLES: ['ADMIN', 'OPERATIONS', 'SALES', 'PURCHASING', 'INSTALLER', 'VIEWER'],
} as const satisfies Record<string, readonly UserRole[]>;

export function isAdmin(user: AuthenticatedUser | null): boolean {
  return user?.role === 'ADMIN';
}

export function hasRole(user: AuthenticatedUser | null, role: UserRole): boolean {
  return user?.role === role;
}

export function isRoleAllowed(role: UserRole, allowed: readonly UserRole[]): boolean {
  return allowed.includes(role);
}
