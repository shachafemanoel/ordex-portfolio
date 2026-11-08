import { test, expect } from '@playwright/test';

test('guided order stays synchronized through guards, gate and handoff', async ({ page }) => {
  const errors: string[] = [];
  const external: string[] = [];
  const expectedOrigin = new URL(process.env.DEMO_TEST_URL || 'http://127.0.0.1:4177').origin;
  const host = new URL(expectedOrigin).hostname;
  const hostingPaths = new Set([
    'https://v2.appdeploy.ai/shared/js/overlay.js',
    `https://api-v2.appdeploy.ai/app/${host.split('.')[0]}/_warmup`,
    'https://api-v2.appdeploy.ai/p',
    'https://appdeploy.ai/assets/favicon.svg',
  ]);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    const url = new URL(request.url());
    const hostingRequest =
      host.endsWith('.v2.appdeploy.ai') && hostingPaths.has(url.origin + url.pathname);
    if (
      ['http:', 'https:'].includes(url.protocol) &&
      url.origin !== expectedOrigin &&
      !hostingRequest
    )
      external.push(request.url());
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'להדגמה המודרכת', exact: true }).click();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  await page.getByRole('button', { name: 'מעבר לטיפול', exact: true }).click();
  await expect(page.getByRole('button', { name: 'מעבר למוכן', exact: true })).toBeDisabled();
  await page.getByLabel('הפריטים מוכנים', { exact: true }).check();
  await page.getByRole('button', { name: 'מעבר למוכן', exact: true }).click();
  await expect(page.locator('.bench')).toHaveAttribute('data-gate', 'closed');
  await expect(page.getByTestId('dispatch-count')).toContainText('0');
  await page.getByLabel('מועד אספקה', { exact: true }).fill('2026-12-01');
  await expect(page.locator('.bench')).toHaveAttribute('data-gate', 'closed');
  await page.getByRole('button', { name: 'סימון תשלום בדמו', exact: true }).click();
  await expect(page.locator('.bench')).toHaveAttribute('data-gate', 'open');
  await expect(page.getByTestId('dispatch-count')).toContainText('1');
  await page.getByRole('button', { name: 'יציאה למשלוח', exact: true }).click();
  await page.getByRole('button', { name: 'השלמת המסירה', exact: true }).click();
  await expect(page.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '7');
  await expect(page.locator('.history')).toContainText('הושלם');
  await page.getByRole('button', { name: 'עכשיו נסו הזמנה משלכם', exact: true }).click();
  await expect(page).toHaveURL(/#\/demo$/);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.order-top .status')).toHaveText('הושלם');
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test('mobile creation, field validation, queue filters and reset', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/demo');
  await page.getByRole('button', { name: 'הזמנת הדגמה חדשה', exact: true }).click();
  await page.getByLabel('שם לקוח פיקטיבי', { exact: true }).fill('');
  await page.getByRole('button', { name: 'יצירת הזמנה', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('שם לקוח פיקטיבי', { exact: true }).fill('לקוח בדיקת רצף');
  await page.getByLabel('סכום בשקלים', { exact: true }).fill('0');
  await page.getByRole('button', { name: 'יצירת הזמנה', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('סכום בשקלים', { exact: true }).fill('450');
  await page.getByRole('button', { name: 'יצירת הזמנה', exact: true }).click();
  await expect(page.locator('.order-top h2')).toHaveText('לקוח בדיקת רצף');
  await page.getByRole('button', { name: 'כל ההזמנות (4)', exact: true }).click();
  await page.getByPlaceholder('לקוח, מוצר או מספר הזמנה').fill('לקוח בדיקת רצף');
  await expect(page.locator('.order-row')).toHaveCount(1);
  await page.getByRole('combobox').selectOption('READY');
  await expect(page.locator('.empty')).toBeVisible();
  await page.getByRole('button', { name: 'איפוס הדמו', exact: true }).click();
  await page.getByRole('button', { name: 'כל ההזמנות (3)', exact: true }).click();
  await expect(page.locator('.order-row')).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('hold requires a reason, restores the station and cancellation is terminal', async ({
  page,
}) => {
  await page.goto('/#/demo');
  await page.getByText('פעולות נוספות', { exact: true }).click();
  await page.getByRole('button', { name: 'השהיה', exact: true }).click();
  await expect(page.getByRole('button', { name: 'אישור השהיה', exact: true })).toBeDisabled();
  await page.getByLabel('סיבת הפעולה', { exact: true }).fill('ממתינים לאישור לקוח');
  await page.getByRole('button', { name: 'אישור השהיה', exact: true }).click();
  await expect(page.locator('.order-top .status')).toHaveText('מושהה');
  await expect(page.locator('.bench')).toHaveAttribute('data-gate', 'closed');
  await page.getByRole('button', { name: 'מעבר להתקבל', exact: true }).click();
  await expect(page.locator('.order-top .status')).toHaveText('התקבל');
  await page.getByRole('button', { name: 'ביטול הזמנה', exact: true }).click();
  await expect(page.getByRole('button', { name: 'אישור ביטול', exact: true })).toBeDisabled();
  await page.getByLabel('סיבת הפעולה', { exact: true }).fill('ביטול בדיקה');
  await page.getByRole('button', { name: 'אישור ביטול', exact: true }).click();
  await expect(page.locator('.order-top .status')).toHaveText('בוטל');
  await expect(page.locator('.next-action')).toHaveCount(0);
});

test('responsive and reduced motion retain a usable primary action', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#/guided');
  for (const width of [375, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.getByRole('button', { name: 'מעבר לטיפול', exact: true })).toBeVisible();
  }
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await page.getByRole('button', { name: 'מעבר לטיפול', exact: true }).click();
  await expect(page.locator('.bench')).toHaveAttribute('data-status', 'PROCESSING');
});

test('refresh clears session data and browser history preserves route navigation', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'לנסות בעצמי', exact: true }).click();
  await page.getByRole('button', { name: 'סימון תשלום בדמו', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('button', { name: 'סימון תשלום בדמו', exact: true })).toBeEnabled();
  await page.getByRole('link', { name: 'רצף מבית OrdeX — דף הבית', exact: true }).click();
  await expect(page.getByRole('button', { name: 'להדגמה המודרכת', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('button', { name: 'הזמנת הדגמה חדשה', exact: true })).toBeVisible();
});
