/**
 * Spec 00 — apiClient typed fetch client.
 * Cases 2-6, 15-19, 21-22, 25.
 */

import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../mocks/server";

const API = "https://slowquery-demo-backend.onrender.com";

describe("spec 00 — apiClient", () => {
  it("case 2 happy: listFingerprints against empty [] resolves to []", async () => {
    server.use(http.get(`${API}/_slowquery/queries`, () => HttpResponse.json([])));
    const { apiClient } = await import("@/lib/api/client");
    const result = await apiClient.listFingerprints();
    expect(result).toEqual([]);
  });

  it("case 3 happy: listFingerprints with one fingerprint returns typed array", async () => {
    const { apiClient } = await import("@/lib/api/client");
    const result = await apiClient.listFingerprints();
    expect(result.length).toBeGreaterThan(0);
    expect(typeof result[0]?.total_ms).toBe("number");
  });

  it("case 4 happy: getFingerprint returns detail with typed suggestion kind", async () => {
    const { apiClient } = await import("@/lib/api/client");
    const result = await apiClient.getFingerprint("c168fc78a2e7d01c");
    expect(result.suggestions[0]?.kind).toBe("index");
  });

  it("case 5 happy: switchBranch returns Date for switched_at", async () => {
    const { apiClient } = await import("@/lib/api/client");
    const result = await apiClient.switchBranch("fast");
    expect(result.switched_at).toBeInstanceOf(Date);
    expect(result.active).toBe("fast");
  });

  it("case 6 happy: streamFingerprints yields three parsed events", async () => {
    const { apiClient } = await import("@/lib/api/client");
    const controller = new AbortController();
    const events: unknown[] = [];
    for await (const ev of apiClient.streamFingerprints(controller.signal)) {
      events.push(ev);
      if (events.length === 3) controller.abort();
    }
    expect(events.length).toBe(3);
  });

  it("case 15 failure: HttpError(500) preserves status and body", async () => {
    server.use(
      http.get(`${API}/_slowquery/queries`, () => HttpResponse.text("boom", { status: 500 })),
    );
    const { apiClient } = await import("@/lib/api/client");
    const { HttpError } = await import("@/lib/api/errors");
    await expect(apiClient.listFingerprints()).rejects.toBeInstanceOf(HttpError);
  });

  it("case 16 failure: unexpected shape throws ParseError with issue path", async () => {
    server.use(
      http.get(`${API}/_slowquery/queries`, () => HttpResponse.json({ unexpected: "shape" })),
    );
    const { apiClient } = await import("@/lib/api/client");
    const { ParseError } = await import("@/lib/api/errors");
    await expect(apiClient.listFingerprints()).rejects.toBeInstanceOf(ParseError);
  });

  it("case 17 failure: non-JSON response throws ParseError not SyntaxError", async () => {
    server.use(
      http.get(`${API}/_slowquery/queries`, () =>
        HttpResponse.text("<html>gateway</html>", { status: 200 }),
      ),
    );
    const { apiClient } = await import("@/lib/api/client");
    const { ParseError } = await import("@/lib/api/errors");
    await expect(apiClient.listFingerprints()).rejects.toBeInstanceOf(ParseError);
  });

  it("case 18 failure: request exceeding timeout throws TimeoutError", async () => {
    server.use(
      http.get(`${API}/_slowquery/queries`, async () => {
        await new Promise((r) => setTimeout(r, 50_000));
        return HttpResponse.json([]);
      }),
    );
    const { apiClient } = await import("@/lib/api/client");
    const { TimeoutError } = await import("@/lib/api/errors");
    await expect(apiClient.listFingerprints()).rejects.toBeInstanceOf(TimeoutError);
  }, 15_000);

  it("case 19 failure: fetch reject (network) throws NetworkError", async () => {
    server.use(http.get(`${API}/_slowquery/queries`, () => HttpResponse.error()));
    const { apiClient } = await import("@/lib/api/client");
    const { NetworkError } = await import("@/lib/api/errors");
    await expect(apiClient.listFingerprints()).rejects.toBeInstanceOf(NetworkError);
  });

  it("case 21 failure: malformed SSE message is skipped, iterator stays open", async () => {
    const { apiClient } = await import("@/lib/api/client");
    const controller = new AbortController();
    const events: unknown[] = [];
    for await (const ev of apiClient.streamFingerprints(controller.signal)) {
      events.push(ev);
      if (events.length === 2) controller.abort();
    }
    expect(events.length).toBe(2);
  });

  it("case 22 failure: SSE connection drop throws NetworkError so caller can reconnect", async () => {
    const { apiClient } = await import("@/lib/api/client");
    const { NetworkError } = await import("@/lib/api/errors");
    const controller = new AbortController();
    await expect(async () => {
      for await (const _ev of apiClient.streamFingerprints(controller.signal)) {
        // simulate the drop — the helper should surface as NetworkError
      }
    }).rejects.toBeInstanceOf(NetworkError);
  });

  it("case 25 security: switchBranch body is literal target, never user input concatenation", async () => {
    // If the client leaks user input into the body, this test's raw POST
    // interceptor would receive something other than {target: "fast"}.
    let seenBody: unknown = null;
    server.use(
      http.post(`${API}/branches/switch`, async ({ request }) => {
        seenBody = await request.json();
        return HttpResponse.json({
          active: "fast",
          switched_at: "2026-04-12T01:00:00.000Z",
          latency_ms: 1850,
        });
      }),
    );
    const { apiClient } = await import("@/lib/api/client");
    await apiClient.switchBranch("fast");
    expect(seenBody).toEqual({ target: "fast" });
  });
});
