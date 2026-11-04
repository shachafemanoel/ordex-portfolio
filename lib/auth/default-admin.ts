import { Prisma, UserRole } from '@prisma/client';

import { prisma } from '@/lib/db';
import { ensureUserRoleEnumCompatibility } from '@/lib/db/user-role-compat';
import { hashPassword, verifyPassword } from '@/lib/auth/hash';
import {
  getDefaultAdminEmail,
  getDefaultAdminName,
  getDefaultAdminPassword,
} from './defaults';

export interface EnsureDefaultAdminResult {
  userId: string;
  email: string;
  created: boolean;
  updated: boolean;
  passwordReset: boolean;
}

function getDefaultAdminConfig() {
  const email = getDefaultAdminEmail();
  const name = getDefaultAdminName();
  const password = getDefaultAdminPassword();

  return { email, name, password };
}

export async function ensureDefaultAdminUser(): Promise<EnsureDefaultAdminResult> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Default admin bootstrap is disabled in production. Use invitation-based provisioning.');
  }
  await ensureUserRoleEnumCompatibility();

  const { email, name, password } = getDefaultAdminConfig();

  const existing = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      role: true,
      isActive: true,
      password: true,
    },
  });

  if (!existing) {
    const passwordHash = await hashPassword(password);
    const created = await prisma.user.create({
      data: {
        email,
        name,
        password: passwordHash,
        role: UserRole.ADMIN,
        isActive: true,
      },
      select: { id: true },
    });

    return {
      userId: created.id,
      email,
      created: true,
      updated: false,
      passwordReset: true,
    };
  }

  if (existing.password) {
    const isMatch = await verifyPassword(password, existing.password);
    if (!isMatch) {
      console.warn(
        `[Auth] Default admin user (${email}) exists but password DOES NOT match the configured default password.`
      );
      console.warn(`[Auth] Login might fail if you expect the default password.`);
    }
  }

  const updates: Prisma.UserUpdateInput = {};
  let passwordReset = false;

  if (!existing.password) {
    const passwordHash = await hashPassword(password);
    updates.password = passwordHash;
    passwordReset = true;
  }

  if (existing.role !== UserRole.ADMIN) {
    updates.role = UserRole.ADMIN;
  }

  if (!existing.isActive) {
    updates.isActive = true;
  }

  if (!existing.name?.trim()) {
    updates.name = name;
  }

  const updated = Object.keys(updates).length > 0;

  if (updated) {
    await prisma.user.update({
      where: { id: existing.id },
      data: updates,
    });
  }

  return {
    userId: existing.id,
    email,
    created: false,
    updated,
    passwordReset,
  };
}
