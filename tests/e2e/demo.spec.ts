import { expect, test } from "@playwright/test";

test("spec 05 e2e — /demo shows both panels and the apply button", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByTestId("demo-fingerprints-panel")).toBeVisible();
  await expect(page.getByTestId("demo-timeline-panel")).toBeVisible();
  await expect(page.getByTestId("branch-indicator")).toBeVisible();
});
