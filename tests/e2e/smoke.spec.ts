import { test, expect } from '@playwright/test';
import { prisma } from '@/lib/db';

test.describe.serial('Ops smoke', () => {
  let customerId = '';
  let billingAddressId = '';
  let shippingAddressId = '';
  let orderId = '';
  let orderNumber = '';

  test.beforeAll(async () => {
    const runId = `smoke-${Date.now()}`;

    const customer = await prisma.customer.create({
      data: {
        name: `Smoke ${runId}`,
        email: `${runId}@example.com`,
        phone: '+15555550000',
      },
    });
    customerId = customer.id;

    const billing = await prisma.address.create({
      data: {
        customerId,
        type: 'BILLING',
        city: 'Test City',
        street: 'Test Street',
        number: '10',
      },
    });
    billingAddressId = billing.id;

    const shipping = await prisma.address.create({
      data: {
        customerId,
        type: 'SHIPPING',
        city: 'Test City',
        street: 'Test Street',
        number: '10',
      },
    });
    shippingAddressId = shipping.id;
  });

  test.afterAll(async () => {
    if (orderId && prisma) {
      await prisma.order.update({
        where: { id: orderId },
        data: { deletedAt: new Date() },
      });
    }
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  test('create order, execute ops actions, and enforce invalid transition', async ({ request }) => {
    orderNumber = `SMOKE-${Date.now()}`;

    const createRes = await request.post('/api/orders', {
      data: {
        customerId,
        billingAddressId,
        shippingAddressId,
        priority: 'MEDIUM',
        notes: 'Smoke test order',
        items: [
          {
            name: 'Smoke Item',
            sku: `SMOKE-SKU-${Date.now()}`,
            qtyRequested: 1,
            priceCents: 10000,
          },
        ],
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const created = await createRes.json();
    orderId = created?.data?.id;
    expect(orderId).toBeTruthy();

    await prisma.order.update({
      where: { id: orderId },
      data: {
        number: orderNumber,
        status: 'PROCESSING',
        taskLabel: 'VERIFY_ORDER',
        opsLane: 'NEEDS_ACTION',
        urgent: false,
      },
    });

    const startRes = await request.post(`/api/v1/ops/orders/${orderId}/action`, {
      data: { actionType: 'START', payload: {} },
    });
    expect(startRes.ok()).toBeTruthy();

    const completeRes = await request.post(`/api/v1/ops/orders/${orderId}/action`, {
      data: { actionType: 'COMPLETE', payload: { estimatedDays: 2 } },
    });
    expect(completeRes.ok()).toBeTruthy();
    const completeBody = await completeRes.json();
    expect(completeBody?.data?.status).toBe('AWAITING_STOCK');
    expect(
      Boolean(completeBody?.data?.nextActionAt) || Boolean(completeBody?.data?.nextActionType),
    ).toBeTruthy();

    const readRes = await request.get(`/api/orders/${orderId}`);
    expect(readRes.ok()).toBeTruthy();
    const readBody = await readRes.json();
    expect(readBody?.data?.status).toBe('AWAITING_STOCK');

    const cancelRes = await request.post(`/api/v1/ops/orders/${orderId}/action`, {
      data: { actionType: 'CANCEL', payload: { reason: 'smoke-invalid-transition-check' } },
    });
    expect(cancelRes.ok()).toBeTruthy();

    const invalidRes = await request.post(`/api/v1/ops/orders/${orderId}/action`, {
      data: { actionType: 'START', payload: {} },
    });
    expect(invalidRes.status()).toBeGreaterThanOrEqual(400);
    expect(invalidRes.status()).toBeLessThan(500);
  });
});
