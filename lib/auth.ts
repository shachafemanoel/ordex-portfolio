import { NextRequest } from 'next/server';
import type { UserRole } from '@prisma/client';

import { prisma, withIdentityDatabase } from '@/lib/db';
import { isTenantRuntime } from '@/lib/tenancy/context';
import { authConfig } from '@/lib/auth/config';
import { getTokenFromRequest, setSessionCookie, clearSessionCookie } from '@/lib/auth/cookies';
import { hashPassword, verifyPassword } from '@/lib/auth/hash';
import type {
  AuthenticatedUser,
  Permission,
  Role,
  SessionUser,
} from './auth/types';
import { ROLE_PERMISSIONS, toAuthenticatedUser } from '@/lib/auth/types';
import { createSessionToken } from '@/lib/auth/tokens';
import { AuthenticationError } from '@/lib/auth/errors';
import {
  findSessionUserByEmail,
  findSessionUserById,
} from './auth/user.server';
import { normalizeRoleKey } from '@/lib/auth/user';
import { normalizeEmail } from '@/lib/auth/normalization';
import { requireRole } from '@/lib/auth/requireRole';
import { verifySession, verifySessionFromRequest } from '@/lib/auth/verifySession';
import { ensureUserRoleEnumCompatibility } from '@/lib/db/user-role-compat';
import { withRetry } from '@/lib/prisma-utils';

export type { AuthenticatedUser, Permission, Role };
export { ROLE_PERMISSIONS, hashPassword, verifyPassword, setSessionCookie, clearSessionCookie };

/** @deprecated Use SessionUser directly instead */
interface LegacyTokenPayload {
  userId: string;
  email: string;
  role: Role | UserRole | string;
  name?: string | null;
}

/** @deprecated Internal helper - use createSessionToken directly */
function buildSessionUser(input: LegacyTokenPayload): SessionUser {
  return {
    id: input.userId,
    email: input.email,
    name: input.name ?? null,
    role: normalizeRoleKey(input.role),
  };
}

/** @deprecated Use createSessionToken with SessionUser directly */
export function generateToken(payload: LegacyTokenPayload, maxAge: number = authConfig.sessionMaxAge): string {
  const user = buildSessionUser(payload);
  return createSessionToken(user, maxAge);
}

/** @deprecated Use createSessionToken with SessionUser directly */
export function generateRefreshToken(payload: LegacyTokenPayload): string {
  const user = buildSessionUser(payload);
  return createSessionToken(user, authConfig.rememberMaxAge);
}

export async function getUserByEmail(email: string): Promise<AuthenticatedUser | null> {
  return findSessionUserByEmail(email);
}

export async function getUserById(userId: string): Promise<AuthenticatedUser | null> {
  return findSessionUserById(userId);
}

export async function createUser(data: {
  name: string;
  email: string;
  password: string;
  role: Role;
}): Promise<AuthenticatedUser> {
  const passwordHash = await hashPassword(data.password);
  const role = normalizeRoleKey(data.role);

  const created = await withRetry(() => prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: passwordHash,
      role,
      isActive: true,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
    },
  }));

  return toAuthenticatedUser({
    id: created.id,
    email: created.email,
    name: created.name,
    role: normalizeRoleKey(created.role),
  });
}

