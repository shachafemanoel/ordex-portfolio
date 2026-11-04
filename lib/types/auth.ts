// Authentication and authorization types

export interface Role {
  id: string;
  key: string;
  name: string;
  permissions: string[];
}

export interface User {
  id: string;
  email: string;
  name?: string;
  roleId?: string;
  role?: Role;
  status: string;
  apiToken?: string;
  isActive: boolean;
}

export interface AuthContext {
  user: User;
  permissions: string[];
  hasPermission: (permission: string) => boolean;
}

export type Permission =
  | 'orders:read'
  | 'orders:write'
  | 'orders:delete'
  | 'customers:read'
  | 'customers:write'
  | 'customers:delete'
  | 'suppliers:read'
  | 'suppliers:write'
  | 'suppliers:delete'
  | 'pos:create'
  | 'reports:read'
  | 'settings:read'
  | 'settings:write'
  | 'admin:all';

// Role-based permission mapping
export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [
    'orders:read',
    'orders:write',
    'orders:delete',
    'customers:read',
    'customers:write',
    'customers:delete',
    'suppliers:read',
    'suppliers:write',
    'suppliers:delete',
    'pos:create',
    'reports:read',
    'settings:read',
    'settings:write',
    'admin:all',
  ],
  manager: [
    'orders:read',
    'orders:write',
    'customers:read',
    'customers:write',
    'suppliers:read',
    'pos:create',
    'reports:read',
  ],
  staff: ['orders:read', 'customers:read', 'suppliers:read', 'reports:read'],
};
