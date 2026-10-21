import { generateKeyPairSync } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

// Spec 07 §5: `next dev` signs with a throwaway Ed25519 pair made here and
// calls a local mock backend (tests/e2e/global-setup.ts) that verifies with
// the public half, like the real backend under platform contract v2. The
// runner, the global setup and every worker share the pair through the
// environment: workers inherit it, so a worker loading this file keeps it.
if (!process.env.E2E_SIGNING_KEY_PUBLIC) {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  process.env.E2E_SIGNING_KEY_PRIVATE = privateKey
    .export({ format: "der", type: "pkcs8" })
    .toString("base64");
  process.env.E2E_SIGNING_KEY_PUBLIC = publicKey
    .export({ format: "der", type: "spki" })
    .toString("base64");
}
process.env.E2E_MOCK_BACKEND_PORT ??= "3512";
const mockBackendUrl = `http://127.0.0.1:${process.env.E2E_MOCK_BACKEND_PORT}`;
process.env.E2E_MOCK_BACKEND_URL = mockBackendUrl;

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: baseURL,
    // Never reuse a running server: one started by hand may hold a real key
    // and the real backend's URL.
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NEXT_PUBLIC_API_URL: mockBackendUrl,
      NEXT_PUBLIC_SITE_URL: baseURL,
      SLOWQUERY_FRONTEND_SIGNING_KEY_PRIVATE: process.env.E2E_SIGNING_KEY_PRIVATE ?? "",
      PORT: new URL(baseURL).port || "3000",
    },
  },
});
