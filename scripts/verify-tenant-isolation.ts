import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { prisma, withIdentityDatabase, closeDatabaseConnection } from '../lib/db';
import { withTenantContext } from '../lib/tenancy/context';
import { resolveTenantMembership } from '../lib/tenancy/session';
import { CacheManager } from '../lib/cache';

async function main() {
  const url = new URL(process.env.DATABASE_URL || '');
  assert(['localhost', '127.0.0.1', '::1'].includes(url.hostname), 'Only a disposable local database is permitted');
  assert(/^retzef_.*test/.test(url.pathname.slice(1)), 'A retzef_*test database is required');
  assert.equal(process.env.TENANT_ENFORCEMENT, 'true');
  const run = randomUUID();
  const userA = randomUUID();
  const userB = randomUUID();
  const tenantA = `a-${run}`;
  const tenantB = `b-${run}`;
  await withIdentityDatabase(async (db) => {
    await db.tenant.create({ data: { id: tenantA, name: 'Synthetic business A' } });
    await db.tenant.create({ data: { id: tenantB, name: 'Synthetic business B' } });
    for (const [userId, tenantId] of [[userA, tenantA], [userB, tenantB]]) {
      await db.user.create({ data: { id: userId, email: `${userId}@example.invalid`, name: 'Synthetic member', role: 'ADMIN' } });
      await db.tenantMembership.create({ data: { tenantId, userId, role: 'ADMIN' } });
    }
  });
  const a = <T>(action: () => T) => withTenantContext({ tenantId: tenantA, userId: userA, role: 'ADMIN' }, action);
  const b = <T>(action: () => T) => withTenantContext({ tenantId: tenantB, userId: userB, role: 'ADMIN' }, action);
  const customerA = await a(() => prisma.customer.create({ data: { name: 'A customer' } }));
  const customerB = await b(() => prisma.customer.create({ data: { name: 'B customer' } }));
  assert.equal(customerA.tenantId, tenantA);
  assert.equal(customerB.tenantId, tenantB);
  assert.equal(await a(() => prisma.customer.findUnique({ where: { id: customerB.id } })), null);
  assert.equal(await a(() => prisma.customer.count()), 1);
  assert.equal(await b(() => prisma.customer.count()), 1);
  await assert.rejects(a(() => prisma.customer.update({ where: { id: customerB.id }, data: { name: 'tampered' } })));
  await assert.rejects(a(() => prisma.customer.update({ where: { id: customerA.id }, data: { tenantId: tenantB } })));
  await assert.rejects(a(() => prisma.address.create({ data: { customerId: customerB.id, type: 'SHIPPING', city: 'Synthetic', street: 'Test', number: '1' } })));
  await Promise.all([
    a(() => prisma.product.create({ data: { name: 'A product', sku: 'SAME-SKU', wooId: 42 } })),
    b(() => prisma.product.create({ data: { name: 'B product', sku: 'SAME-SKU', wooId: 42 } })),
  ]);
  const addressA = await a(() => prisma.address.create({ data: { customerId: customerA.id, type: 'SHIPPING', city: 'Synthetic', street: 'Test', number: '1' } }));
  const addressB = await b(() => prisma.address.create({ data: { customerId: customerB.id, type: 'SHIPPING', city: 'Synthetic', street: 'Test', number: '1' } }));
  const orderA = await a(() => prisma.order.create({ data: { number: 'SAME-ORDER', wooOrderId: '42', currency: 'ILS', billingAddressId: addressA.id, shippingAddressId: addressA.id, customerId: customerA.id } }));
  const orderB = await b(() => prisma.order.create({ data: { number: 'SAME-ORDER', wooOrderId: '42', currency: 'ILS', billingAddressId: addressB.id, shippingAddressId: addressB.id, customerId: customerB.id } }));
  const labelB = await b(() => prisma.label.create({ data: { name: 'Synthetic label', color: '#000000' } }));
  await assert.rejects(a(() => prisma.order.update({ where: { id: orderA.id }, data: { labels: { connect: { id: labelB.id } } } })));
  await assert.rejects(a(() => prisma.order.update({ where: { id: orderA.id }, data: { assignedUserId: userB } })));
  assert.equal((await a(() => prisma.$executeRaw`DELETE FROM orders WHERE id = ${orderA.id}::uuid`)), 0);
  assert.equal(await b(() => prisma.order.count()), 1);
  assert.equal(orderB.tenantId, tenantB);
  await Promise.all(Array.from({ length: 12 }, (_, i) => (i % 2 ? a : b)(async () => {
    const expected = i % 2 ? tenantA : tenantB;
    const rows = await prisma.customer.findMany();
    assert(rows.every((row) => row.tenantId === expected));
  })));
  const cache = new CacheManager({ prefix: 'synthetic' });
  await a(() => cache.set('same:key', 'A'));
  assert.equal(await b(() => cache.get('same:key')), null);
  await b(() => cache.set('same:key', 'B'));
  await a(() => cache.clearPattern('*'));
  assert.equal(await a(() => cache.get('same:key')), null);
  assert.equal(await b(() => cache.get('same:key')), 'B');
  cache.dispose();
  const rawRows = await a(() => prisma.$queryRaw<Array<{ tenant_id: string }>>`SELECT tenant_id FROM customers`);
  assert.deepEqual(rawRows.map((row) => row.tenant_id), [tenantA]);
  await assert.rejects(a(() => prisma.$transaction(async (db) => {
    await db.customer.update({ where: { id: customerA.id }, data: { name: 'must roll back' } });
    throw new Error('synthetic rollback');
  })));
  assert.equal((await a(() => prisma.customer.findUniqueOrThrow({ where: { id: customerA.id } }))).name, 'A customer');
  await assert.rejects(prisma.customer.findMany());
  await assert.rejects(resolveTenantMembership(userA, tenantB));
  await withIdentityDatabase((db) => db.tenantMembership.update({ where: { tenantId_userId: { tenantId: tenantA, userId: userA } }, data: { isActive: false } }));
  await assert.rejects(resolveTenantMembership(userA, tenantA));
  console.log(JSON.stringify({ passed: true, checks: ['default ownership', 'list isolation', 'ID isolation', 'write isolation', 'ownership immutability', 'cross-business references', 'duplicate SKU and external ID', 'raw SQL scope', 'transaction rollback', 'missing context', 'forged business selection', 'membership revocation', 'duplicate order number and Woo ID', 'implicit join isolation', 'assigned member isolation', 'raw hard delete prevention', 'concurrent connection context', 'cache read and invalidation isolation'] }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => closeDatabaseConnection());
