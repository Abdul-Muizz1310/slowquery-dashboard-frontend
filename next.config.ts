import type { NextConfig } from "next";

// Standard security headers (audit SEC-1). With Monaco (and its runtime CDN
// fetch) removed, the app loads no third-party code, so the CSP is
// self-only. `frame-ancestors 'none'` + X-Frame-Options: DENY stop the /demo
// recording surface (and every other route) from being framed for
// clickjacking. `connect-src` also allows the backend API host so the
// browser can reach REST + SSE endpoints.
const apiOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? "").origin;
  } catch {
    return "";
  }
})();

const isDev = process.env.NODE_ENV !== "production";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "font-src 'self' data:",
  "img-src 'self' data:",
  // Next.js injects inline bootstrap/runtime styles and scripts. Dev mode
  // (React Refresh / Turbopack) additionally needs 'unsafe-eval'; production
  // does not, so it is only relaxed for the dev server.
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  `connect-src 'self'${apiOrigin ? ` ${apiOrigin}` : ""}${isDev ? " ws: http://localhost:*" : ""}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
]
  .join("; ")
  .concat(";");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
