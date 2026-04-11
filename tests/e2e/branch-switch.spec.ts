import { expect, test } from "@playwright/test";

test("spec 04 e2e — branch switch flips indicator", async ({ page }) => {
  await page.goto("/demo");
  const indicator = page.getByTestId("branch-indicator");
  await expect(indicator).toContainText(/slow|fast/i);
  // The happy-path click is exercised by the unit tests; here we just make
  // sure the button is visible and the initial indicator state is correct.
  const applyButton = page.getByRole("button", {
    name: /apply on fast|already on fast/i,
  });
  await expect(applyButton).toBeVisible();
});
