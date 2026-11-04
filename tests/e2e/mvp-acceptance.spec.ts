import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { startMockStore, wooOrder } from '../support/wooMockStore';

// MVP acceptance criteria for the internal order flow (spec approved 28.10.2026).
// Needs a running app on a disposable database seeded by scripts/acceptance-setup.ts:
//   ACCEPTANCE_CONFIG=<path written by the setup script> PLAYWRIGHT_BASE_URL=<app url> \
//   npx playwright test tests/e2e/mvp-acceptance.spec.ts
const configPath = process.env.ACCEPTANCE_CONFIG ?? '';
const hasConfig = Boolean(configPath) && existsSync(configPath);
const config = hasConfig
  ? (JSON.parse(readFileSync(configPath, 'utf8')) as {
      password: string;
      admin: { email: string };
      staff: { email: string };
      customerId: string;
      customerName: string;
      productId: string;
      productName: string;
    })
  : null;

test.skip(!hasConfig, 'ACCEPTANCE_CONFIG is not set; run scripts/acceptance-setup.ts first');
test.describe.configure({ mode: 'serial' });
test.use({
  viewport: { width: 390, height: 844 },
  locale: 'he-IL',
  launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
});
test.setTimeout(180_000);

type Who = 'admin' | 'staff';

type SessionCookies = Awaited<ReturnType<ReturnType<Page['context']>['cookies']>>;
const sessions: Partial<Record<Who, SessionCookies>> = {};

// Signs in through the login screen once per role and reuses the session afterwards: the server
// allows only a few login attempts per minute from one address.
async function login(page: Page, who: Who) {
  const saved = sessions[who];
  if (saved) {
    await page.context().addCookies(saved);
    await page.goto('/orders');
    return;
  }
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[type=email]', config![who].email);
  await page.fill('input[type=password]', config!.password);
  await page.click('button[type=submit]');
  await page.waitForURL((url) => url.pathname === '/orders', { timeout: 60_000, waitUntil: 'commit' });
  sessions[who] = await page.context().cookies();
}

