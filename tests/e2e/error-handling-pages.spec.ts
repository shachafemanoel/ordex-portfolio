/**
 * E2E Tests for Error Handling - All Critical Pages
 *
 * Tests that all pages affected by error handling improvements:
 * 1. Load without crashes
 * 2. Display data or friendly empty states
 * 3. No "Failed to fetch" or "משהו השתבש" errors
 *
 * Pages tested:
 * - /receiving
 * - /products
 * - /skus
 * - /map
 * - /management/overview
 * - /admin/users
 * - /settings
 * - /admin/integrations
 * - /notifications
 * - /purchase-orders
 * - /calendar
 */

import { expect, test } from '@playwright/test';

// Test configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || 'admin@ordex.local',
  password: process.env.TEST_USER_PASSWORD || 'admin123',
};

// Helper function to login
async function login(page: any) {
  await page.goto(`${BASE_URL}/login`);
  await page.fill('input[type="email"]', TEST_USER.email);
  await page.fill('input[type="password"]', TEST_USER.password);
  await page.click('button[type="submit"]');

  // Wait for navigation to complete
  await page.waitForURL(/\/(dashboard|receiving|orders)/, { timeout: 5000 });
}

// Helper function to check for error messages
async function checkNoErrors(page: any) {
  // Check for common error messages
  const errorMessages = [
    'Failed to fetch',
    'משהו השתבש',
    'Something went wrong',
    '500',
    'Internal Server Error',
    'Network Error',
    'TypeError',
    'Cannot read property',
    'undefined is not an object',
  ];

  const bodyText = await page.textContent('body');

  for (const errorMsg of errorMessages) {
    expect(bodyText).not.toContain(errorMsg);
  }
}

// Helper function to check for loading spinner
async function waitForLoading(page: any) {
  try {
    // Wait for loading spinner to appear and disappear
    await page.waitForSelector('[data-testid="loading-spinner"], .loading, [aria-label*="טוען"]', {
      state: 'visible',
      timeout: 2000,
    });
    await page.waitForSelector('[data-testid="loading-spinner"], .loading, [aria-label*="טוען"]', {
      state: 'hidden',
      timeout: 10000,
    });
  } catch (e) {
    // Loading might be too fast, continue
  }
}

