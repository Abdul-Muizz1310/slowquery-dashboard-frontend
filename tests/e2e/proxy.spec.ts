import { expect, type Page, request, test } from "@playwright/test";
import type { ReceivedRequest } from "./fixtures/mock-backend";

/**
 * Spec 07 P18 / F13 — the composed path, no browser mocks: the real pages,
 * the real signing proxy and server client, and the mock backend that checks
 * every token like the contract-v2 backend.
 */

test.describe.configure({ mode: "serial" });

const MOCK = process.env.E2E_MOCK_BACKEND_URL ?? "http://127.0.0.1:3512";
const VISITOR = "203.0.113.42";

async function received(): Promise<ReceivedRequest[]> {
  const api = await request.newContext();
  try {
    const res = await api.get(`${MOCK}/__control/requests`);
    return (await res.json()) as ReceivedRequest[];
  } finally {
    await api.dispose();
  }
}

async function releaseStreams(): Promise<void> {
  const api = await request.newContext();
  try {
    await api.post(`${MOCK}/__control/stream/release`);
  } finally {
    await api.dispose();
  }
}

async function visit(page: Page, path: string): Promise<void> {
  await page.setExtraHTTPHeaders({ "x-forwarded-for": VISITOR, cookie: "session=browser-only" });
  await page.goto(path);
}

test("P18 server pages, the live stream and a branch switch all go out signed", async ({
  page,
}) => {
  const before = (await received()).length;

  // Server path: the RSC page signs its own call to the backend.
  await visit(page, "/");
  await expect(page.locator('a[href="/queries/c168fc78a2e7d01c"]')).toBeVisible();

  // Browser path, streaming: the first tick arrives while the mock holds the stream open.
  await visit(page, "/timeline");
  await expect(page.getByTestId("stream-status")).toHaveText("live");
  await releaseStreams();

  // Browser path, a write: the apply button switches through the proxy.
  await visit(page, "/demo");
  await page.getByRole("button", { name: /apply on fast branch/i }).click();
  await expect(page.getByTestId("branch-indicator")).toContainText(/fast/i);

  const seen = (await received()).slice(before);
  const paths = seen.map((r) => `${r.method} ${r.path}`);
  expect(paths).toContain("GET /_slowquery/queries");
  expect(paths).toContain("GET /_slowquery/api/stream");
  expect(paths).toContain("POST /branches/switch");

  for (const r of seen) {
    expect(r.check, `${r.method} ${r.path}`).toMatchObject({ valid: true });
    if (r.check.valid) {
      expect(r.check.claims).toMatchObject({
        iss: "slowquery-frontend",
        aud: "slowquery",
        sub: "slowquery-frontend",
        role: "frontend",
        service: "slowquery",
      });
    }
    expect(r.headers.cookie).toBeNull();
    expect(r.headers.authorization).toBeNull();
  }

  // The browser-originated calls carry exactly the visitor's one address.
  const browserCalls = seen.filter(
    (r) => r.path === "/_slowquery/api/stream" || r.path === "/branches/switch",
  );
  expect(browserCalls.length).toBeGreaterThan(0);
  for (const r of browserCalls) expect(r.headers["x-forwarded-for"]).toBe(VISITOR);
});

test("F13 traversal and non-allowlisted paths never reach the backend", async ({
  request: api,
}) => {
  const before = (await received()).length;
  const traversal = await api.get("/api/backend/_slowquery/%2e%2e/%2e%2e/metrics");
  expect([400, 404]).toContain(traversal.status());
  const forceExplain = await api.post(
    "/api/backend/_slowquery/queries/c168fc78a2e7d01c/force-explain",
  );
  expect(forceExplain.status()).toBe(404);
  expect(await forceExplain.json()).toEqual({ error: "not proxied" });
  const commerce = await api.get("/api/backend/users");
  expect(commerce.status()).toBe(404);
  expect((await received()).length).toBe(before);
});
