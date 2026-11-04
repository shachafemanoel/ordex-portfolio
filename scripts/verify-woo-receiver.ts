import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { closeDatabaseConnection, prisma, withIdentityDatabase } from '../lib/db';
import { newWebhookSecret, sealCredentials } from '../lib/integrations/woocommerce/credentials';
import { receiveStoreEvent } from '../lib/integrations/woocommerce/receiver';
import { withTenantContext } from '../lib/tenancy/context';

// WooCommerce events against the real database, row-level security included: each event lands with
// the business whose webhook it came through, once, and an older delivery never replaces a newer one.
// Disposable local databases only.
async function main() {
  const url = new URL(process.env.DATABASE_URL || '');
  assert(['localhost', '127.0.0.1', '::1'].includes(url.hostname), 'Only a disposable local database is permitted');
  assert(/^retzef_.*test/.test(url.pathname.slice(1)), 'A retzef_*test database is required');
  assert.equal(process.env.TENANT_ENFORCEMENT, 'true');

  const businesses = await Promise.all(['A', 'B'].map(async (name) => {
    const tenantId = `woo-${name}-${randomUUID()}`;
    const userId = randomUUID();
    const integrationId = randomUUID();
    const secret = newWebhookSecret();
    await withIdentityDatabase(async (db) => {
      await db.tenant.create({ data: { id: tenantId, name: `Synthetic store ${name}` } });
      await db.user.create({ data: { id: userId, email: `${userId}@example.invalid`, name: 'WooCommerce', role: 'OPERATIONS', isActive: false } });
    });
    await withTenantContext({ tenantId, userId, role: 'ADMIN' }, () =>
      prisma.wooIntegration.create({
        data: {
          id: integrationId,
          baseUrl: 'https://shop.example.invalid',
          credentials: sealCredentials({ consumerKey: 'ck_x', consumerSecret: 'cs_x', webhookSecret: secret }),
          serviceUserId: userId,
        },
      })
    );
    return { tenantId, userId, integrationId, secret };
  }));
  const [a, b] = businesses;

  const deliver = (to: typeof a, order: Record<string, unknown>, secret = to.secret, topic = 'order.updated') => {
    const raw = JSON.stringify(order);
    const headers = new Headers({
      'content-type': 'application/json',
      'x-wc-webhook-topic': topic,
      'x-wc-webhook-signature': createHmac('sha256', secret).update(raw).digest('base64'),
    });
    return receiveStoreEvent({ integrationId: to.integrationId, headers, rawBody: Buffer.from(raw) });
  };
  const inA = <T>(action: () => Promise<T>) => withTenantContext({ tenantId: a.tenantId, userId: a.userId, role: 'ADMIN' }, action);
  const inB = <T>(action: () => Promise<T>) => withTenantContext({ tenantId: b.tenantId, userId: b.userId, role: 'ADMIN' }, action);

  const newer = { id: 501, status: 'processing', date_modified_gmt: '2026-10-29T10:00:00', total: '450.00' };
  const older = { ...newer, status: 'on-hold', date_modified_gmt: '2026-10-29T09:00:00' };

  assert.equal((await deliver(a, newer)).outcome, 'stored');
  assert.equal((await deliver(a, newer)).outcome, 'duplicate');
  assert.equal((await deliver(a, older)).outcome, 'stored');

  const stored = await inA(() => prisma.inboundOrder.findMany({ where: { sourceOrderId: '501' } }));
  assert.equal(stored.length, 1, 'One inbound record per store order');
  assert.equal((stored[0].rawPayload as { status: string }).status, 'processing', 'A late, older delivery must not replace the newer one');
  assert.equal(stored[0].tenantId, a.tenantId);
  assert.equal(await inA(() => prisma.wooSyncJob.count({ where: { objectId: '501' } })), 2, 'One job per distinct order version');

  assert.equal((await deliver(a, { ...newer, id: 502 }, b.secret)).status, 401, "Another business's secret must not be accepted");
  assert.equal((await deliver(b, { ...newer, id: 503 })).outcome, 'stored');

  assert.equal(await inB(() => prisma.inboundOrder.count({ where: { sourceOrderId: '501' } })), 0, 'Business B cannot see A’s events');
  assert.equal(await inA(() => prisma.inboundOrder.count({ where: { sourceOrderId: '503' } })), 0, 'Business A cannot see B’s events');
  assert.equal(await inA(() => prisma.inboundOrder.count({ where: { sourceOrderId: '502' } })), 0, 'A rejected event leaves nothing behind');
  assert((await inA(() => prisma.wooIntegration.findUniqueOrThrow({ where: { id: a.integrationId } }))).lastEventAt);

  await inA(() => prisma.wooIntegration.update({ where: { id: a.integrationId }, data: { status: 'DISABLED', enabled: false } }));
  assert.equal((await deliver(a, { ...newer, id: 504 })).status, 404, 'A disconnected store is not accepted');

  console.log(JSON.stringify({
    passed: true,
    checks: ['stored with its business', 'duplicate delivery', 'older delivery does not overwrite', 'foreign secret rejected', 'isolation between businesses', 'disconnected store rejected'],
  }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => closeDatabaseConnection());
