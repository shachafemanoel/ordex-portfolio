import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { closeDatabaseConnection, prisma, withIdentityDatabase } from '../lib/db';
import { sealCredentials } from '../lib/integrations/woocommerce/credentials';
import { claimJob, enqueue, inStore, processClaim } from '../lib/integrations/woocommerce/jobs';
import { processOrder } from '../lib/integrations/woocommerce/processor';
import { startMockStore, wooOrder } from '../tests/support/wooMockStore';

async function main() {
  const url = new URL(process.env.DATABASE_URL || '');
  assert(
    ['localhost', '127.0.0.1'].includes(url.hostname) &&
      /^retzef_.*test/.test(url.pathname.slice(1))
  );
  assert.equal(process.env.TENANT_ENFORCEMENT, 'true');
  const store = await startMockStore();
  try {
    const businesses = [];
    for (const label of ['A', 'B']) {
      const tenantId = `processor-${label}-${randomUUID()}`,
        userId = randomUUID();
      await withIdentityDatabase(async (db) => {
        await db.tenant.create({ data: { id: tenantId, name: 'Synthetic processor ' + label } });
        await db.user.create({
          data: {
            id: userId,
            name: 'Woo service',
            email: `${userId}@example.invalid`,
            isActive: false,
            role: 'OPERATIONS',
          },
        });
        await db.tenantMembership.create({ data: { tenantId, userId, role: 'OPERATIONS' } });
      });
      const integration = await (
        await import('../lib/tenancy/context')
      ).withTenantContext({ tenantId, userId, role: 'ADMIN' }, () =>
        prisma.wooIntegration.create({
          data: {
            baseUrl: store.url,
            credentials: sealCredentials({ ...store.keys, webhookSecret: 'synthetic' }),
            serviceUserId: userId,
          },
        })
      );
      businesses.push(integration);
    }
    const [a, b] = businesses;
    const inA = <T>(action: () => Promise<T>) => inStore(a, action);
    const inB = <T>(action: () => Promise<T>) => inStore(b, action);
    const source = wooOrder(501);
    store.orders.set(501, source);
    const add = (version: string, kind = 'ORDER_IMPORT', payload = source) =>
      inA(() => prisma.$transaction((tx) => enqueue(tx, a.id, kind, '501', version, payload)));
    const consume = () =>
      inA(async () => {
        const j = await claimJob(a.id, 'test-worker');
        assert(j);
        await processClaim(a, j);
        return j;
      });
    await Promise.all([add('1'), add('1')]);
    assert.equal(await inA(() => prisma.wooSyncJob.count()), 1);
    const claims = await inA(() =>
      Promise.all([claimJob(a.id, 'worker-1'), claimJob(a.id, 'worker-2')])
    );
    assert.equal(claims.filter(Boolean).length, 1, 'atomic claim');
    const claim = claims.find(Boolean)!;
    await inA(() => processClaim(a, claim));
    const job = await inA(() => prisma.wooSyncJob.findUniqueOrThrow({ where: { id: claim.id } }));
    assert.equal(job.state, 'SUCCEEDED', JSON.stringify({ code: job.lastErrorCode }));
    const order = await inA(() =>
      prisma.order.findFirstOrThrow({ where: { wooOrderId: '501' }, include: { items: true } })
    );
    assert.equal(order.status, 'RECEIVED');
    assert.equal(order.items.length, 1);
    assert.equal(order.paidAmountCents, 0);
    await inA(() =>
      prisma.address.update({
        where: { id: order.shippingAddressId },
        data: { street: 'כתובת מקומית' },
      })
    );
    await inA(() =>
      prisma.order.update({
        where: { id: order.id },
        data: { notesInternal: 'Keep me', scheduledAt: new Date('2026-11-02T08:00:00Z') },
      })
    );
    await inA(() =>
      prisma.orderItem.update({ where: { id: order.items[0].id }, data: { received: true } })
    );
    const newer = wooOrder(501, {
      date_modified_gmt: '2026-10-29T10:00:00',
      date_paid_gmt: '2026-10-29T09:00:00',
    });
    await add('2', 'ORDER_IMPORT', newer);
    await consume();
    const changed = await inA(() =>
      prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { shippingAddress: true, items: true },
      })
    );
    assert.equal(changed.shippingAddress.street, 'כתובת מקומית');
    assert.equal(changed.addressOverridden, true);
    assert.equal(changed.notesInternal, 'Keep me');
    assert(changed.scheduledAt);
    assert.equal(changed.items[0].received, true);
    assert.equal(changed.paidAmountCents, 45000);
    await add('old');
    await consume();
    assert.equal(
      (
        await inA(() => prisma.order.findUniqueOrThrow({ where: { id: order.id } }))
      ).sourceModifiedAt!.toISOString(),
      '2026-10-29T10:00:00.000Z'
    );
    await inB(() =>
      prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT set_config('app.woo_sync','1',true)`;
        await processOrder(tx, b, source);
      })
    );
    assert.equal(await inA(() => prisma.order.count()), 1);
    assert.equal(await inB(() => prisma.order.count()), 1);
    assert.equal(await inB(() => prisma.order.findUnique({ where: { id: order.id } })), null);
    await assert.rejects(
      inA(() => prisma.order.update({ where: { id: order.id }, data: { paidAmountCents: 99 } })),
      /read only/
    );
    await assert.rejects(
      inA(() => prisma.orderItem.update({ where: { id: order.items[0].id }, data: { qty: 3 } })),
      /read only/
    );
    // Simulate a crash: leave a lease and make it expire. The old claim must be fenced out.
    await add('crash');
    const stale = await inA(() => claimJob(a.id, 'crashed'));
    assert(stale);
    await inA(() =>
      prisma.wooSyncJob.update({ where: { id: stale.id }, data: { lockedUntil: new Date(0) } })
    );
    const recovered = await inA(() => claimJob(a.id, 'restarted'));
    assert(recovered);
    assert.notEqual(stale.lockedBy, recovered.lockedBy);
    await inA(() => processClaim(a, stale));
    assert.equal(
      (await inA(() => prisma.wooSyncJob.findUniqueOrThrow({ where: { id: stale.id } }))).state,
      'RUNNING'
    );
    await inA(() => processClaim(a, recovered));
    assert.equal(
      (await inA(() => prisma.wooSyncJob.findUniqueOrThrow({ where: { id: stale.id } }))).state,
      'SUCCEEDED'
    );
    await add('invalid', 'ORDER_IMPORT', wooOrder(501, { total: '1.00' }));
    const bad = await consume();
    assert.equal(
      (await inA(() => prisma.wooSyncJob.findUniqueOrThrow({ where: { id: bad.id } }))).state,
      'NEEDS_ATTENTION'
    );
    await add('revoked', 'ORDER_EVENT');
    store.revoke();
    const revoked = await consume();
    assert.equal(
      (await inA(() => prisma.wooSyncJob.findUniqueOrThrow({ where: { id: revoked.id } })))
        .lastErrorCode,
      'UNAUTHORIZED'
    );
    console.log(
      JSON.stringify({
        passed: true,
        checks: [
          'deduplication',
          'parallel claim',
          'atomic order/customer/address/items/history',
          'RECEIVED and unpaid defaults',
          'local field preservation',
          'out-of-order version',
          'cross-business IDs',
          'store commerce protected',
          'crash recovery',
          'stale worker fencing',
          'invalid totals require review',
          'revoked credentials require review',
        ],
      })
    );
  } finally {
    await store.close();
  }
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => closeDatabaseConnection());
