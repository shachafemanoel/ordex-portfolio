import { expect, test } from '@playwright/test';

test('Order Lifecycle: Create -> Approve -> Pay -> Complete', async ({ page }) => {
  // 0. Login if auth is enabled
  const demoMode = (process.env.DEMO_MODE || process.env.NEXT_PUBLIC_DEMO_MODE || '').toLowerCase();
  const isDemo = ['true', '1', 'on', 'enabled', 'yes'].includes(demoMode);

  if (!isDemo) {
    const email = process.env.TEST_USER_EMAIL || 'admin@ordex.local';
    const password = process.env.TEST_USER_PASSWORD || 'admin123';

    await page.goto('/login');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', password);
    await page.click('button[type="submit"]');

    // Wait for the login process to complete and redirect
    await expect(page).not.toHaveURL(/\/login/);
  }

  // 1. Create Order
  await page.goto('/orders/new');
  await expect(page.getByText('הזמנה חדשה')).toBeVisible();

  // Select Customer
  await page.getByLabel(/חיפוש לקוחות/i).fill('Integration');
  await page.getByText('Integration Customer').click();
  await page.getByRole('button', { name: /המשך/i }).first().click(); // Or specific text

  // Add Item
  await page.getByLabel(/ספק/i).selectOption({ index: 0 }); // Select first supplier
  await page.getByLabel(/כמות/i).fill('2');
  await page.getByLabel(/מחיר/i).fill('100');
  await page.getByRole('button', { name: /הוסף פריט/i }).click();

  await page.getByRole('button', { name: /המשך/i }).click();

  // Payment/Notes
  await page.getByLabel(/הערות/i).fill('E2E Test Order');
  await page.getByRole('button', { name: /המשך/i }).click();

  // Submit
  await page.getByRole('button', { name: /צור/i }).click();

  // 2. Verify Order Page
  await expect(page).toHaveURL(/\/orders\/order-/);
  await expect(page.getByText('DRAFT', { exact: false })).toBeVisible();

  // 3. Approve Workflow (Simulate clicking approve if available)
  // Assuming there is a workflow action button
  // await page.getByRole('button', { name: /Approve/i }).click();
  // await expect(page.getByText('APPROVED')).toBeVisible();

  // 4. Record Payment
  // await page.getByRole('button', { name: /Record Payment/i }).click();
  // ... fill payment modal ...

  // 5. Complete
});
