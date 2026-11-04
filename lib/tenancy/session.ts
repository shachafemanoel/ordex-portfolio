import { withIdentityDatabase } from '@/lib/db';
import { AuthenticationError } from '@/lib/auth/errors';
import { verifySessionToken } from '@/lib/auth/tokens';
import type { TenantContext } from './context';

export async function resolveTenantMembership(userId: string, tenantId?: string): Promise<TenantContext> {
  const membership = await withIdentityDatabase((tx) => tx.tenantMembership.findFirst({
    where: { userId, ...(tenantId ? { tenantId } : {}), isActive: true, user: { isActive: true }, tenant: { isActive: true } },
    orderBy: { createdAt: 'asc' },
    select: { tenantId: true, userId: true, role: true },
  }));
  if (!membership) throw new AuthenticationError('Active business membership required');
  return membership;
}

export async function resolveTenantSession(token: string): Promise<TenantContext> {
  const payload = verifySessionToken(token);
  const user = await withIdentityDatabase((db) => db.user.findUnique({ where: { id: payload.sub }, select: { sessionVersion: true, isActive: true } }));
  if (!user?.isActive || user.sessionVersion !== (payload.sessionVersion ?? 0)) throw new AuthenticationError('Session has been revoked');
  return resolveTenantMembership(payload.sub, payload.tenantId);
}