export async function authenticateUser(
  email: string,
  password: string
): Promise<{ user: AuthenticatedUser; token: string; refreshToken: string } | null> {
  await ensureUserRoleEnumCompatibility();

  const normalizedEmail = normalizeEmail(email);
  const record = await withRetry(() => withIdentityDatabase((db) => db.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      sessionVersion: true,
      password: true,
      isActive: true,
    },
  })));

  if (!record) {
    console.warn('[Auth] Authentication attempt rejected');
    return null;
  }

  if (!record.isActive) {
    console.warn('[Auth] Authentication attempt rejected');
    return null;
  }

  if (!record.password) {
    console.warn('[Auth] Authentication attempt rejected');
    return null;
  }

  const valid = await verifyPassword(password, record.password);
  if (!valid) {
    console.warn('[Auth] Authentication attempt rejected');
    return null;
  }

  const sessionUser: SessionUser = {
    sessionVersion: record.sessionVersion,
    id: record.id,
    email: record.email,
    name: record.name,
    role: normalizeRoleKey(record.role),
  };

  if (isTenantRuntime()) {
    const { resolveTenantMembership } = await import('@/lib/tenancy/session');
    const membership = await resolveTenantMembership(record.id);
    sessionUser.tenantId = membership.tenantId;
    sessionUser.role = membership.role;
  }
  const user = toAuthenticatedUser(sessionUser);
  const token = createSessionToken(sessionUser, authConfig.sessionMaxAge);
  const refreshToken = createSessionToken(sessionUser, authConfig.rememberMaxAge);

  return { user, token, refreshToken };
}

export async function authenticateRequest(request: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    const { user } = await verifySessionFromRequest(request);
    return user;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return null;
    }

    console.warn('authenticateRequest failed', error);
    return null;
  }
}

export function extractTokenFromRequest(request: NextRequest): string | null {
  return getTokenFromRequest(request);
}

export function hasPermission(user: AuthenticatedUser, permission: Permission): boolean {
  return user.permissions.includes(permission);
}

export function hasRole(user: AuthenticatedUser, roles: Role[]): boolean {
  return roles.includes(user.role);
}

export function hasAnyPermission(user: AuthenticatedUser, permissions: Permission[]): boolean {
  return permissions.some((permission) => user.permissions.includes(permission));
}

export async function requireAuthWithRole(
  reqOrRoles: NextRequest | Role[],
  maybeRoles?: Role[]
): Promise<AuthenticatedUser> {
  const roles = Array.isArray(reqOrRoles) ? reqOrRoles : maybeRoles;
  const request = Array.isArray(reqOrRoles) ? undefined : reqOrRoles;

  if (!roles || roles.length === 0) {
    throw new Error('requireAuthWithRole requires at least one role');
  }

  const session = request ? await verifySessionFromRequest(request) : await verifySession();
  requireRole(session.user, roles);
  return session.user;
}

export function hasAllPermissions(user: AuthenticatedUser, permissions: Permission[]): boolean {
  return permissions.every((permission) => user.permissions.includes(permission));
}

export function getOrderFilterForRole(user: AuthenticatedUser): any {
  if (user.permissions.includes('VIEW_ALL_ORDERS')) {
    return {};
  }

  // Limited-access roles only see orders that are explicitly assigned to them.
  return { assignedUserId: user.id };
}

export async function canAccessOrder(user: AuthenticatedUser, orderId: string): Promise<boolean> {
  if (user.permissions.includes('VIEW_ALL_ORDERS')) {
    return true;
  }

  // Limited-access roles can access only their assigned orders.
  const order = await withRetry(() => prisma.order.findFirst({
    where: {
      id: orderId,
      assignedUserId: user.id,
    },
    select: { id: true },
  }));
  return Boolean(order);
}

export async function createInitialAdminUser(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? 'System Administrator';

  if (!email || !password) {
    console.warn('ADMIN_EMAIL and ADMIN_PASSWORD must be set to provision the initial admin user.');
    return;
  }

  const existing = await withRetry(() => prisma.user.findFirst({ where: { email } }));
  if (existing) {
    if (!existing.password) {
      const passwordHash = await hashPassword(password);
      await withRetry(() => prisma.user.update({
        where: { id: existing.id },
        data: { password: passwordHash, role: 'ADMIN', isActive: true, name },
      }));
    }
    return;
  }

  const passwordHash = await hashPassword(password);
  await withRetry(() => prisma.user.create({
    data: {
      email,
      name,
      role: 'ADMIN',
      password: passwordHash,
      isActive: true,
    },
  }));
}