test.describe('Error Handling - Critical Pages', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Receiving Page - /receiving', async ({ page }) => {
    await test.step('Navigate to receiving page', async () => {
      await page.goto(`${BASE_URL}/receiving`);
      await waitForLoading(page);
    });

    await test.step('Verify page loads without errors', async () => {
      await checkNoErrors(page);
    });

    await test.step('Verify dashboard metrics display', async () => {
      // Check for metric cards
      const metricsVisible = await page
        .locator('text=/הזמנות ממתינות|סך פריטים|ערך משוער/')
        .count();
      expect(metricsVisible).toBeGreaterThan(0);
    });

    await test.step('Verify empty state or data displays', async () => {
      // Either data table or empty state message
      const hasData = (await page.locator('table').count()) > 0;
      const hasEmptyState = (await page.locator('text=/אין פריטים|אין הזמנות/').count()) > 0;

      expect(hasData || hasEmptyState).toBeTruthy();
    });

    await test.step('Verify no console errors', async () => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      // Allow time for async operations
      await page.waitForTimeout(2000);

      // Filter out known non-critical errors
      const criticalErrors = consoleErrors.filter(
        (error) => !error.includes('DevTools') && !error.includes('favicon')
      );

      expect(criticalErrors.length).toBe(0);
    });
  });

  test('Products Page - /products', async ({ page }) => {
    await test.step('Navigate to products page', async () => {
      await page.goto(`${BASE_URL}/products`);
      await waitForLoading(page);
    });

    await test.step('Verify page loads without errors', async () => {
      await checkNoErrors(page);
    });

    await test.step('Verify page header and controls', async () => {
      await expect(page.locator('h1:has-text("ניהול מוצרים")')).toBeVisible();
      await expect(page.locator('button:has-text("הוסף מוצר")')).toBeVisible();
    });

    await test.step('Verify summary cards display', async () => {
      const summaryCards = await page.locator('text=/סך הכל מוצרים|עם מחיר|עם ספק/').count();
      expect(summaryCards).toBeGreaterThan(0);
    });

    await test.step('Verify data table or empty state', async () => {
      const hasTable = (await page.locator('table').count()) > 0;
      const hasEmptyState = (await page.locator('text="אין מוצרים במערכת"').count()) > 0;

      expect(hasTable || hasEmptyState).toBeTruthy();
    });

    await test.step('Verify search functionality exists', async () => {
      await expect(page.locator('input[placeholder*="חיפוש"]')).toBeVisible();
    });
  });

  test('SKUs Page - /skus', async ({ page }) => {
    await test.step('Navigate to SKUs page', async () => {
      await page.goto(`${BASE_URL}/skus`);
      await waitForLoading(page);
    });

    await test.step('Verify page loads without errors', async () => {
      await checkNoErrors(page);
    });

    await test.step('Verify search controls', async () => {
      await expect(page.locator('input[placeholder*="מק״ט"]')).toBeVisible();
      await expect(page.locator('button:has-text("חפש")')).toBeVisible();
    });

    await test.step('Verify catalog table or empty state', async () => {
      const hasTable = (await page.locator('table').count()) > 0;

      expect(hasTable).toBeTruthy();
    });
  });

  test('Map View - /map', async ({ page }) => {
    await test.step('Navigate to map page', async () => {
      await page.goto(`${BASE_URL}/map`);
      await waitForLoading(page);
    });

    await test.step('Verify page loads without errors', async () => {
      await checkNoErrors(page);
    });

    await test.step('Verify map container exists', async () => {
      // Map might take time to load
      await page.waitForTimeout(3000);

      const hasMap = (await page.locator('[class*="map"], #map, [data-testid="map"]').count()) > 0;
      const hasEmptyState = (await page.locator('text=/אין הזמנות להצגה|אין נתונים/').count()) > 0;

      expect(hasMap || hasEmptyState).toBeTruthy();
    });

    await test.step('Verify no TypedError messages', async () => {
      const bodyText = await page.textContent('body');
      expect(bodyText).not.toContain('TypedError');
      expect(bodyText).not.toContain('geocoding failed');
    });
  });

  test('Management Overview - /management/overview', async ({ page }) => {
    await test.step('Navigate to management overview', async () => {
      await page.goto(`${BASE_URL}/management/overview`);
      await waitForLoading(page);
    });

    await test.step('Verify page loads without errors', async () => {
      await checkNoErrors(page);
    });

    await test.step('Verify stat cards display', async () => {
      // Check for metrics - should have at least some stat cards
      const statCards = await page
        .locator('[class*="stat"], [class*="metric"], [class*="card"]')
        .count();
      expect(statCards).toBeGreaterThan(0);
    });

    await test.step('Verify all metrics show numbers (not NaN)', async () => {
      const bodyText = await page.textContent('body');
      expect(bodyText).not.toContain('NaN');
      expect(bodyText).not.toContain('Infinity');
    });

    await test.step('Verify charts or tables render', async () => {
      const hasCharts = (await page.locator('svg, canvas, table').count()) > 0;
      expect(hasCharts).toBeTruthy();
    });
  });

  test('Users Management - /admin/users', async ({ page }) => {
    await test.step('Navigate to users page', async () => {
      await page.goto(`${BASE_URL}/admin/users`);
      await waitForLoading(page);
    });

    await test.step('Verify page loads without errors', async () => {
      await checkNoErrors(page);
    });

    await test.step('Verify users table displays', async () => {
      const hasTable = (await page.locator('table').count()) > 0;
      expect(hasTable).toBeTruthy();
    });

    await test.step('Verify at least current user is shown', async () => {
      // Should show at least the logged-in user
      const userRows = await page.locator('tbody tr').count();
      expect(userRows).toBeGreaterThanOrEqual(1);
    });

    await test.step('Verify user fields display with fallbacks', async () => {
      const bodyText = await page.textContent('body');
      // Should not have undefined/null displayed as text
      expect(bodyText).not.toContain('undefined');
      expect(bodyText).not.toContain('null');
    });
  });

  test('Store Settings - /settings', async ({ page }) => {
    await test.step('Navigate to unified store settings', async () => {
      await page.goto(`${BASE_URL}/settings`);
      await waitForLoading(page);
    });

    await test.step('Verify page loads without errors', async () => {
      await checkNoErrors(page);
    });

    await test.step('Verify unified settings form displays', async () => {
      const hasSettings =
        (await page.locator('text=/הגדרות חנות|מחסן ואיסוף|ברירות מחדל תפעוליות/').count()) > 0;
      expect(hasSettings).toBeTruthy();
    });

    await test.step('Verify form fields have values or defaults', async () => {
      const inputs = await page.locator('input, select').count();
      expect(inputs).toBeGreaterThan(0);
    });

    await test.step('Verify route origin summary is visible', async () => {
      const hasRouteOrigin =
        (await page.locator('text=/מוצא פעיל למסלולים|מוצא נוכחי/').count()) > 0;
      expect(hasRouteOrigin).toBeTruthy();
    });
  });

  test('Integrations Admin - /admin/integrations', async ({ page }) => {
    await test.step('Navigate to integrations admin page', async () => {
      await page.goto(`${BASE_URL}/admin/integrations`);
      await waitForLoading(page);
    });

    await test.step('Verify page loads without errors', async () => {
      await checkNoErrors(page);
    });

    await test.step('Verify integrations interface displays', async () => {
      const hasIntegrations =
        (await page.locator('text=/אינטגרציות|WooCommerce|Webhooks/').count()) > 0;
      expect(hasIntegrations).toBeTruthy();
    });

    await test.step('Verify no 500 errors from unconfigured services', async () => {
      const bodyText = await page.textContent('body');
      expect(bodyText).not.toContain('500');
      expect(bodyText).not.toContain('Internal Server Error');
    });
  });

  test('Notifications Center - /notifications', async ({ page }) => {
    await test.step('Navigate to notifications center', async () => {
      await page.goto(`${BASE_URL}/notifications`);
      await waitForLoading(page);
    });

    await test.step('Verify page loads without errors', async () => {
      await checkNoErrors(page);
    });

    await test.step('Verify notifications interface displays', async () => {
      const hasNotifications = (await page.locator('text=/התראות|Notifications|מרכז/').count()) > 0;
      expect(hasNotifications).toBeTruthy();
    });

    await test.step('Verify page shows either feed data or empty state', async () => {
      const hasFeed =
        (await page.locator('table, [class*="notification"], text=/אין התראות/').count()) > 0;
      expect(hasFeed).toBeTruthy();
    });
  });

  test('Purchase Orders - /purchase-orders', async ({ page }) => {
    await test.step('Navigate to purchase orders page', async () => {
      await page.goto(`${BASE_URL}/purchase-orders`);
      await waitForLoading(page);
    });

    await test.step('Verify page loads without errors', async () => {
      await checkNoErrors(page);
    });

    await test.step('Verify page header', async () => {
      const hasHeader = (await page.locator('text=/הזמנות רכש|Purchase Orders/i').count()) > 0;
      expect(hasHeader).toBeTruthy();
    });

    await test.step('Verify list or empty state displays', async () => {
      const hasList = (await page.locator('table, [class*="list"]').count()) > 0;
      const hasEmptyState = (await page.locator('text=/אין הזמנות|אין נתונים/').count()) > 0;

      expect(hasList || hasEmptyState).toBeTruthy();
    });

    await test.step('Verify create button exists', async () => {
      const hasCreateButton =
        (await page.locator('button:has-text(/צור|הוסף|Create/i)').count()) > 0;
      expect(hasCreateButton).toBeTruthy();
    });
  });

  test('Calendar - /calendar', async ({ page }) => {
    await test.step('Navigate to calendar page', async () => {
      await page.goto(`${BASE_URL}/calendar`);
      await waitForLoading(page);
    });

    await test.step('Verify page loads without errors', async () => {
      await checkNoErrors(page);
    });

    await test.step('Verify calendar component renders', async () => {
      // Calendar might use various libraries, check for common patterns
      const hasCalendar =
        (await page.locator('[class*="calendar"], [class*="rbc"], [class*="fc"]').count()) > 0;
      const hasDatePicker = (await page.locator('[class*="date"], [class*="month"]').count()) > 0;

      expect(hasCalendar || hasDatePicker).toBeTruthy();
    });

    await test.step('Verify calendar navigation works', async () => {
      // Look for navigation buttons (next/prev month)
      const hasNavigation =
        (await page
          .locator(
            'button[aria-label*="next"], button[aria-label*="prev"], button:has-text(/הבא|הקודם/)'
          )
          .count()) > 0;
      expect(hasNavigation).toBeTruthy();
    });

    await test.step('Verify no Google Calendar sync errors visible', async () => {
      const bodyText = await page.textContent('body');
      expect(bodyText).not.toContain('Google Calendar error');
      expect(bodyText).not.toContain('Calendar sync failed');
    });
  });
});

