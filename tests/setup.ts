import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./mocks/server";

// Populate NEXT_PUBLIC_* before any module that imports `@/lib/env`
// evaluates — env.ts throws at import time on missing values.
process.env.NEXT_PUBLIC_API_URL ??= "https://slowquery-demo-backend.onrender.com";
process.env.NEXT_PUBLIC_SITE_URL ??= "http://localhost:3000";

// MSW lifecycle. `error` is deliberately strict — any unmocked request
// becomes a hard failure so tests can't silently hit the real backend.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
