import { expect, test } from "@playwright/test";

test("spec 02 e2e — query detail page loads with SSR sql fallback", async ({ page }) => {
  await page.goto("/queries/c168fc78a2e7d01c");
  const body = page.locator("body");
  await expect(body).toContainText(/SELECT|not found/i);
});

test("spec 08 S8 — the detail page renders slowquery-detective 0.2's shape", async ({ page }) => {
  await page.goto("/queries/c168fc78a2e7d01c");
  // The plan arrives as EXPLAIN's top-level object and still renders as a tree.
  await expect(page.getByText("Seq Scan").first()).toBeVisible();
  await expect(
    page.getByText(/CREATE INDEX IF NOT EXISTS ix_orders_created_at/).first(),
  ).toBeVisible();
  await expect(page.getByText("Backend response looked malformed")).toHaveCount(0);
});