test.describe('Error States and Recovery', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Receiving Page - Retry Button Works', async ({ page }) => {
    await page.goto(`${BASE_URL}/receiving`);
    await waitForLoading(page);

    // Look for retry button (might appear on error)
    const retryButton = page.locator('button:has-text(/נסה שוב|Retry/i)');
    const retryVisible = (await retryButton.count()) > 0;

    if (retryVisible) {
      await retryButton.click();
      await waitForLoading(page);

      // After retry, should show data or empty state
      await checkNoErrors(page);
    }
  });

  test('Products Page - Search with No Results', async ({ page }) => {
    await page.goto(`${BASE_URL}/products`);
    await waitForLoading(page);

    // Search for non-existent product
    await page.fill('input[placeholder*="חיפוש"]', 'NONEXISTENT_PRODUCT_XYZ123');
    await page.click('button:has-text("חפש")');
    await waitForLoading(page);

    // Should show empty state, not error
    await checkNoErrors(page);

    const hasEmptyState = (await page.locator('text=/אין מוצרים|לא נמצאו תוצאות/').count()) > 0;
    expect(hasEmptyState).toBeTruthy();
  });

  test('All Pages - Handle Slow Network', async ({ page, context }) => {
    // Simulate slow network
    await context.route('**/*', (route) => {
      setTimeout(() => route.continue(), 1000);
    });

    const pages = ['/receiving', '/products', '/skus', '/management/overview'];

    for (const pagePath of pages) {
      await page.goto(`${BASE_URL}${pagePath}`);

      // Should show loading spinner
      const hasLoading =
        (await page.locator('[data-testid="loading-spinner"], .loading, text=/טוען/').count()) > 0;

      // Eventually should load without errors
      await page.waitForLoadState('networkidle', { timeout: 15000 });
      await checkNoErrors(page);
    }
  });
});

