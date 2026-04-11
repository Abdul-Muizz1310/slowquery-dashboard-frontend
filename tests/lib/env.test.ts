/**
 * Spec 00 — env.ts parse at module load.
 * Cases 7, 13, 14, 23 (security), plus happy case 1.
 */

import { describe, expect, it } from "vitest";

describe("spec 00 — env", () => {
  it("case 1 happy: env.apiUrl equals NEXT_PUBLIC_API_URL with trailing slash normalised", async () => {
    process.env.NEXT_PUBLIC_API_URL = "https://slowquery-demo-backend.onrender.com";
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    const { env } = await import("@/lib/env");
    expect(env.apiUrl.toString()).toBe("https://slowquery-demo-backend.onrender.com/");
  });

  it("case 7 edge: trailing slash is preserved once and never duplicated", async () => {
    process.env.NEXT_PUBLIC_API_URL = "https://slowquery-demo-backend.onrender.com/";
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000";
    const { env } = await import("@/lib/env");
    expect(env.apiUrl.toString().endsWith("/")).toBe(true);
    expect(env.apiUrl.toString().endsWith("//")).toBe(false);
  });

  it("case 13 failure: missing NEXT_PUBLIC_API_URL throws ConfigError naming the variable", async () => {
    const original = process.env.NEXT_PUBLIC_API_URL;
    process.env.NEXT_PUBLIC_API_URL = undefined as unknown as string;
    await expect(import("@/lib/env")).rejects.toThrow(/NEXT_PUBLIC_API_URL/);
    process.env.NEXT_PUBLIC_API_URL = original;
  });

  it("case 14 failure: NEXT_PUBLIC_API_URL=not-a-url throws ConfigError", async () => {
    process.env.NEXT_PUBLIC_API_URL = "not-a-url";
    await expect(import("@/lib/env")).rejects.toThrow();
  });

  it("case 23 security: http:// in production throws ConfigError", async () => {
    const originalNode = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_API_URL = "http://slowquery-demo-backend.onrender.com";
    await expect(import("@/lib/env")).rejects.toThrow(/https/);
    process.env.NODE_ENV = originalNode;
  });
});
