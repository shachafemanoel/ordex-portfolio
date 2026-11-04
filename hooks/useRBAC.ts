"use client";

import React from 'react';

import { Permission, Role } from '@/lib/auth/types';
import { useAuth } from '@/components/AuthProvider';

export function useRBAC() {
  const { user, loading, permissions } = useAuth();

  const roleKey = typeof user?.role === 'string' ? (user?.role as Role) : (user?.role?.key as Role | undefined);

  const hasPermission = (permission: Permission): boolean => {
    if (!user) return false;
    return permissions.includes(permission);
  };

  const hasAnyPermission = (required: Permission[]): boolean => {
    if (!user) return false;
    return required.some((permission) => hasPermission(permission));
  };

  const hasAllPermissions = (required: Permission[]): boolean => {
    if (!user) return false;
    return required.every((permission) => hasPermission(permission));
  };

  const canAccessPage = (requiredPermissions: Permission[]): boolean => {
    return hasAnyPermission(requiredPermissions);
  };

  // Role-based shortcuts
  const isAdmin = roleKey === 'ADMIN';
  const isWorker = roleKey !== 'ADMIN';

  return {
    user,
    loading,
    permissions,
    roleKey,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessPage,
    isAdmin,
    isWorker,
  };
}

// Higher-order component for role-based rendering
interface WithPermissionProps {
  children: React.ReactNode;
  permissions: Permission[];
  requireAll?: boolean; // If true, requires ALL permissions. If false, requires ANY permission
  fallback?: React.ReactNode;
}

export function WithPermission({
  children,
  permissions,
  requireAll = false,
  fallback = null,
}: WithPermissionProps) {
  const { hasAllPermissions, hasAnyPermission } = useRBAC();

  const hasAccess = requireAll ? hasAllPermissions(permissions) : hasAnyPermission(permissions);

  if (!hasAccess) {
    return React.createElement(React.Fragment, null, fallback);
  }

  return React.createElement(React.Fragment, null, children);
}

// Component to show content only for specific roles
interface WithRoleProps {
  children: React.ReactNode;
  roles: Role[];
  fallback?: React.ReactNode;
}

export function WithRole({ children, roles, fallback = null }: WithRoleProps) {
  const { roleKey } = useRBAC();

  if (!roleKey || !roles.includes(roleKey)) {
    return React.createElement(React.Fragment, null, fallback);
  }

  return React.createElement(React.Fragment, null, children);
}

// Hook to get role-specific navigation items
export function useRoleBasedNavigation() {
  const rbac = useRBAC();

  const getNavigationItems = () => {
    const items: Array<{ name: string; href: string; icon: string; permission: Permission | null }> = [];

    items.push({ name: 'דשבורד', href: '/dashboard', icon: '📊', permission: null });

    if (rbac.hasPermission('VIEW_ORDERS')) {
      items.push({ name: 'הזמנות', href: '/orders', icon: '📦', permission: 'VIEW_ORDERS' });
    }

    if (rbac.hasPermission('VIEW_REPORTS')) {
      items.push({ name: 'דוחות', href: '/dashboard/reports', icon: '📈', permission: 'VIEW_REPORTS' });
    }

    if (rbac.isAdmin) {
      items.push({ name: 'ניהול', href: '/admin', icon: '⚙️', permission: 'MANAGE_SETTINGS' });
    }

    return items;
  };

  return {
    navigationItems: getNavigationItems(),
    ...rbac,
  };
}
