import { expect, test } from "@playwright/test";

test("spec 03 e2e — timeline page mounts a chart and a stream status indicator", async ({
  page,
}) => {
  await page.goto("/timeline");
  await expect(page.locator("svg").first()).toBeVisible();
  await expect(page.getByTestId("stream-status")).toBeVisible();
});