async function createOrderByApi(request: APIRequestContext) {
  const response = await request.post('/api/orders', {
    data: {
      customerId: config!.customerId,
      items: [{ productId: config!.productId, name: config!.productName, sku: 'ACC', quantity: 1, pricePerUnit: 450 }],
    },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const body = await response.json();
  return String(body.data?.id ?? body.data?.order?.id ?? body.id);
}

async function getOrder(request: APIRequestContext, orderId: string) {
  const response = await request.get(`/api/orders/${orderId}`);
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  return (body.data ?? body) as {
    status: string;
    number: string;
    total: number;
    paidAmountCents: number;
    scheduledAt: string | null;
    statusHistory?: Array<{ fromStatus: string | null; toStatus: string; reason: string | null; changedByUser?: { name?: string } | null; metadata?: unknown }>;
  };
}

// Streaming SSR briefly keeps a hidden copy of the page segment; only the visible one counts.
const statusBar = (page: Page) => page.getByTestId('order-status-bar').filter({ visible: true });
const dialog = (page: Page) => page.getByTestId('status-change-dialog');

async function expectStatus(page: Page, status: string) {
  await expect(statusBar(page)).toHaveAttribute('data-status', status, { timeout: 30_000 });
}

async function openTransition(page: Page, action: string) {
  await statusBar(page).getByTestId(`status-action-${action}`).click();
  await expect(dialog(page)).toBeVisible();
}

async function confirmTransition(page: Page, reason?: string) {
  if (reason) await dialog(page).locator('textarea').fill(reason);
  await dialog(page).getByTestId('status-change-confirm').click();
  await expect(dialog(page)).toBeHidden({ timeout: 30_000 });
}

async function markItem(page: Page, decision: 'מוכן' | 'ממתין למלאי') {
  await page.getByRole('button', { name: /^פרטי הזמנה/ }).click();
  await page.getByRole('button', { name: decision, exact: true }).first().click();
  await page.getByRole('button', { name: /אשר מצב פריטים/ }).click();
}

test('an order created by hand moves through the whole flow, and every step is explained and recorded', async ({ page }) => {
  await login(page, 'staff');

  // 1. Manual order creation ends in "התקבל" with a number and the right total.
  await page.goto('/orders/new');
  await page.getByPlaceholder('חיפוש לקוח לפי שם, אימייל או טלפון').fill(config!.customerName.slice(0, 3));
  await page.getByText(config!.customerName).first().click();
  await page.getByRole('button', { name: /המשך לבחירת פריטים/ }).click();
  await page.getByPlaceholder('חפש מוצר לפי שם או מק״ט').fill(config!.productName.slice(0, 4));
  await page.getByText(config!.productName).first().click();
  await page.getByRole('button', { name: /סיכום ותשלום/ }).last().click();
  await page.getByText('מזומן / POS').click();
  await page.getByRole('button', { name: /ביצוע הזמנה/ }).click();
  await page.waitForURL(/\/orders\/[0-9a-f-]{36}$/, { timeout: 60_000 });
  const orderId = page.url().split('/').pop()!;

  await expectStatus(page, 'RECEIVED');
  const created = await getOrder(page.request, orderId);
  expect(created.status).toBe('RECEIVED');
  expect(created.number).toMatch(/^ORD-\d{4}-\d{4}$/);
  expect(created.total).toBe(4500);
  expect(created.paidAmountCents).toBe(0); // Choosing a method is not a payment receipt.
  await expect(page.getByText(`הזמנה #${created.number}`).first()).toBeVisible();

  // Skipping ahead is not offered.
  await expect(statusBar(page).getByTestId('status-action-COMPLETED')).toHaveCount(0);

  // 2. Taking the order in starts handling.
  await markItem(page, 'ממתין למלאי');
  await expectStatus(page, 'PROCESSING');

  // 3. "מוכן" with an item that is not ready is blocked and the reason is spelled out.
  await openTransition(page, 'READY');
  await expect(dialog(page).getByTestId('status-change-unmet')).toContainText('הפריטים');
  await expect(dialog(page).getByTestId('status-change-confirm')).toBeDisabled();
  await expect(dialog(page).getByTestId('status-change-override')).toHaveCount(0);
  await dialog(page).getByRole('button', { name: 'סגור' }).click();

  await markItem(page, 'מוכן');
  await openTransition(page, 'READY');
  await confirmTransition(page, 'נארז ומוכן');
  await expectStatus(page, 'READY');

  // Leaving for delivery needs a date; setting the date does not move the status.
  await openTransition(page, 'IN_TRANSIT');
  await expect(dialog(page).getByTestId('status-change-unmet')).toContainText('תאריך');
  await dialog(page).getByRole('button', { name: 'סגור' }).click();

  await page.getByRole('button', { name: /^משלוח/ }).click();
  await page.getByRole('checkbox', { name: 'תיאום מול הלקוח בוצע' }).check();
  await page.getByRole('checkbox', { name: 'מועד מסירה נקבע' }).check();
  await page.getByRole('button', { name: /אשר וקבע מועד אספקה/ }).click();
  await expect.poll(async () => (await getOrder(page.request, orderId)).scheduledAt, { timeout: 30_000 }).toBeTruthy();
  expect((await getOrder(page.request, orderId)).status).toBe('READY');

  const unpaid = await page.request.post(`/api/orders/${orderId}/status`, { data: { status: 'IN_TRANSIT' } });
  expect(unpaid.status()).toBe(400);
  expect(JSON.stringify(await unpaid.json())).toContain('תשלום מלא');
  const paid = await page.request.put(`/api/orders/${orderId}/payment`, { data: { method: 'CASH', status: 'PAID', amountCents: 450000 } });
  expect(paid.ok(), await paid.text()).toBeTruthy();
  await page.reload();
  await openTransition(page, 'IN_TRANSIT');
  await confirmTransition(page);
  await expectStatus(page, 'IN_TRANSIT');
  await openTransition(page, 'COMPLETED');
  await confirmTransition(page, 'נמסר ללקוח');
  await expectStatus(page, 'COMPLETED');
  await expect(statusBar(page).locator('button')).toHaveCount(0);

  // 4. Every transition is recorded: who, when, from, to and why.
  const history = (await getOrder(page.request, orderId)).statusHistory ?? [];
  const transitions = history
    .filter((entry) => entry.fromStatus)
    .map((entry) => `${entry.fromStatus}→${entry.toStatus}`);
  expect(transitions).toEqual(
    expect.arrayContaining(['RECEIVED→PROCESSING', 'PROCESSING→READY', 'READY→IN_TRANSIT', 'IN_TRANSIT→COMPLETED'])
  );
  const ready = history.find((entry) => entry.fromStatus === 'PROCESSING' && entry.toStatus === 'READY');
  expect(ready?.reason).toBe('נארז ומוכן');
  expect(ready?.changedByUser?.name).toBe('עובד תפעול');
  await expect(page.getByText('נמסר ללקוח').first()).toBeVisible();
});

test('skipping from "התקבל" to "הושלם" is refused with a Hebrew explanation', async ({ page }) => {
  await login(page, 'staff');
  const orderId = await createOrderByApi(page.request);

  const response = await page.request.post(`/api/orders/${orderId}/status`, { data: { status: 'COMPLETED' } });
  expect(response.status()).toBe(400);
  expect(JSON.stringify(await response.json())).toContain('לא ניתן לעבור');
  expect((await getOrder(page.request, orderId)).status).toBe('RECEIVED');
});

test('only the business admin may override a condition, and only with a reason', async ({ page, browser }) => {
  await login(page, 'staff');
  const orderId = await createOrderByApi(page.request);
  await page.goto(`/orders/${orderId}`);
  await openTransition(page, 'PROCESSING');
  await confirmTransition(page);
  await expectStatus(page, 'PROCESSING');

  // An employee cannot override, neither in the UI nor through the API.
  await openTransition(page, 'READY');
  await expect(dialog(page).getByTestId('status-change-override')).toHaveCount(0);
  const refused = await page.request.post(`/api/orders/${orderId}/override-status`, {
    data: { toStatus: 'READY', reason: 'ניסיון עקיפה' },
  });
  expect(refused.status()).toBe(403);

  // The admin can, with a reason, and the override is recorded.
  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'he-IL' });
  const admin = await adminContext.newPage();
  await login(admin, 'admin');
  await admin.goto(`/orders/${orderId}`);
  await openTransition(admin, 'READY');
  await dialog(admin).getByTestId('status-change-override').check();
  await expect(dialog(admin).getByTestId('status-change-confirm')).toBeDisabled();
  await confirmTransition(admin, 'הסחורה במחסן, המלאי לא עודכן');
  await expectStatus(admin, 'READY');

  const override = (await getOrder(admin.request, orderId)).statusHistory?.find((entry) => entry.toStatus === 'READY');
  expect(override?.reason).toBe('הסחורה במחסן, המלאי לא עודכן');
  expect(JSON.stringify(override?.metadata ?? {})).toContain('manualOverride');
  await expect(admin.getByText('סטטוס עודכן בעקיפת תנאים (מנהל)').first()).toBeVisible();
  await adminContext.close();
});

