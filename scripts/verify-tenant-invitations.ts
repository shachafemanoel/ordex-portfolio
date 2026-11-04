import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { hashPassword } from '../lib/auth/hash';
import { createSessionToken } from '../lib/auth/tokens';
import { closeDatabaseConnection, prisma, withIdentityDatabase } from '../lib/db';
import { withTenantContext } from '../lib/tenancy/context';
import { acceptInvitation, inviteMember, revokeMembership } from '../lib/tenancy/invitations';
import { NextRequest } from 'next/server';
import { RateLimiter } from '../lib/rate-limit';
import { resolveTenantSession } from '../lib/tenancy/session';

async function main() {
  const url = new URL(process.env.DATABASE_URL || '');
  assert(
    ['localhost', '127.0.0.1', '::1'].includes(url.hostname) &&
      /^retzef_.*test/.test(url.pathname.slice(1)),
    'Disposable local test database required'
  );
  assert.equal(process.env.TENANT_ENFORCEMENT, 'true');
  const limiterKey = randomUUID();
  const limiterConfig = { max: 1, windowMs: 60000, keyGenerator: () => limiterKey };
  const request = new NextRequest('http://localhost/api/invitations/accept');
  assert.equal((await new RateLimiter(limiterConfig).check(request)).allowed, true);
  assert.equal((await new RateLimiter(limiterConfig).check(request)).allowed, false);
  const tenantA = randomUUID(),
    tenantB = randomUUID(),
    adminA = randomUUID(),
    adminB = randomUUID();
  const password = 'synthetic-invitation-password';
  const passwordHash = await hashPassword(password);
  await withIdentityDatabase(async (db) => {
    for (const [id, tenantId] of [
      [adminA, tenantA],
      [adminB, tenantB],
    ]) {
      await db.tenant.create({ data: { id: tenantId, name: 'Synthetic business' } });
      await db.user.create({
        data: {
          id,
          email: `${id}@example.invalid`,
          name: 'Synthetic admin',
          password: passwordHash,
          role: 'OPERATIONS',
        },
      });
      await db.tenantMembership.create({ data: { tenantId, userId: id, role: 'ADMIN' } });
    }
  });
  const a = <T>(action: () => T) =>
    withTenantContext({ tenantId: tenantA, userId: adminA, role: 'ADMIN' }, action);
  const b = <T>(action: () => T) =>
    withTenantContext({ tenantId: tenantB, userId: adminB, role: 'ADMIN' }, action);
  assert.equal(await a(() => prisma.customer.count()), 0);
  const invite = await a(() => inviteMember(`${randomUUID()}@example.invalid`, 'OPERATIONS'));
  const stored = await a(() =>
    prisma.tenantInvitation.findUniqueOrThrow({ where: { id: invite.id } })
  );
  assert.equal(stored.tokenHash, createHash('sha256').update(invite.token).digest('hex'));
  assert(!JSON.stringify(stored).includes(invite.token));
  const accepted = await Promise.allSettled([
    acceptInvitation({ token: invite.token, name: 'Synthetic employee', password }),
    acceptInvitation({ token: invite.token, name: 'Synthetic employee', password }),
  ]);
  assert.equal(accepted.filter((result) => result.status === 'fulfilled').length, 1);
  const employee = (
    accepted.find((result) => result.status === 'fulfilled') as PromiseFulfilledResult<
      Awaited<ReturnType<typeof acceptInvitation>>
    >
  ).value;
  assert.equal(employee.tenantId, tenantA);
  assert.equal(employee.role, 'OPERATIONS');
  const token = createSessionToken(employee, 3600);
  assert.equal((await resolveTenantSession(token)).tenantId, tenantA);
  await assert.rejects(
    withTenantContext({ tenantId: tenantA, userId: employee.id, role: 'OPERATIONS' }, () =>
      inviteMember('forbidden@example.invalid', 'ADMIN')
    )
  );
  const membership = await a(() =>
    prisma.tenantMembership.findUniqueOrThrow({
      where: { tenantId_userId: { tenantId: tenantA, userId: employee.id } },
    })
  );
  await assert.rejects(b(() => revokeMembership(membership.id)));
  await a(() => revokeMembership(membership.id));
  await assert.rejects(resolveTenantSession(token));
  const revoked = await a(() => inviteMember(`${randomUUID()}@example.invalid`, 'ADMIN'));
  await a(() =>
    prisma.tenantInvitation.update({ where: { id: revoked.id }, data: { revokedAt: new Date() } })
  );
  await assert.rejects(acceptInvitation({ token: revoked.token, name: 'Revoked', password }));
  const expired = await a(() => inviteMember(`${randomUUID()}@example.invalid`, 'ADMIN'));
  await a(() =>
    prisma.tenantInvitation.update({ where: { id: expired.id }, data: { expiresAt: new Date(0) } })
  );
  await assert.rejects(acceptInvitation({ token: expired.token, name: 'Expired', password }));
  const shared = await b(() => inviteMember(`${adminA}@example.invalid`, 'OPERATIONS'));
  await assert.rejects(
    acceptInvitation({
      token: shared.token,
      name: 'Takeover attempt',
      password: 'wrong-synthetic-password',
    })
  );
  const sharedUser = await acceptInvitation({
    token: shared.token,
    name: 'Ignored name',
    password,
  });
  assert.equal(sharedUser.id, adminA);
  assert.equal(sharedUser.role, 'OPERATIONS');
  const sharedToken = createSessionToken(sharedUser, 3600);
  await withIdentityDatabase((db) =>
    db.user.update({ where: { id: adminA }, data: { sessionVersion: { increment: 1 } } })
  );
  await assert.rejects(resolveTenantSession(sharedToken));
  const adminMembership = await a(() =>
    prisma.tenantMembership.findUniqueOrThrow({
      where: { tenantId_userId: { tenantId: tenantA, userId: adminA } },
    })
  );
  await assert.rejects(a(() => revokeMembership(adminMembership.id)));
  await withIdentityDatabase((db) =>
    db.tenantMembership.update({
      where: { id: membership.id },
      data: { isActive: true, role: 'ADMIN' },
    })
  );
  const removals = await Promise.allSettled([
    a(() => revokeMembership(adminMembership.id)),
    a(() => revokeMembership(membership.id)),
  ]);
  assert.equal(removals.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(
    await a(() =>
      prisma.tenantMembership.count({ where: { tenantId: tenantA, role: 'ADMIN', isActive: true } })
    ),
    1
  );
  console.log(
    JSON.stringify({
      passed: true,
      checks: [
        'empty business',
        'hashed one-time token',
        'concurrent acceptance exactly once',
        'bound tenant and role',
        'staff invitation forbidden',
        'foreign membership removal forbidden',
        'revocation invalidates session',
        'revoked link',
        'expired link',
        'existing identity requires password',
        'shared identity preserves role boundary',
        'recovery revokes sessions',
        'last admin retained under concurrency',
        'pre-authentication rate limit persists across instances',
      ],
    })
  );
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeDatabaseConnection());
