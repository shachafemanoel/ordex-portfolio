import { normalizeRole, type RoleDTO } from '@/domain/roles/normalizeRole';
import { Permission } from '@/lib/auth/types';

export type UserStatus = 'active' | 'inactive' | 'suspended';

export interface UserDTO {
  id: string;
  email: string;
  fullName: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  status: UserStatus;
  isActive: boolean;
  role: RoleDTO;
  permissions: Permission[];
  assignedOrdersCount: number;
  createdAt?: Date | string | null;
  updatedAt?: Date | string | null;
  lastLoginAt?: Date | string | null;
  avatarUrl?: string | null;
  bearerToken?: string | null;
}

type MaybeDate = Date | string | null | undefined;

function coerceDate(value: MaybeDate): Date | string | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed;
}

function parsePermissions(candidate: unknown): Permission[] {
  if (!candidate) return [];
  if (Array.isArray(candidate)) return candidate.filter(Boolean) as Permission[];
  if (typeof candidate === 'string') {
    try {
      const parsed = JSON.parse(candidate);
      return Array.isArray(parsed) ? (parsed.filter(Boolean) as Permission[]) : [];
    } catch (error) {
      console.warn('Failed to parse permissions payload', error);
    }
  }
  return [];
}

/**
 * Normalizes a user object from various sources (Prisma, API, legacy)
 */
export function normalizeUser(user: any): UserDTO | null {
  if (!user || !user.id || !user.email) return null;

  const inferredNameFromParts = [user.firstName ?? user.first_name, user.lastName ?? user.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();

  const primaryName =
    user.fullName ??
    user.full_name ??
    user.name ??
    (inferredNameFromParts.length ? inferredNameFromParts : undefined);

  const firstName = user.firstName ?? user.first_name ?? primaryName?.split(' ')?.[0] ?? null;
  const trailingNamePart = primaryName?.split(' ').slice(1).join(' ').trim();
  const lastName = user.lastName ?? user.last_name ?? (trailingNamePart ? trailingNamePart : null);

  const phone = user.phone ?? user.phoneNumber ?? user.phone_number ?? null;

  const rawStatus = (user.status ?? '').toString().toLowerCase();
  const status: UserStatus =
    rawStatus === 'inactive' || user.isActive === false || user.active === false
      ? 'inactive'
      : rawStatus === 'suspended'
        ? 'suspended'
        : 'active';
  const isActive = status === 'active';

  const roleSource = user.role ?? user.roleKey ?? user.roleName ?? user.role_name;
  // Fix: Handle case where role comes as an object (e.g. from API/Me)
  let roleKey = roleSource;
  if (roleSource && typeof roleSource === 'object') {
    roleKey = roleSource.key ?? roleSource.name ?? roleSource.id ?? roleSource.code ?? roleSource;
  }

  const normalizedRole = normalizeRole(roleKey ?? 'OPERATIONS');

  const permissionList = Array.from(
    new Set([
      ...normalizedRole.permissions,
      ...parsePermissions(user.permissions),
      ...parsePermissions(user.permissionsJson),
    ])
  );

  const assignedOrdersCount =
    user.assignedOrdersCount ??
    user.assigned_orders_count ??
    user._count?.assignedOrders ??
    user.assignedOrders ??
    0;

  return {
    id: user.id,
    email: user.email,
    fullName: primaryName || user.email,
    name: user.name ?? primaryName ?? null,
    firstName,
    lastName,
    phone,
    status,
    isActive,
    role: normalizedRole,
    permissions: permissionList,
    assignedOrdersCount,
    createdAt: coerceDate(user.createdAt ?? user.created_at),
    updatedAt: coerceDate(user.updatedAt ?? user.updated_at),
    lastLoginAt: coerceDate(user.lastLoginAt ?? user.last_login_at),
    avatarUrl: user.avatarUrl ?? null,
    bearerToken: user.apiToken || user.api_token ? '********' : null,
  };
}

/**
 * Normalizes an array of users
 */
export function normalizeUsers(users: any[]): UserDTO[] {
  if (!Array.isArray(users)) return [];
  return users.map(normalizeUser).filter((u): u is UserDTO => u !== null);
}
