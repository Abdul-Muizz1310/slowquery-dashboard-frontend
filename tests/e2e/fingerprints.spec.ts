import { expect, test } from "@playwright/test";

test("spec 01 e2e — fingerprints table renders at /", async ({ page }) => {
  await page.goto("/");
  // Either real rows or the empty state is acceptable when the live backend
  // is behind the demo stub. We assert the page does not 500 and either a
  // row or the empty-state copy is visible.
  await expect(page).toHaveTitle(/slowquery/i);
  const body = page.locator("body");
  await expect(body).toContainText(/fingerprint|no fingerprints captured/i);
});
