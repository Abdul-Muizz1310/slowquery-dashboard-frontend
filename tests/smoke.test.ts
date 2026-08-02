/**
 * Live smoke test against the deployed backend's /health endpoint.
 *
 * This is opt-in, not part of the regular CI run: `SMOKE_BASE_URL` is only
 * set (from the `SMOKE_BASE_URL` repository variable) by the dedicated
 * `smoke` job in .github/workflows/ci.yml, which runs solely this file and
 * only `if: github.event_name == 'push'`. The `lint`/`test`/`build`/`e2e`
 * jobs never set it, so `describe.skipIf` below skips this suite there.
 *
 * `SMOKE_BASE_URL` is deliberately its own variable rather than reusing
 * `NEXT_PUBLIC_API_URL`: tests/setup.ts defaults `NEXT_PUBLIC_API_URL` for
 * every test file (env.ts throws at import time otherwise), so gating on it
 * would make this live check run unconditionally in every job instead of
 * only the dedicated push-gated one.
 *
 * `SMOKE_BASE_URL` is a bare origin (no trailing slash, no path) — this
 * file appends `/health` itself. A parked or cold free-tier service must
 * never be able to turn CI red, so an unset/blank value skips the suite
 * entirely and makes zero HTTP requests.
 *
 * To run locally against the live demo backend:
 *
 *   SMOKE_BASE_URL=https://slowquery-demo-backend.onrender.com pnpm test --run tests/smoke.test.ts
 */

import { bypass } from "msw";
import { describe, expect, it } from "vitest";

const baseUrl = process.env.SMOKE_BASE_URL;

describe.skipIf(!baseUrl)("deployed backend — /health smoke test", () => {
  it("returns a well-formed health payload", async () => {
    // The rest of the suite runs under MSW with onUnhandledRequest: "error"
    // (tests/setup.ts), which would otherwise reject this as an unmocked
    // request regardless of whether the real backend is reachable.
    // `bypass()` marks this one request as intentionally real.
    const healthUrl = `${baseUrl?.replace(/\/+$/, "")}/health`;
    const res = await fetch(bypass(healthUrl));
    const body: unknown = await res.json();

    expect(typeof res.status).toBe("number");
    expect(body).toMatchObject({
      service: expect.any(String),
      status: expect.stringMatching(/^(ok|degraded)$/),
    });
  });
});
