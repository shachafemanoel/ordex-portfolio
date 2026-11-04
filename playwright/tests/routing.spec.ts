import { expect, test } from '@playwright/test';

test.describe('routing redirects', () => {
  test('legacy waiting install route redirects to canonical path', async ({ page }) => {
    const response = await page.goto('/reports/waiting-install');

    await expect(page).toHaveURL(/\/reports\/waiting-installation$/);
    await expect(page.getByRole('heading', { name: 'ממתין להתקנה' })).toBeVisible();
    expect(response?.status()).toBeLessThan(400);
  });
});
