import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const suppliersFixture = {
  success: true,
  data: {
    items: [
      {
        id: 'supplier-fixture-1',
        name: 'ספק בדיקה בע"מ',
        govId: '515151515',
        email: 'demo@supplier.com',
        phone: '050-1234567',
        address: 'החרושת 12, תל אביב',
        paymentTerms: 'שוטף+30',
        productsCount: 4,
        purchaseOrdersCount: 2,
        lastPurchaseOrderAt: '2025-02-01T08:00:00.000Z',
        _count: { products: 4, purchaseOrders: 2 },
      },
    ],
  },
};

async function mockSuppliersApi(page: Page) {
  await page.route(/\/api\/suppliers(.*)?$/, route => {
    const method = route.request().method();
    if (method === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(suppliersFixture),
      });
    } else if (method === 'POST') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { id: 'new-supplier' } }),
      });
    } else {
      route.continue();
    }
  });
}

test.describe('Suppliers canonical route', () => {
  test('direct navigation renders suppliers list', async ({ page }) => {
    await mockSuppliersApi(page);
    await page.goto('/suppliers');

    await expect(page.getByRole('heading', { name: 'ניהול ספקים' })).toBeVisible();
    await expect(page.getByText('ספק בדיקה בע"מ')).toBeVisible();
  });

  test('add supplier modal handles accessibility and submission', async ({ page }) => {
    await mockSuppliersApi(page);
    await page.goto('/suppliers');

    const addSupplierButton = page.getByRole('button', { name: 'הוסף ספק' });
    await addSupplierButton.click();

    const dialog = page.getByRole('dialog', { name: 'הוספת ספק חדש' });
    await expect(dialog).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(addSupplierButton).toBeFocused();

    await addSupplierButton.click();
    await page.getByLabel('שם הספק').fill('ספק מודל');
    await page.getByLabel('מספר עוסק/ח.פ.').fill('999999999');
    await page.getByLabel('כתובת מלאה').fill('רחוב הבנייה 9, חיפה');

    await Promise.all([
      page.waitForRequest(request => request.url().includes('/api/suppliers') && request.method() === 'POST'),
      page.getByRole('button', { name: 'יצירת ספק' }).click(),
    ]);

    await expect(page.getByText('ספק נוצר בהצלחה!')).toBeVisible();
  });
});
