// Authentication service for user/role management and token validation

import { prisma } from '@/lib/db';
import { UserRole } from '@prisma/client';
import crypto from 'crypto';
import { AuthContext, User } from '@/lib/types/auth';
import { verifySessionToken } from '@/lib/auth/tokens';

export class AuthService {
  /**
   * Generate a new bearer token for a user
   */
  static generateBearerToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Find user by bearer token with role information
   * Verifies the JWT token and extracts user ID from the subject claim
   */
  static async getUserByToken(token: string): Promise<User | null> {
    if (!token) {
      console.log('[AuthService] getUserByToken called with empty token');
      return null;
    }

    try {
      // Verify and decode the JWT token
      console.log('[AuthService] Verifying token, length:', token.length);
      const payload = verifySessionToken(token);
      const userId = payload.sub;
      console.log('[AuthService] Token verified, userId:', userId);

      if (!userId) {
        console.error('[AuthService] JWT token has no subject (user ID)');
        return null;
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });
      console.log('[AuthService] User lookup result:', { found: !!user, isActive: user?.isActive });

      if (!user || !user.isActive) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name || undefined,
        status: 'active',
        role: {
          id: user.role, // Using role key as ID for simplicity
          key: user.role,
          name: user.role,
          permissions: this.getPermissionsForRole(user.role),
        },
        isActive: user.isActive,
      };
    } catch (error) {
      console.error(
        '[AuthService] Failed to verify token:',
        error instanceof Error ? error.message : error
      );
      return null;
    }
  }

  /**
   * Get permissions for a given role
   */
  static getPermissionsForRole(role: UserRole): string[] {
    const permissionMap: Record<UserRole, string[]> = {
      ADMIN: ['*'],
      SALES: [
        'orders:read',
        'orders:create',
        'orders:update',
        'customers:read',
        'customers:create',
      ],
      PURCHASING: [
        'orders:read',
        'orders:update',
        'suppliers:read',
        'suppliers:create',
        'purchase_orders:create',
      ],
      INSTALLER: ['orders:read', 'calendar:read'],
      OPERATIONS: ['orders:read', 'orders:update', 'calendar:read', 'calendar:write'],
      VIEWER: ['orders:read', 'customers:read'],
    };
    return permissionMap[role] || [];
  }

  /**
   * Create auth context from user
   */
  static createAuthContext(user: User): AuthContext {
    const permissions = user.role?.permissions || [];

    return {
      user,
      permissions,
      hasPermission: (permission: string) => permissions.includes(permission),
    };
  }

  /**
   * Create a new user with role
   */
  static async createUser(data: { email: string; name?: string; role: UserRole }): Promise<User> {
    const user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name || '',
        phone: null,
        role: data.role,
        isActive: true,
        password: null,
      },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name || undefined,
      status: 'active',
      role: {
        id: user.role,
        key: user.role,
        name: user.role,
        permissions: this.getPermissionsForRole(user.role),
      },
      isActive: user.isActive,
    };
  }

  static async createAdminUser(): Promise<User> {
    const adminEmail = 'admin@ordex.com';
    const existingUser = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (existingUser) {
      // Return existing admin
      return this.getUserByToken(existingUser.apiToken!) as Promise<User>;
    }

    return this.createUser({
      email: adminEmail,
      name: 'System Administrator',
      role: UserRole.ADMIN,
    });
  }
}
