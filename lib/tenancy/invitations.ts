import { ApiError } from '@/lib/api-middleware';
import { hashPassword, verifyPassword } from '@/lib/auth/hash';
import type { SessionUser } from '@/lib/auth/types';
import { prisma, withIdentityDatabase } from '@/lib/db';
import type { TenantRole } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { requireTenantContext } from './context';

const digest = (token: string) => createHash('sha256').update(token).digest('hex');

export function invitationCredentials() {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: digest(token), expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000) };
}

export async function inviteMember(email: string, role: TenantRole) {
  const context = await requireTenantContext();
  if (context.role !== 'ADMIN') throw new ApiError('FORBIDDEN', 'נדרשת הרשאת מנהל עסק', 403);
  const credentials = invitationCredentials();
  const invitation = await prisma.tenantInvitation.create({
    data: {
      email: email.trim().toLowerCase(),
      role,
      tokenHash: credentials.tokenHash,
      expiresAt: credentials.expiresAt,
    },
    select: { id: true, email: true, role: true, expiresAt: true },
  });
  return { ...invitation, token: credentials.token };
}

export async function acceptInvitation(input: {
  token: string;
  password: string;
  name: string;
}): Promise<SessionUser> {
  // Serialize uses of the one-time token; existing accounts authenticate with their existing password.
  return withIdentityDatabase(async (db) => {
    const tokenHash = digest(input.token);
    await db.$queryRaw`SELECT id FROM tenant_invitations WHERE token_hash = ${tokenHash} FOR UPDATE`;
    const invitation = await db.tenantInvitation.findUnique({
      where: { tokenHash },
      include: { tenant: true },
    });
    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.revokedAt ||
      invitation.expiresAt <= new Date() ||
      !invitation.tenant.isActive
    ) {
      throw new ApiError(
        'INVALID_INVITATION',
        'ההזמנה אינה תקפה. יש לבקש קישור חדש ממנהל העסק',
        400
      );
    }
    let user = await db.user.findUnique({ where: { email: invitation.email } });
    if (user) {
      if (!user.isActive || !(await verifyPassword(input.password, user.password || ''))) {
        throw new ApiError(
          'INVALID_CREDENTIALS',
          'לחשבון קיים יש להזין את הסיסמה הנוכחית שלו',
          401
        );
      }
      const current = await db.tenantMembership.findUnique({
        where: { tenantId_userId: { tenantId: invitation.tenantId, userId: user.id } },
      });
      if (current?.isActive)
        throw new ApiError('ALREADY_MEMBER', 'החשבון כבר חבר בעסק. יש להיכנס לחשבון', 409);
    } else {
      if (input.password.length < 12)
        throw new ApiError('WEAK_PASSWORD', 'יש לבחור סיסמה בת 12 תווים לפחות', 400);
      user = await db.user.create({
        data: {
          email: invitation.email,
          name: input.name.trim(),
          password: await hashPassword(input.password),
          role: 'OPERATIONS',
        },
      });
    }
    await db.tenantMembership.upsert({
      where: { tenantId_userId: { tenantId: invitation.tenantId, userId: user.id } },
      create: { tenantId: invitation.tenantId, userId: user.id, role: invitation.role },
      update: { isActive: true, role: invitation.role },
    });
    await db.tenantInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    });
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      tenantId: invitation.tenantId,
      role: invitation.role,
      sessionVersion: user.sessionVersion,
    };
  });
}

export async function revokeMembership(membershipId: string): Promise<void> {
  const context = await requireTenantContext();
  if (context.role !== 'ADMIN') throw new ApiError('FORBIDDEN', 'נדרשת הרשאת מנהל עסק', 403);
  await prisma.$transaction(async (db) => {
    // Serializes admin removals so two concurrent requests cannot remove both final admins.
    await db.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${context.tenantId}, 0))::text`;
    const member = await db.tenantMembership.findUnique({ where: { id: membershipId } });
    if (!member || member.tenantId !== context.tenantId)
      throw new ApiError('NOT_FOUND', 'החברות לא נמצאה', 404);
    if (member.isActive && member.role === 'ADMIN') {
      const admins = await db.tenantMembership.count({
        where: { tenantId: context.tenantId, role: 'ADMIN', isActive: true },
      });
      if (admins <= 1) throw new ApiError('LAST_ADMIN', 'לא ניתן לבטל את המנהל האחרון בעסק', 409);
    }
    await db.tenantMembership.update({ where: { id: member.id }, data: { isActive: false } });
  });
}
