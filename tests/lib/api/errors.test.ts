/**
 * Spec 00 — typed error union (ConfigError, NetworkError, TimeoutError,
 * HttpError, ParseError). Complements the behaviour cases in
 * client.test.ts by pinning the type shape.
 */

import { describe, expect, it } from "vitest";

describe("spec 00 — errors", () => {
  it("ConfigError is a distinct class with name 'ConfigError'", async () => {
    const { ConfigError } = await import("@/lib/api/errors");
    const e = new ConfigError("missing NEXT_PUBLIC_API_URL");
    expect(e.name).toBe("ConfigError");
    expect(e.message).toContain("NEXT_PUBLIC_API_URL");
  });

  it("NetworkError is distinct from TimeoutError", async () => {
    const { NetworkError, TimeoutError } = await import("@/lib/api/errors");
    const n = new NetworkError("offline");
    const t = new TimeoutError("timeout");
    expect(n).not.toBeInstanceOf(TimeoutError);
    expect(t).not.toBeInstanceOf(NetworkError);
  });

  it("HttpError carries status and body", async () => {
    const { HttpError } = await import("@/lib/api/errors");
    const e = new HttpError(500, "internal server error body");
    expect(e.status).toBe(500);
    expect(e.body).toBe("internal server error body");
  });

  it("ParseError carries the zod issue path as a string", async () => {
    const { ParseError } = await import("@/lib/api/errors");
    const e = new ParseError("shape mismatch", "suggestions[0].kind");
    expect(e.path).toBe("suggestions[0].kind");
  });
});
