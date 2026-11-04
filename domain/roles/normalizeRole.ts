/**
 * Role normalization utilities
 * Converts various role representations to canonical Role enum values
 */
import { Permission, ROLE_PERMISSIONS, Role } from '@/lib/auth/types';

// Two-role system: ADMIN and OPERATIONS (general worker).
// Legacy roles all resolve to OPERATIONS label and permissions.
const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'מנהל',
  OPERATIONS: 'עובד כללי',
  // Legacy — same label as OPERATIONS
  SALES: 'עובד כללי',
  PURCHASING: 'עובד כללי',
  INSTALLER: 'עובד כללי',
  VIEWER: 'עובד כללי',
};

// All non-ADMIN roles (including legacy names) resolve to OPERATIONS
const LEGACY_ROLE_MAP: Record<string, Role> = {
  admin: 'ADMIN',
  manager: 'ADMIN',
  ADMIN: 'ADMIN',
  MANAGER: 'ADMIN',
  // All worker variants → OPERATIONS
  sales: 'OPERATIONS',
  purchasing: 'OPERATIONS',
  installer: 'OPERATIONS',
  operations: 'OPERATIONS',
  viewer: 'OPERATIONS',
  worker: 'OPERATIONS',
  ops: 'OPERATIONS',
  operations_worker: 'OPERATIONS',
  SALES: 'OPERATIONS',
  PURCHASING: 'OPERATIONS',
  INSTALLER: 'OPERATIONS',
  OPERATIONS: 'OPERATIONS',
  VIEWER: 'OPERATIONS',
  OPERATIONS_WORKER: 'OPERATIONS',
};

const ALLOWED_ROLES = Object.keys(ROLE_LABELS) as Role[];

/**
 * Normalizes a role input to a canonical Role key
 */
export function normalizeRoleKey(role: any): Role {
  if (role && typeof role === 'object' && 'key' in role && role.key) {
    return normalizeRoleKey(role.key);
  }

  const candidate = typeof role === 'string' ? role : (role ?? 'OPERATIONS');
  const upper = String(candidate).toUpperCase();

  if (ALLOWED_ROLES.includes(upper as Role)) {
    return upper as Role;
  }

  if (LEGACY_ROLE_MAP[candidate as string]) {
    return LEGACY_ROLE_MAP[candidate as string];
  }
  if (LEGACY_ROLE_MAP[upper]) {
    return LEGACY_ROLE_MAP[upper];
  }

  return 'OPERATIONS';
}

export interface RoleDTO {
  id: string;
  key: Role;
  label: string;
  permissions: Permission[];
}

/**
 * Normalizes a role string to a canonical RoleDTO object
 */
export function normalizeRole(role: string | Role | null | undefined): RoleDTO {
  if (!role) {
    return {
      id: 'role-operations',
      key: 'OPERATIONS',
      label: ROLE_LABELS.OPERATIONS,
      permissions: ROLE_PERMISSIONS.OPERATIONS,
    };
  }

  const normalizedKey = normalizeRoleKey(role);
  return {
    id: `role-${normalizedKey.toLowerCase()}`,
    key: normalizedKey,
    label: ROLE_LABELS[normalizedKey],
    permissions: ROLE_PERMISSIONS[normalizedKey],
  };
}

/**
 * Normalizes an array of roles
 */
export function normalizeRoles(roles: Array<string | Role | null | undefined>): RoleDTO[] {
  if (!Array.isArray(roles)) return [];
  return roles.map(normalizeRole);
}