test('a hold needs a reason and resumes to the step it was held from', async ({ page }) => {
  await login(page, 'staff');
  const orderId = await createOrderByApi(page.request);
  await page.goto(`/orders/${orderId}`);
  await openTransition(page, 'PROCESSING');
  await confirmTransition(page);

  await openTransition(page, 'ON_HOLD');
  await expect(dialog(page).getByTestId('status-change-confirm')).toBeDisabled();
  await confirmTransition(page, 'הלקוח ביקש לדחות');
  await expectStatus(page, 'ON_HOLD');
  await expect(statusBar(page)).toContainText('ההזמנה מושהית בשלב "בטיפול"');

  await statusBar(page).getByTestId('status-action-resume').click();
  await confirmTransition(page);
  await expectStatus(page, 'PROCESSING');
});

test('the business admin connects a WooCommerce store, and its order events are received and verified', async ({ page: staffPage, browser }) => {
  // Needs WOO_ALLOW_PRIVATE_HOSTS=true on the app, because the store is a local mock.
  const store = await startMockStore();
  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'he-IL' });
  try {
    await login(staffPage, 'staff');
    expect((await staffPage.request.get('/api/integrations/woocommerce')).status()).toBe(403);

    const page = await adminContext.newPage();
    await login(page, 'admin');
    await page.goto('/settings/integrations');
    const card = page.getByTestId('woo-connection');
    await expect(card.getByTestId('woo-status')).toHaveText(/לא מחוברת|מנותקת/);

    await page.fill('#woo-store-url', store.url);
    await page.fill('#woo-consumer-key', store.keys.consumerKey);
    await page.fill('#woo-consumer-secret', 'cs_' + 'c'.repeat(40));
    await card.getByTestId('woo-test').click();
    await expect(page.getByText('המפתחות שגויים או שבוטלו בחנות').first()).toBeVisible();

    await page.fill('#woo-consumer-secret', store.keys.consumerSecret);
    const connected = page.waitForResponse((response) => response.url().endsWith('/api/integrations/woocommerce') && response.request().method() === 'POST');
    await card.getByTestId('woo-connect').click();
    expect((await connected).status()).toBe(200);
    await expect(card.getByTestId('woo-status')).toHaveText('מחוברת');
    expect([...store.webhooks.values()].map((webhook) => webhook.topic).sort()).toEqual(['order.created', 'order.updated']);
    const deliveryUrl = [...store.webhooks.values()][0].delivery_url;
    expect(deliveryUrl).toMatch(/\/api\/webhooks\/woocommerce\/[0-9a-f-]{36}$/);
    await expect(card).not.toContainText(store.keys.consumerSecret);

    expect(await store.deliver('order.created', wooOrder(9001))).toEqual([200]);
    expect(await store.deliver('order.created', wooOrder(9001))).toEqual([200]);
    expect(await store.deliver('order.created', wooOrder(9002), { secret: 'not-the-store-secret' })).toEqual([401]);

    await page.reload();
    await expect(card.getByTestId('woo-last-event')).not.toHaveText('עדיין לא התקבלו');

    await expect.poll(async () => {
      const response = await page.request.get('/api/integrations/woocommerce/jobs');
      const state = (await response.json()).data.counts;
      return (state.PENDING ?? 0) + (state.RUNNING ?? 0);
    }, { timeout: 45_000 }).toBe(0);

    await card.getByTestId('woo-disconnect').click();
    const disconnected = page.waitForResponse((response) => response.url().endsWith('/api/integrations/woocommerce') && response.request().method() === 'DELETE');
    await card.getByTestId('woo-disconnect-confirm').click();
    expect((await disconnected).status()).toBe(200);
    await expect(card.getByTestId('woo-status')).toHaveText('מנותקת');
    expect(store.webhooks.size).toBe(0);
    expect((await page.request.post(deliveryUrl, { data: wooOrder(9003) })).status()).toBe(404);
  } finally {
    await adminContext.close();
    await store.close();
  }
});

test('core screens fit phone, tablet and desktop widths in RTL', async ({ page }, testInfo) => {
  await login(page, 'staff');
  const orderId = await createOrderByApi(page.request);
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const [name, path] of [
      ['orders', '/orders'],
      ['new-order', '/orders/new'],
      ['order', `/orders/${orderId}`],
      ['customers', '/customers'],
      ['integrations', '/settings/integrations'],
    ] as const) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect(await page.evaluate(() => document.documentElement.dir || document.body.dir)).toBe('rtl');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${name} at ${width}px scrolls sideways`).toBeLessThanOrEqual(1);
      await page.screenshot({ path: testInfo.outputPath(`${name}-${width}.png`) });
    }
  }
});
