// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

/** Spec 07 §3: no browser call reaches the backend origin, so the CSP never allows one. */

async function connectSrc(): Promise<string> {
  vi.resetModules();
  const { default: config } = await import("../../../next.config");
  const rules = (await config.headers?.()) ?? [];
  const csp = rules
    .flatMap((rule) => rule.headers)
    .find((header) => header.key === "Content-Security-Policy")?.value;
  const directive = csp
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("connect-src"));
  if (!directive) throw new Error("no connect-src directive");
  return directive;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Content-Security-Policy connect-src", () => {
  it("is 'self' only in production, whatever the backend URL", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://slowquery-demo-backend.onrender.com");
    expect(await connectSrc()).toBe("connect-src 'self'");
  });

  it("never names the backend origin in development either", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://slowquery-demo-backend.onrender.com");
    expect(await connectSrc()).not.toContain("onrender.com");
  });
});
