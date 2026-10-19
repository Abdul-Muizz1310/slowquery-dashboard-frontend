// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { fingerprintsList } from "../../mocks/fixtures/fingerprints";
import { decodePart, ed25519Pair, verifiesWith } from "./keys";

/**
 * Spec 07 §3: the RSC pages call the backend directly from the server with a
 * freshly minted token, never through their own proxy, and never unsigned.
 */

const BACKEND = "http://backend.test";
const KEY_ENV = "SLOWQUERY_FRONTEND_SIGNING_KEY_PRIVATE";
const pair = ed25519Pair();

let fetchMock: Mock<(input: URL | RequestInfo, init?: RequestInit) => Promise<Response>>;

async function load() {
  vi.resetModules();
  const { serverApiClient } = await import("@/lib/server/backend-client");
  const { ConfigError } = await import("@/lib/api/errors");
  return { serverApiClient, ConfigError };
}

function sent(index = 0): { url: string; headers: Headers } {
  const [input, init] = fetchMock.mock.calls[index];
  return {
    url: input instanceof URL ? input.href : String(input),
    headers: new Headers(init?.headers),
  };
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", BACKEND);
  vi.stubEnv(KEY_ENV, pair.privateB64);
  fetchMock = vi.fn(async () => Response.json(fingerprintsList));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("serverApiClient", () => {
  it("P17 calls the backend origin directly with a contract-v2 token", async () => {
    const { serverApiClient } = await load();
    const rows = await serverApiClient.listFingerprints();
    expect(rows).toHaveLength(fingerprintsList.length);

    const call = sent();
    expect(call.url).toBe(`${BACKEND}/_slowquery/queries`);
    const token = call.headers.get("x-platform-token") ?? "";
    expect(verifiesWith(token, pair.publicB64)).toBe(true);
    expect(decodePart(token.split(".")[1])).toMatchObject({
      iss: "slowquery-frontend",
      aud: "slowquery",
      role: "frontend",
    });
  });

  it("P17 mints a fresh token per call", async () => {
    const { serverApiClient } = await load();
    await serverApiClient.listFingerprints();
    await serverApiClient.listFingerprints();
    expect(sent(0).headers.get("x-platform-token")).not.toBe(
      sent(1).headers.get("x-platform-token"),
    );
  });

  it("P17 the detail call is signed too", async () => {
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 404 }));
    const { serverApiClient } = await load();
    await expect(serverApiClient.getFingerprint("c168fc78a2e7d01c")).rejects.toThrow();
    expect(sent().url).toBe(`${BACKEND}/_slowquery/queries/c168fc78a2e7d01c`);
    expect(verifiesWith(sent().headers.get("x-platform-token") ?? "", pair.publicB64)).toBe(true);
  });

  it.each([
    ["missing", ""],
    ["malformed", "bm90LWEta2V5"],
  ])("F11 a %s key throws ConfigError and calls nothing", async (_label, value) => {
    vi.stubEnv(KEY_ENV, value);
    const { serverApiClient, ConfigError } = await load();
    await expect(serverApiClient.listFingerprints()).rejects.toBeInstanceOf(ConfigError);
    await expect(serverApiClient.listFingerprints()).rejects.toThrow(KEY_ENV);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