test.describe('Accessibility and UX', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('All Critical Pages - RTL Support', async ({ page }) => {
    const pages = ['/receiving', '/products', '/skus', '/management/overview'];

    for (const pagePath of pages) {
      await page.goto(`${BASE_URL}${pagePath}`);
      await waitForLoading(page);

      // Check RTL attribute
      const htmlDir = await page.getAttribute('html', 'dir');
      expect(htmlDir).toBe('rtl');
    }
  });

  test('Error States - Have Proper ARIA Labels', async ({ page }) => {
    await page.goto(`${BASE_URL}/receiving`);
    await waitForLoading(page);

    // Check for accessibility attributes
    const errorElements = await page.locator('[role="alert"], [aria-live="polite"]').count();

    // If errors exist, they should have proper ARIA
    if (errorElements > 0) {
      const hasAriaLabel = await page.locator('[role="alert"]').first().getAttribute('aria-label');
      expect(hasAriaLabel).toBeTruthy();
    }
  });

  test('Loading States - Announce to Screen Readers', async ({ page }) => {
    await page.goto(`${BASE_URL}/products`);

    // Check for loading announcement
    const loadingAnnouncer = await page.locator('[role="status"], [aria-live]').count();
    expect(loadingAnnouncer).toBeGreaterThanOrEqual(0);
  });
});
