import type { UserRole } from '@prisma/client';

export type Role = UserRole;

export interface SessionUser {
  sessionVersion?: number;
  tenantId?: string;
  id: string;
  email: string;
  name?: string | null;
  role: Role;
}

export interface SessionPayload {
  sessionVersion?: number;
  tenantId?: string;
  sub: string;
  email: string;
  role: Role;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  name?: string | null;
}

export interface AuthenticatedUser extends SessionUser {
  permissions: Permission[];
}

export type Permission =
  | 'VIEW_SKUS'
  | 'VIEW_ORDERS'
  | 'VIEW_ALL_ORDERS'
  | 'CREATE_ORDERS'
  | 'EDIT_ORDERS'
  | 'CANCEL_ORDERS'
  | 'ASSIGN_ORDERS'
  | 'CHANGE_PRIORITY'
  | 'APPROVE_ORDERS'
  | 'SCHEDULE_ORDERS'
  | 'DISPATCH_ORDERS'
  | 'COMPLETE_ORDERS'
  | 'HOLD_ORDERS'
  | 'VIEW_CUSTOMERS'
  | 'EDIT_CUSTOMERS'
  | 'VIEW_REPORTS'
  | 'VIEW_DASHBOARD'
  | 'MANAGE_USERS'
  | 'MANAGE_INTEGRATIONS'
  | 'MANAGE_SETTINGS'
  | 'BULK_ACTIONS'
  | 'EXPORT_DATA'
  | 'VIEW_TASKS'
  | 'COMPLETE_TASKS'
  | 'ADD_NOTES'
  | 'UPDATE_ITEMS'
  | 'MARK_PREPARATION_COMPLETE'
  | 'SEND_OPERATIONAL_EMAIL';

const ALL_PERMISSIONS: Permission[] = [
  'VIEW_SKUS',
  'VIEW_ORDERS',
  'VIEW_ALL_ORDERS',
  'CREATE_ORDERS',
  'EDIT_ORDERS',
  'CANCEL_ORDERS',
  'ASSIGN_ORDERS',
  'CHANGE_PRIORITY',
  'APPROVE_ORDERS',
  'SCHEDULE_ORDERS',
  'DISPATCH_ORDERS',
  'COMPLETE_ORDERS',
  'HOLD_ORDERS',
  'VIEW_CUSTOMERS',
  'EDIT_CUSTOMERS',
  'VIEW_REPORTS',
  'VIEW_DASHBOARD',
  'MANAGE_USERS',
  'MANAGE_INTEGRATIONS',
  'MANAGE_SETTINGS',
  'BULK_ACTIONS',
  'EXPORT_DATA',
  'VIEW_TASKS',
  'COMPLETE_TASKS',
  'ADD_NOTES',
  'UPDATE_ITEMS',
  'MARK_PREPARATION_COMPLETE',
  'SEND_OPERATIONAL_EMAIL',
];

// Two-role system: ADMIN (full access) and OPERATIONS (general worker).
// Legacy roles (SALES, PURCHASING, INSTALLER, VIEWER) are kept in the enum
// for DB compatibility but all resolve to the same permissions as OPERATIONS.
const OPERATIONS_PERMISSIONS: Permission[] = [
  'VIEW_SKUS',
  'VIEW_ORDERS',
  'VIEW_ALL_ORDERS',
  'CREATE_ORDERS',
  'EDIT_ORDERS',
  'CANCEL_ORDERS',
  'ASSIGN_ORDERS',
  'CHANGE_PRIORITY',
  'APPROVE_ORDERS',
  'SCHEDULE_ORDERS',
  'DISPATCH_ORDERS',
  'COMPLETE_ORDERS',
  'HOLD_ORDERS',
  'VIEW_CUSTOMERS',
  'EDIT_CUSTOMERS',
  'VIEW_REPORTS',
  'VIEW_DASHBOARD',
  'BULK_ACTIONS',
  'EXPORT_DATA',
  'VIEW_TASKS',
  'COMPLETE_TASKS',
  'ADD_NOTES',
  'UPDATE_ITEMS',
  'MARK_PREPARATION_COMPLETE',
  'SEND_OPERATIONAL_EMAIL',
];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: ALL_PERMISSIONS,
  OPERATIONS: OPERATIONS_PERMISSIONS,
  // Legacy roles — same permissions as OPERATIONS
  SALES: OPERATIONS_PERMISSIONS,
  PURCHASING: OPERATIONS_PERMISSIONS,
  INSTALLER: OPERATIONS_PERMISSIONS,
  VIEWER: OPERATIONS_PERMISSIONS,
};

export function toAuthenticatedUser(user: SessionUser): AuthenticatedUser {
  return {
    ...user,
    permissions: ROLE_PERMISSIONS[user.role] ?? [],
  };
}
