import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { apiClient } from "@/lib/api/client";
import { fingerprintsList } from "../../mocks/fixtures/fingerprints";
import { switchToFastOk } from "../../mocks/fixtures/switch-response";

/**
 * Spec 07 §3 / P16: every browser call goes to the page's own origin under
 * /api/backend, carries no token (the proxy signs), and never names the
 * backend's origin.
 */

let fetchMock: Mock<(input: URL | RequestInfo, init?: RequestInit) => Promise<Response>>;

function sent(index = 0): { url: URL; init: RequestInit; headers: Headers } {
  const [input, init] = fetchMock.mock.calls[index];
  return {
    url: new URL(input instanceof URL ? input.href : String(input)),
    init: init ?? {},
    headers: new Headers(init?.headers),
  };
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiClient (browser)", () => {
  it("P16 listFingerprints goes through the same-origin proxy", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(fingerprintsList));
    await apiClient.listFingerprints();
    const call = sent();
    expect(call.url.origin).toBe(window.location.origin);
    expect(call.url.pathname).toBe("/api/backend/_slowquery/queries");
    expect(call.headers.has("x-platform-token")).toBe(false);
  });

  it("P16 switchBranch posts through the proxy", async () => {
    fetchMock.mockResolvedValueOnce(Response.json(switchToFastOk));
    await apiClient.switchBranch("fast");
    const call = sent();
    expect(call.url.origin).toBe(window.location.origin);
    expect(call.url.pathname).toBe("/api/backend/branches/switch");
    expect(call.init.method).toBe("POST");
    expect(call.headers.has("x-platform-token")).toBe(false);
  });

  it("P16 the stream goes through the proxy", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('data: {"kind":"heartbeat","now":"2026-10-20T00:00:00Z"}\n\n', {
        headers: { "content-type": "text/event-stream" },
      }),
    );
    const controller = new AbortController();
    for await (const _event of apiClient.streamFingerprints(controller.signal)) {
      controller.abort();
    }
    const call = sent();
    expect(call.url.origin).toBe(window.location.origin);
    expect(call.url.pathname).toBe("/api/backend/_slowquery/api/stream");
    expect(call.headers.has("x-platform-token")).toBe(false);
  });

  it("P16 no browser call names the backend origin", async () => {
    fetchMock.mockImplementation(async () => Response.json(fingerprintsList));
    await apiClient.listFingerprints();
    for (const [input] of fetchMock.mock.calls) {
      expect(String(input)).not.toContain("onrender.com");
    }
  });
});
