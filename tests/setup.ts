import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import { server } from "./mocks/server";

// `unstable_cache` requires Next's incremental cache in the request scope,
// which doesn't exist when a page RSC is invoked directly in vitest. Shim it
// to a passthrough so the cached fetch delegates straight to the api client
// (which MSW intercepts). Production still uses the real Next data cache.
vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
}));

// Populate NEXT_PUBLIC_* before any module that imports `@/lib/env`
// evaluates — env.ts throws at import time on missing values.
process.env.NEXT_PUBLIC_API_URL ??= "https://slowquery-demo-backend.onrender.com";
process.env.NEXT_PUBLIC_SITE_URL ??= "http://localhost:3000";

// MSW lifecycle. `error` is deliberately strict — any unmocked request
// becomes a hard failure so tests can't silently hit the real backend.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
