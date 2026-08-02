/**
 * Live smoke test against the deployed backend's /health endpoint.
 *
 * This is opt-in, not part of the regular CI run: `SMOKE_HEALTH_URL` is
 * never set by .github/workflows/ci.yml (which only sets
 * NEXT_PUBLIC_API_URL/NEXT_PUBLIC_SITE_URL for the build/test/e2e jobs),
 * so `describe.skipIf` below skips this suite in every ordinary run.
 *
 * Render's free tier currently has the demo backend billing-suspended
 * (503 on every route, including /health) — an unconditional live check
 * here would fail CI unrelated to any code change in this repo. Once the
 * backend is reachable again, a maintainer can run this locally (or from
 * a manual/scheduled workflow) with:
 *
 *   SMOKE_HEALTH_URL=https://slowquery-demo-backend.onrender.com pnpm test -- --run tests/smoke.test.ts
 */

import { bypass } from "msw";
import { describe, expect, it } from "vitest";

const healthUrl = process.env.SMOKE_HEALTH_URL;

describe.skipIf(!healthUrl)("deployed backend — /health smoke test", () => {
  it("returns a well-formed health payload", async () => {
    // The rest of the suite runs under MSW with onUnhandledRequest: "error"
    // (tests/setup.ts), which would otherwise reject this as an unmocked
    // request regardless of whether the real backend is reachable.
    // `bypass()` marks this one request as intentionally real.
    const res = await fetch(bypass(`${healthUrl}/health`));
    const body: unknown = await res.json();

    expect(typeof res.status).toBe("number");
    expect(body).toMatchObject({
      service: expect.any(String),
      status: expect.stringMatching(/^(ok|degraded)$/),
    });
  });
});
