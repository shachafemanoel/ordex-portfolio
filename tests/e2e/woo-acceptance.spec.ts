import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { startMockStore, wooOrder } from '../support/wooMockStore';
const path = process.env.ACCEPTANCE_CONFIG;
const config = path ? JSON.parse(readFileSync(path, 'utf8')) : null;
test.skip(!config, 'Acceptance environment required');
test.setTimeout(180000);
async function login(page: Page, who: 'admin' | 'staff' | 'secondaryAdmin' | 'secondaryStaff') {
  const account = who === 'secondaryAdmin' ? config.secondary.admin : who === 'secondaryStaff' ? config.secondary.staff : config[who];
  await page.goto('/login');
  await page.locator('input[type=email]').fill(account.email);
  await page.locator('input[type=password]').fill(config.password);
  await page.locator('button[type=submit]').click();
  await page.waitForURL('**/orders');
}
async function orderFromStore(page: Page, id: number) {
  const response = await page.request.get(`/api/orders?q=${id}`);
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  return (Array.isArray(body.data) ? body.data : (body.data?.items ?? [])).find(
    (o: { number: string }) => o.number.endsWith(`-${id}`)
  );
}
test('a store order completes with authoritative payment, a protected local address and history', async ({
  page,
}) => {
  const store = await startMockStore();
  try {
    store.products.set(10, {
      id: 10,
      name: 'ספה לבדיקת ייבוא',
      sku: 'SOFA-3',
      type: 'simple',
      price: '450.00',
      date_modified_gmt: '2026-10-29T08:00:00',
      stock_quantity: 5,
      stock_status: 'instock',
    });
    await login(page, 'secondaryAdmin');
    expect(
      (
        await page.request.post('/api/integrations/woocommerce', {
          data: { storeUrl: store.url, ...store.keys },
        })
      ).ok()
    ).toBeTruthy();
    expect(await store.deliver('order.created', wooOrder(9011))).toEqual([200]);
    await page.goto('/settings/integrations');
    await page.getByTestId('woo-preview').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('woo-preview-results')).toContainText('ספה לבדיקת ייבוא');
    await page.getByRole('checkbox', { name: /אני מאשר ייבוא/ }).check();
    const imported = page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/integrations/woocommerce/import') && r.request().method() === 'POST'
    );
    await page.getByTestId('woo-import').click();
    const importResponse = await imported;
    expect(importResponse.ok()).toBeTruthy();
    const importId = (await importResponse.json()).data.jobId;
    await expect
      .poll(
        async () => {
          const r = await page.request.get('/api/integrations/woocommerce/jobs');
          return (await r.json()).data.jobs.find((j: { id: string }) => j.id === importId)?.state;
        },
        { timeout: 45000 }
      )
      .toBe('SUCCEEDED');
    for (const width of [390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      ).toBeLessThanOrEqual(1);
      await page.screenshot({ path: `test-results/woo-sync-${width}.png`, fullPage: true });
    }
    await expect
      .poll(async () => Boolean(await orderFromStore(page, 9011)), { timeout: 45000 })
      .toBe(true);
    const order = await orderFromStore(page, 9011);
    const request = page.request;
    const genericSkip = await request.patch(`/api/orders/${order.id}`, {
      data: { status: 'COMPLETED' },
    });
    expect(genericSkip.status()).toBe(400);
    const local = await request.patch(`/api/orders/${order.id}/address`, {
      data: { city: 'חיפה', street: 'כתובת מקומית', number: '9' },
    });
    expect(local.ok(), await local.text()).toBeTruthy();
    await request.patch(`/api/orders/${order.id}`, { data: { notes: 'הערת תפעול מקומית' } });
    await page.goto(`/orders/${order.id}`);
    await expect(page.getByTestId('woo-local-address')).toBeVisible();
    await page.getByRole('button', { name: /^פרטי הזמנה/ }).click();
    await page.getByRole('button', { name: 'מוכן', exact: true }).first().click();
    await page.getByRole('button', { name: /אשר מצב פריטים/ }).click();
    const status = page.getByTestId('order-status-bar').filter({ visible: true });
    await expect(status).toHaveAttribute('data-status', 'PROCESSING');
    await status.getByTestId('status-action-READY').click();
    await page.getByTestId('status-change-confirm').click();
    await expect(status).toHaveAttribute('data-status', 'READY');
    await page.getByRole('button', { name: /^משלוח/ }).click();
    await page.getByRole('checkbox', { name: 'תיאום מול הלקוח בוצע' }).check();
    await page.getByRole('checkbox', { name: 'מועד מסירה נקבע' }).check();
    await page.getByRole('button', { name: /אשר וקבע מועד אספקה/ }).click();
    await expect.poll(async () => (await (await request.get(`/api/orders/${order.id}`)).json()).data.scheduledAt).toBeTruthy();
    const before = await request.get(`/api/orders/${order.id}`);
    const beforeData = (await before.json()).data;
    expect(beforeData.scheduledAt).toBeTruthy();
    expect(
      (
        await request.post(`/api/orders/${order.id}/status`, { data: { status: 'INSTALLATION' } })
      ).status()
    ).toBe(400);
    expect(
      (
        await request.put(`/api/orders/${order.id}/payment`, {
          data: { method: 'CASH', status: 'PAID', amountCents: 45000 },
        })
      ).status()
    ).toBe(409);
    await store.deliver(
      'order.updated',
      wooOrder(9011, {
        date_modified_gmt: '2026-10-29T11:00:00',
        date_paid_gmt: '2026-10-29T10:00:00',
      })
    );
    await expect
      .poll(
        async () => {
          const r = await request.get(`/api/orders/${order.id}`);
          return (await r.json()).data.paidAmountCents;
        },
        { timeout: 45000 }
      )
      .toBe(45000);
    const after = (await (await request.get(`/api/orders/${order.id}`)).json()).data;
    expect(after.shippingAddress.street).toBe('כתובת מקומית');
    expect(after.scheduledAt).toBe(beforeData.scheduledAt);
    expect(after.notes).toBe('הערת תפעול מקומית');
    await page.reload();
    await status.getByTestId('status-action-INSTALLATION').click();
    await page.getByTestId('status-change-confirm').click();
    await expect(status).toHaveAttribute('data-status', 'INSTALLATION');
    await status.getByTestId('status-action-COMPLETED').click();
    await page.getByTestId('status-change-confirm').click();
    await expect(status).toHaveAttribute('data-status', 'COMPLETED');
    const history = (await (await request.get(`/api/orders/${order.id}`)).json()).data
      .statusHistory;
    expect(history.map((h: { toStatus: string }) => h.toStatus)).toEqual(
      expect.arrayContaining(['RECEIVED', 'PROCESSING', 'READY', 'INSTALLATION', 'COMPLETED'])
    );
  } finally {
    await page.request.delete('/api/integrations/woocommerce');
    await store.close();
  }
});

test('operations cannot preview, import, inspect jobs or retry through API', async ({ page }) => {
  // This business is stable after the preceding store scenario; the manual-flow spec writes
  // to the first business concurrently, so two separate reads there are not one snapshot.
  await login(page, 'secondaryStaff');
  const list = (await (await page.request.get('/api/orders?limit=100')).json()).data;
  const counts = (await (await page.request.get('/api/orders/dashboard')).json()).data.statusCounts;
  expect(Object.values(counts).reduce((sum: any, n: any) => sum + n, 0)).toBe(list.length);
  for (const [status, count] of Object.entries(counts))
    expect(count).toBe(list.filter((o: { status: string }) => o.status === status).length);
  for (const [method, url, data] of [
    ['post', 'preview', { resource: 'products', page: 1 }],
    ['post', 'import', { previewId: '00000000-0000-4000-8000-000000000001', confirm: true }],
    ['get', 'jobs', undefined],
    ['post', 'jobs/00000000-0000-4000-8000-000000000001/retry', {}],
  ] as const) {
    const response =
      method === 'get'
        ? await page.request.get(`/api/integrations/woocommerce/${url}`)
        : await page.request.post(`/api/integrations/woocommerce/${url}`, { data });
    expect(response.status()).toBe(403);
  }
});
