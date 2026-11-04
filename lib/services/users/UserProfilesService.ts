import { prisma } from '@/lib/db';
import { UserRole } from '@prisma/client';

export async function getUserWithProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      installerProfile: true,
      salesProfile: true,
      opsProfile: true,
    },
  });
  return user;
}

export async function upsertProfile(userId: string, role: UserRole, payload: any) {
  // All roles use the ops profile in the two-role system
  return prisma.opsProfile.upsert({
    where: { id: userId },
    update: payload,
    create: { id: userId, ...payload },
  });
}

export async function listUsersWithProfiles(role?: UserRole) {
  return prisma.user.findMany({
    where: role ? { role } : undefined,
    include: {
      installerProfile: true,
      salesProfile: true,
      opsProfile: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}
