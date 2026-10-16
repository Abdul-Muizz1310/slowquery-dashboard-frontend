import { expect, type Page, test } from "@playwright/test";
import { SITE } from "../../src/lib/site/config";

// Like the other specs, these pages render against the demo backend the
// webServer is configured with; the head tags asserted here do not depend on
// what it returns (rows, the empty state or the error state all carry them).

const content = (page: Page, selector: string) =>
  page.locator(`head ${selector}`).first().getAttribute("content");

/**
 * The share image's URL as the head advertises it. A production build resolves it against
 * metadataBase (the production origin); `next dev`, which this repo's webServer runs, resolves
 * file-convention images against its own origin instead so a local preview can load them.
 */
const shareImage = (url: string | null, baseURL: string | undefined) => {
  const image = new URL(url ?? "");
  const origins = [SITE.origin.origin, new URL(baseURL ?? SITE.url).origin];
  expect(origins, `${url} is on the production origin or this server's`).toContain(image.origin);
  expect(image.pathname).toBe("/opengraph-image");
  return `${image.pathname}${image.search}`;
};

test("spec 06 e2e — the home page carries the site's head tags (case 21)", async ({
  page,
  request,
  baseURL,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle(SITE.title);
  expect(await content(page, 'meta[name="description"]')).toBe(SITE.description);
  expect(await content(page, 'meta[property="og:title"]')).toBe(SITE.title);
  const ogImage = shareImage(await content(page, 'meta[property="og:image"]'), baseURL);
  expect(await content(page, 'meta[name="twitter:card"]')).toBe("summary_large_image");
  expect(shareImage(await content(page, 'meta[name="twitter:image"]'), baseURL)).toBe(ogImage);
  const image = await request.get(ogImage);
  expect(image.status(), ogImage).toBe(200);
  expect(image.headers()["content-type"], ogImage).toMatch(/^image\/png/);
  expect(await content(page, 'meta[name="theme-color"]')).toBe("#0a0a0a");
  await expect(page.locator('head link[rel="icon"][type="image/svg+xml"]')).toHaveCount(1);
  await expect(page.locator('head link[rel="apple-touch-icon"]')).toHaveCount(1);
  await expect(page.locator('head link[rel="manifest"]')).toHaveCount(1);
});

test("spec 06 e2e — /timeline's own title flows into og:title (case 22)", async ({ page }) => {
  await page.goto("/timeline");
  await expect(page).toHaveTitle("live p95 timeline — slowquery");
  expect(await content(page, 'meta[property="og:title"]')).toBe("live p95 timeline — slowquery");
});

test("spec 06 e2e — the home page can be indexed (case 23)", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('head meta[name="robots"]')).toHaveCount(0);
});

test("spec 06 e2e — every metadata route answers with its content type (case 24)", async ({
  request,
}) => {
  const routes: [string, RegExp][] = [
    ["/opengraph-image", /^image\/png/],
    ["/icon.svg", /^image\/svg\+xml/],
    ["/apple-icon.png", /^image\/png/],
    ["/favicon.ico", /^image\/(x-icon|vnd\.microsoft\.icon)/],
    ["/icon-512.png", /^image\/png/],
    ["/manifest.webmanifest", /^application\/manifest\+json/],
    ["/robots.txt", /^text\/plain/],
    ["/sitemap.xml", /^application\/xml/],
  ];
  for (const [path, type] of routes) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["content-type"], path).toMatch(type);
  }
});
