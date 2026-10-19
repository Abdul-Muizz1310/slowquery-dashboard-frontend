import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      // `all` is the default in Vitest 4 (uncovered `include` files are
      // reported) and is no longer a valid explicit option, so it is omitted.
      include: ["src/**"],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 70,
        // Per-module floor for the signing proxy (spec 07): every guard is a case.
        "src/lib/server/**": { lines: 100, statements: 100, branches: 100, functions: 100 },
        "src/app/api/**": { lines: 100, statements: 100, branches: 100, functions: 100 },
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Next resolves `server-only` itself (a build error in a client bundle);
      // outside Next it is the same empty module Next uses on the server.
      "server-only": path.resolve(__dirname, "node_modules/next/dist/compiled/server-only/empty.js"),
    },
  },
});
