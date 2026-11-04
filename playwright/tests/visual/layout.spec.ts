import { expect, test } from '@playwright/test';

test.describe('UI Layout System', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Auth Endpoint
    await page.route('/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'mock-user-1',
            name: 'Test User',
            email: 'test@example.com',
            role: { key: 'ADMIN', label: 'מנהל' },
            permissions: ['VIEW_DASHBOARD', 'VIEW_ORDERS', 'VIEW_MAP', 'VIEW_CUSTOMERS'],
          },
        }),
      });
    });

    // Set Token
    await page.addInitScript(() => {
      localStorage.setItem('ordex_auth_token', 'mock-token');
    });
  });

  test('Dashboard uses AppShell', async ({ page }) => {
    await page.goto('/dashboard');
    // Check for AppShell elements
    await expect(page.locator('nav')).toBeVisible(); // Sidebar or MobileNav
    await expect(page.locator('header').first()).toBeVisible(); // TopBar

    // Check specific dashboard content
    // We look for the Hebrew title
    await expect(page.locator('text=לוח בקרה')).toBeVisible();
    await expect(page.locator('text=מבט כללי')).toBeVisible();
  });

  test('Orders Page uses ListPage Template', async ({ page }) => {
    await page.goto('/orders');

    // Layout elements
    await expect(page.locator('aside nav')).toBeVisible();

    // Page Header from ListPage
    await expect(page.locator('h1')).toHaveText('ניהול הזמנות');

    // Check for "New Order" button in header actions
    await expect(page.locator('a[href="/orders/new"]')).toBeVisible();
  });

  test('Customers Page uses ListPage Template', async ({ page }) => {
    await page.goto('/customers');

    await expect(page.locator('aside nav')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('לקוחות');

    // Check for "New Customer" button moved to header
    const newButton = page.locator('a[href="/customers/new"]');
    await expect(newButton).toBeVisible();

    // Check KPI Grid is present in body
    await expect(page.locator('text=סה״כ לקוחות')).toBeVisible();
  });

  test('SKUs Page uses ListPage Template', async ({ page }) => {
    await page.goto('/skus');

    await expect(page.locator('aside nav')).toBeVisible();
    // Assuming the title is in h1
    await expect(page.locator('h1')).toHaveText('ניהול מוצרים ומק״טים');

    // Check for "Add Product" button (text-based locator for flexibility)
    await expect(page.getByRole('button', { name: 'הוסף מוצר' })).toBeVisible();

    // Check for KPI cards
    await expect(page.locator('text=סך הכל מוצרים')).toBeVisible();
  });

  test('Receiving Page uses ListPage Template', async ({ page }) => {
    await page.goto('/receiving');

    await expect(page.locator('aside nav')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('קבלת סחורה');

    // Check for "Refresh" button (header action)
    await expect(page.getByRole('button', { name: 'רענון נתונים' })).toBeVisible();

    // Check for KPI cards
    await expect(page.locator('text=הזמנות ממתינות')).toBeVisible();
  });

  test('Suppliers Page uses ListPage Template', async ({ page }) => {
    await page.goto('/suppliers');

    await expect(page.locator('aside nav')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('ניהול ספקים');

    // Check for "New Supplier" button (header action)
    await expect(page.getByRole('button', { name: 'הוסף ספק' })).toBeVisible();

    // Check for KPI cards or content
    await expect(page.locator('text=סך הכול ספקים')).toBeVisible();
  });

  test('Purchase Orders Page uses ListPage Template', async ({ page }) => {
    await page.goto('/purchase-orders');

    await expect(page.locator('aside nav')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('הזמנות רכש');

    // Check for "New PO" button (header action)
    await expect(page.getByRole('button', { name: 'הזמנת רכש' })).toBeVisible();

    // Check for table content
    await expect(page.locator('table')).toBeVisible();
  });

  test('Settings Page uses ProfilePage Template', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('aside nav')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('הגדרות מערכת');
    // Check for sidebar navigation card
    await expect(page.locator('text=קטגוריות הגדרות')).toBeVisible();
  });

  test('Profile Page uses ProfilePage Template', async ({ page }) => {
    await page.goto('/profile');
    await expect(page.locator('aside nav')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('הפרופיל שלי');
    // Check for personal details card
    await expect(page.locator('text=פרטים אישיים')).toBeVisible();
  });

  test('Management Page uses DashboardPage Template', async ({ page }) => {
    await page.goto('/management');
    await expect(page.locator('aside nav')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('מרכז ניהול ודוחות');
    // Check for Overview tab content
    await expect(page.locator('text=סקירה כללית')).toBeVisible();
  });

  test('Reports Page uses DashboardPage Template', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.locator('aside nav')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('דוחות ונתונים');
    // Check for reports links
    await expect(page.locator('text=דוח לפי סטטוס')).toBeVisible();
  });

  test('Payments Page uses ListPage Template', async ({ page }) => {
    await page.goto('/payments');
    await expect(page.locator('aside nav')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('תשלומים');
    // Check for payments table
    await expect(page.locator('table')).toBeVisible();
  });

  test('Collection Page uses ListPage Template', async ({ page }) => {
    await page.goto('/finance/collection');
    await expect(page.locator('aside nav')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('Payment Collection');
    // Check for refresh button
    await expect(page.locator('text=Refresh Data')).toBeVisible();
  });

  test('Installations Page uses DashboardPage Template', async ({ page }) => {
    await page.goto('/installations');
    await expect(page.locator('aside nav')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('לוח התקנות');
    // Check for task bar
    // await expect(page.locator('text=התקנות וביצוע')).toBeVisible(); // Might be conditional, better check scheduler container
    await expect(page.locator('.rbc-calendar')).toBeVisible(); // Assuming React Big Calendar class or similar
  });

  test('Calendar Page uses DashboardPage Template', async ({ page }) => {
    await page.goto('/calendar');
    await expect(page.locator('aside nav')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('יומן התקנות');
    // Check for calendar content
    await expect(page.locator('text=תאריך התקנה מתוכנן')).toBeVisible();
    // Check for card content
    // await expect(page.locator('text=הטבלה מציגה את כל ההזמנות')).toBeVisible(); // duplicate check essentially
  });

  test('Inventory Page uses DashboardPage Template', async ({ page }) => {
    await page.goto('/inventory');
    await expect(page.locator('aside nav')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('ניהול מלאי');
    // Check for stats
    await expect(page.locator('text=סה״כ מוצרים')).toBeVisible();
  });

  test('Tasks Page uses ListPage Template', async ({ page }) => {
    await page.goto('/tasks');
    await expect(page.locator('aside nav')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('משימות');
    // Check for task list or empty state
    await expect(page.locator('text=מעקב AI')).toBeVisible();
  });

  test('Leads Page uses ListPage Template', async ({ page }) => {
    await page.goto('/leads');
    await expect(page.locator('aside nav')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('ניהול לידים');
    // Check for "New Lead" button
    await expect(page.locator('a[href="/leads/new"]')).toBeVisible();
    // Check for filters
    await expect(page.locator('text=סטטוס')).toBeVisible();
  });

  test('Deals Page uses ListPage Template', async ({ page }) => {
    await page.goto('/deals');
    await expect(page.locator('aside nav')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('ניהול עסקאות');
    // Check for "New Deal" button
    await expect(page.locator('a[href="/deals/new"]')).toBeVisible();
    // Check for table headers
    await expect(page.locator('text=שם העסקה')).toBeVisible();
  });

  test('Pipeline Page uses DashboardPage Template', async ({ page }) => {
    await page.goto('/pipeline');
    await expect(page.locator('aside nav')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('צינור מכירות (Pipeline)');
    // Check for Kanban content or stats
    await expect(page.locator('text=לוח עסקאות')).toBeVisible();
  });

  test('Plans Page uses DashboardPage Template', async ({ page }) => {
    await page.goto('/plans');
    await expect(page.locator('aside nav')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('תוכניות עבודה');
    // Check for date picker container
    await expect(page.locator('text=בחר תאריך:')).toBeVisible();
  });

  test('RTL Direction is set', async ({ page }) => {
    await page.goto('/dashboard');
    // AppShell sets dir="rtl" on the main wrapper
    const appShell = page.locator('div[dir="rtl"]');
    await expect(appShell).toBeVisible();
  });
});
