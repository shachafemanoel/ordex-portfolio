import { test, expect } from "@playwright/test";

test("complete workflow, held status, history, reset and no provider requests", async ({
  page,
}) => {
  const external: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    if (!request.url().startsWith("http://127.0.0.1:4176/"))
      external.push(request.url());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const detail = page.locator(".detail");
  await page.getByRole("button", { name: "מעבר לבטיפול", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "מעבר למוכן", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("הפריטים מוכנים").check();
  await page.getByRole("button", { name: "מעבר למוכן", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "מעבר לבדרך", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("מועד אספקה", { exact: true }).fill("2026-12-01");
  await expect(
    page.getByRole("button", { name: "מעבר לבדרך", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "סימון תשלום בדמו", exact: true })
    .click();
  await page.getByRole("button", { name: "מעבר לבדרך", exact: true }).click();
  await page.getByRole("button", { name: "מעבר להושלם", exact: true }).click();
  await expect(detail.locator(".detail-heading .status")).toHaveText("הושלם");
  await expect(detail.locator(".history li")).toHaveCount(8);
  await page.getByRole("button", { name: "איפוס הדמו" }).click();
  await page
    .getByRole("button", { name: "השהיה", exact: true })
    .isDisabled()
    .then((disabled) => expect(disabled).toBe(true));
  await page.getByLabel("סיבה / הערה").fill("בדיקת השהיה");
  await page.getByRole("button", { name: "השהיה", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "מעבר לבטיפול", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "מעבר להתקבל", exact: true }).click();
  await expect(detail.locator(".detail-heading .status")).toHaveText("התקבל");
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test("create, search and reset an order with a keyboard-accessible dialog", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "＋ הזמנת הדגמה" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await page.getByLabel("שם לקוח פיקטיבי").fill("לקוח בדיקה");
  await page.getByRole("button", { name: "יצירת הזמנה", exact: true }).click();
  await expect(page.locator(".detail h2")).toHaveText("לקוח בדיקה");
  await page.getByPlaceholder("לקוח, מוצר או מספר הזמנה").fill("לקוח בדיקה");
  await expect(page.locator(".order-row")).toHaveCount(1);
  await page.getByRole("button", { name: "איפוס הדמו" }).click();
  await expect(page.locator(".order-row")).toHaveCount(3);
  await page.getByRole("button", { name: "＋ הזמנת הדגמה" }).click();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

for (const width of [390, 768, 1440]) {
  test(`RTL and viewport ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width === 1440)
      await page.screenshot({ path: "docs/preview.png", fullPage: true });
  });
}
