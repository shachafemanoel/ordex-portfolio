/**
 * Server-only user functions that require Prisma
 * DO NOT import this file from client components
 *
 * This file is intentionally separated from user.ts to prevent Prisma
 * from being bundled into client-side code.
 */

import { withIdentityDatabase } from '@/lib/db';
import { ensureUserRoleEnumCompatibility } from '@/lib/db/user-role-compat';

import type { AuthenticatedUser, SessionUser } from '@/lib/auth/types';
import { toAuthenticatedUser } from '@/lib/auth/types';
import { normalizeRoleKey } from '@/lib/auth/user';

export async function findSessionUserById(userId: string): Promise<AuthenticatedUser | null> {
  await ensureUserRoleEnumCompatibility();

  const user = await withIdentityDatabase((db) => db.user.findUnique({
    where: { id: userId },
    select: {
      sessionVersion: true,
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
    },
  }));

  if (!user || !user.isActive) {
    return null;
  }

  const normalizedRole = normalizeRoleKey(user.role);
  const sessionUser: SessionUser = {
    sessionVersion: user.sessionVersion,
    id: user.id,
    email: user.email,
    name: user.name,
    role: normalizedRole,
  };

  return toAuthenticatedUser(sessionUser);
}

export async function findSessionUserByEmail(email: string): Promise<AuthenticatedUser | null> {
  await ensureUserRoleEnumCompatibility();

  const user = await withIdentityDatabase((db) => db.user.findUnique({
    where: { email },
    select: {
      sessionVersion: true,
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
    },
  }));

  if (!user || !user.isActive) {
    return null;
  }

  const normalizedRole = normalizeRoleKey(user.role);
  const sessionUser: SessionUser = {
    sessionVersion: user.sessionVersion,
    id: user.id,
    email: user.email,
    name: user.name,
    role: normalizedRole,
  };

  return toAuthenticatedUser(sessionUser);
}
