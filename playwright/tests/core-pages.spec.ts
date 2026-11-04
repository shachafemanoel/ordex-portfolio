import { test, expect, type Page, type Route } from '@playwright/test';

const reportsFixture = {
  success: true,
  data: {
    rows: [
      {
        status: 'AWAITING_STOCK',
        label: 'ממתין למלאי',
        count: 3,
        totalValue: 120000,
        percentage: 60,
        recentOrders: [],
      },
      {
        status: 'READY_FOR_INSTALL',
        label: 'מוכן להתקנה',
        count: 2,
        totalValue: 80000,
        percentage: 40,
        recentOrders: [],
      },
    ],
    summary: {
      totalOrders: 5,
      totalValue: 200000,
      statuses: 2,
    },
    filters: {
      includeEmpty: true,
    },
  },
};

const mapFixture = {
  success: true,
  data: {
    orders: [
      {
        id: 'order-map-1',
        number: '1001',
        status: 'AWAITING_STOCK',
        customerName: 'משה כהן',
        totalAmount: 1200,
        lat: 32.08,
        lng: 34.78,
        address: 'תל אביב',
        items: [],
      },
    ],
  },
};

const calendarFixture = {
  success: true,
  data: [
    {
      id: 'install-1',
      orderNumber: '1001',
      scheduledAt: '2025-01-10T10:00:00.000Z',
      status: 'SCHEDULED',
      customerName: 'נועה לוי',
      customerPhone: '0501234567',
      installerName: 'צוות מרכז',
      installerNotes: 'להתקשר 30 דקות לפני',
      location: 'רחוב החשמונאים 10, תל אביב',
    },
  ],
  meta: {
    sync: {
      twoWayEnabled: false,
      reason: 'sync disabled for tests',
    },
  },
};

const purchaseOrdersFixture = {
  page: 1,
  pageSize: 10,
  total: 1,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
  purchaseOrders: [
    {
      id: 'po-1',
      reference: 'PO-1',
      status: 'DRAFT',
      supplier: { id: 'supplier-1', name: 'ספק הדגמה' },
      items: [],
      linkedOrderIds: [],
      estimatedTotalCents: 500000,
      createdAt: '2025-01-01T00:00:00.000Z',
    },
  ],
};

async function stubApi(page: Page, url: RegExp | string, body: unknown) {
  await page.route(url, (route: Route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  }));
}

test.describe('Core pages smoke tests', () => {
  test('reports status page renders table with mocked data', async ({ page }) => {
    await stubApi(page, /\/api\/reports\/status.*/, reportsFixture);
    await page.goto('/reports/status');
    await expect(page.getByText('דוח לפי סטטוס')).toBeVisible();
    await expect(page.getByText('ממתין למלאי', { exact: false })).toBeVisible();
  });

  test('map page shows widget when geo API succeeds', async ({ page }) => {
    await stubApi(page, /\/api\/orders\/geo.*/, mapFixture);
    await page.goto('/map');
    await expect(page.getByText('מפת הזמנות אינטראקטיבית')).toBeVisible();
  });

  test('calendar page lists mocked installation', async ({ page }) => {
    await stubApi(page, /\/api\/calendar\/installations.*/, calendarFixture);
    await page.goto('/calendar');
    await expect(page.getByText('יומן התקנות')).toBeVisible();
    await expect(page.getByText('נועה לוי')).toBeVisible();
  });

  test('purchase orders page navigates to details', async ({ page }) => {
    await stubApi(page, /\/api\/purchase-orders\/list.*/, purchaseOrdersFixture);
    await page.goto('/purchase-orders');
    const row = page.getByRole('row', { name: /PO-1/ });
    await expect(row).toBeVisible();
  });
});
