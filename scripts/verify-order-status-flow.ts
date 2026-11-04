import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { closeDatabaseConnection, prisma, withIdentityDatabase } from '../lib/db';
import { getProductionOrdersService } from '../lib/services/production';
import { withTenantContext } from '../lib/tenancy/context';

// Walks one synthetic order through the MVP status flow with the real service, repository,
// row-level security and status history. Disposable local databases only.
async function main() {
  const url = new URL(process.env.DATABASE_URL || '');
  assert(['localhost', '127.0.0.1', '::1'].includes(url.hostname), 'Only a disposable local database is permitted');
  assert(/^retzef_.*test/.test(url.pathname.slice(1)), 'A retzef_*test database is required');
  assert.equal(process.env.TENANT_ENFORCEMENT, 'true');

  const tenantId = `flow-${randomUUID()}`;
  const userId = randomUUID();
  await withIdentityDatabase(async (db) => {
    await db.tenant.create({ data: { id: tenantId, name: 'Synthetic order flow' } });
    await db.user.create({ data: { id: userId, email: `${userId}@example.invalid`, name: 'Synthetic operator', role: 'OPERATIONS' } });
    await db.tenantMembership.create({ data: { tenantId, userId, role: 'OPERATIONS' } });
  });
  const run = <T>(action: () => Promise<T>) => withTenantContext({ tenantId, userId, role: 'OPERATIONS' }, action);
  const service = getProductionOrdersService();
  const move = (orderId: string, newStatus: string, reason?: string) =>
    run(() => service.changeOrderStatus(orderId, { newStatus: newStatus as never, reason }, userId));
  const status = async (orderId: string) => (await run(() => prisma.order.findUniqueOrThrow({ where: { id: orderId } }))).status;

  const customer = await run(() => prisma.customer.create({ data: { name: 'דנה כהן', phone: '0521234567' } }));
  const address = await run(() => prisma.address.create({ data: { customerId: customer.id, type: 'SHIPPING', city: 'חיפה', street: 'הרצל', number: '5' } }));
  const order = await run(() => prisma.order.create({
    data: {
      number: `FLOW-${tenantId.slice(5, 13)}`,
      currency: 'ILS',
      status: 'RECEIVED',
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      billingAddressId: address.id,
      shippingAddressId: address.id,
      items: { create: [{ name: 'ספה', sku: 'SOFA-3', qty: 1, priceCents: 450000, vatCategory: 'STANDARD', totalCents: 450000 }] },
    },
    include: { items: true },
  }));

  await assert.rejects(move(order.id, 'COMPLETED'), /לא ניתן לעבור/);
  await move(order.id, 'PROCESSING');
  await assert.rejects(move(order.id, 'READY'), /הפריטים/);
  assert.equal((await run(() => prisma.orderItem.findFirstOrThrow({ where: { orderId: order.id } }))).received, false);

  await run(() => prisma.orderItem.updateMany({ where: { orderId: order.id }, data: { allocationStatus: 'ALLOCATED' } }));
  await move(order.id, 'READY', 'נארז');
  await assert.rejects(move(order.id, 'IN_TRANSIT'), /תאריך/);

  await assert.rejects(move(order.id, 'ON_HOLD'), /סיבה/);
  await move(order.id, 'ON_HOLD', 'הלקוח ביקש לדחות');
  await assert.rejects(move(order.id, 'PROCESSING'), /מוכן/);
  await move(order.id, 'READY');

  await run(() => service.updateOrder(order.id, { scheduledAt: new Date('2026-11-02T08:00:00.000Z') } as never, userId));
  assert.equal(await status(order.id), 'READY', 'Setting a date must not move the status');
  await run(() => prisma.order.update({ where: { id: order.id }, data: { totalCents: 450000, paidAmountCents: 450000, paymentStatus: 'PAID' } }));
  await move(order.id, 'IN_TRANSIT');
  await move(order.id, 'COMPLETED');
  await assert.rejects(move(order.id, 'PROCESSING'));

  const history = await run(() => prisma.statusHistory.findMany({ where: { orderId: order.id }, orderBy: { createdAt: 'asc' } }));
  assert.deepEqual(
    history.map((entry) => entry.toStatus),
    ['PROCESSING', 'READY', 'ON_HOLD', 'READY', 'IN_TRANSIT', 'COMPLETED']
  );
  assert.equal(history.find((entry) => entry.toStatus === 'ON_HOLD')?.reason, 'הלקוח ביקש לדחות');
  assert(history.every((entry) => entry.changedBy === userId));

  console.log(JSON.stringify({
    passed: true,
    checks: [
      'no skipping to completed', 'items must be ready', 'no automatic receiving', 'date before delivery',
      'reason for hold', 'resume to held status only', 'date does not move status', 'completed is final',
      'history with reasons and actor',
    ],
  }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => closeDatabaseConnection());
