import { expect, test } from '@playwright/test';

test.describe('UI Kit Visual Regression', () => {
  test('should match desktop screenshot', async ({ page }) => {
    // Navigate to UI kit page
    await page.goto('/_dev/ui-kit');

    // Wait for content (checking the main heading)
    await expect(page.locator('h1')).toContainText('OrdeX UI Kit');

    // Screenshot of specific tabs
    // Note: In a real environment, we'd snapshot the whole page or step through tabs.
    // For MVP, we snapshot the default view (Inputs)
    await expect(page).toHaveScreenshot('ui-kit-desktop-inputs.png', { fullPage: true });

    // Click on Feedback Tab
    await page.getByRole('tab', { name: 'Feedback & Status' }).click();
    await expect(page.getByText('Status Chips')).toBeVisible();
    await expect(page).toHaveScreenshot('ui-kit-desktop-feedback.png', { fullPage: true });

    // Click on Data Tab
    await page.getByRole('tab', { name: 'Data Display' }).click();
    await expect(page.getByText('Table')).toBeVisible();
    await expect(page).toHaveScreenshot('ui-kit-desktop-data.png', { fullPage: true });
  });

  test('should match mobile screenshot', async ({ page }) => {
    // Emulate mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/_dev/ui-kit');

    await expect(page.locator('h1')).toContainText('OrdeX UI Kit');
    await expect(page).toHaveScreenshot('ui-kit-mobile-inputs.png', { fullPage: true });
  });
});
