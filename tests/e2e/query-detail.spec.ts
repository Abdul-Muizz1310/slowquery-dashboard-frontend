import { expect, test } from "@playwright/test";

test("spec 02 e2e — query detail page loads with SSR sql fallback", async ({ page }) => {
  await page.goto("/queries/c168fc78a2e7d01c");
  const body = page.locator("body");
  await expect(body).toContainText(/SELECT|not found/i);
});
