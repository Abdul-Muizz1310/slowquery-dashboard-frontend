// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  downstreamResponseHeaders,
  PROXY_REQUEST_HEADERS,
  PROXY_RESPONSE_HEADERS,
  resolveProxyTarget,
  upstreamRequestHeaders,
} from "@/lib/server/proxy-rules";

const BACKEND = "https://slowquery-demo-backend.onrender.com";
const FP = "c168fc78a2e7d01c";

function forwarded(method: string, segments: string[], search = "", base = BACKEND): string {
  const target = resolveProxyTarget(method, base, segments, search);
  if (target.kind !== "forward") throw new Error(`expected forward, got ${target.kind}`);
  return target.url.href;
}

describe("resolveProxyTarget — the allowlist", () => {
  it.each<[string, string[], string]>([
    ["GET", ["health"], "/health"],
    ["GET", ["_slowquery", "queries"], "/_slowquery/queries"],
    ["GET", ["_slowquery", "queries", FP], `/_slowquery/queries/${FP}`],
    ["GET", ["_slowquery", "queries", "a"], "/_slowquery/queries/a"],
    ["GET", ["_slowquery", "api", "stream"], "/_slowquery/api/stream"],
    ["POST", ["branches", "switch"], "/branches/switch"],
    ["GET", ["branches", "current"], "/branches/current"],
  ])("P8 %s %j forwards to the backend", (method, segments, path) => {
    expect(forwarded(method, segments)).toBe(`${BACKEND}${path}`);
  });

  it("P8 keeps the query string as received", () => {
    expect(forwarded("GET", ["_slowquery", "queries"], "?limit=5&x=a%20b")).toBe(
      `${BACKEND}/_slowquery/queries?limit=5&x=a%20b`,
    );
  });

  it("P8 keeps a base path, with or without a trailing slash", () => {
    for (const base of ["https://api.example.com/v1", "https://api.example.com/v1/"]) {
      expect(forwarded("GET", ["health"], "", base)).toBe("https://api.example.com/v1/health");
    }
  });

  it("P8 the method is matched case-insensitively", () => {
    expect(forwarded("post", ["branches", "switch"])).toBe(`${BACKEND}/branches/switch`);
  });

  it.each<[string, string[]]>([
    ["no segments", []],
    ["an empty segment", ["_slowquery", "", "queries"]],
    ["a dot segment", ["_slowquery", ".", "queries"]],
    ["a dot-dot segment", ["_slowquery", "..", "admin"]],
    ["a backslash", ["_slowquery\\..\\admin"]],
    ["a slash inside a segment", ["_slowquery/../admin"]],
    ["an encoded dot-dot", ["%2e%2e", "admin"]],
    ["an encoded slash", ["branches%2F..%2Fswitch"]],
    ["a double-encoded dot-dot", ["%252e%252e"]],
    ["a scheme", ["https:", "evil.com"]],
    ["userinfo", ["evil.com@", "health"]],
    ["a space", ["_slowquery", "a b"]],
    ["a NUL byte", ["health\u0000"]],
    ["a non-ASCII character", ["hëalth"]],
  ])("F4 refuses %s as invalid", (_label, segments) => {
    expect(resolveProxyTarget("GET", BACKEND, segments, "")).toEqual({ kind: "invalid" });
  });

  it("F4 refuses a query string that does not start with ?", () => {
    expect(resolveProxyTarget("GET", BACKEND, ["health"], "@evil.com")).toEqual({
      kind: "invalid",
    });
  });

  it("F4 refuses a result off the backend's origin", () => {
    expect(resolveProxyTarget("GET", "https://api.example.com//evil.com", ["health"], "")).toEqual({
      kind: "invalid",
    });
  });

  it.each<[string, string[]]>([
    ["GET", ["_slowquery", "queries", FP, "force-explain"]],
    ["POST", ["_slowquery", "queries", FP, "force-explain"]],
    ["GET", ["branches", "switch"]],
    ["POST", ["branches", "current"]],
    ["POST", ["_slowquery", "queries"]],
    ["GET", ["_slowquery", "queries", "NOT-HEX"]],
    ["GET", ["_slowquery", "queries", "c168fc78a2e7d01cf"]],
    ["GET", ["users"]],
    ["GET", ["orders", "x"]],
    ["GET", ["metrics"]],
    ["GET", ["docs"]],
    ["GET", ["openapi.json"]],
    ["GET", ["_slowquery"]],
    ["GET", ["branches"]],
    ["DELETE", ["health"]],
    ["PUT", ["branches", "switch"]],
  ])("F5 %s %j is not proxied", (method, segments) => {
    expect(resolveProxyTarget(method, BACKEND, segments, "")).toEqual({ kind: "not-proxied" });
  });
});

describe("upstreamRequestHeaders", () => {
  it("P9 copies exactly the allowlisted headers and sets the fresh token", () => {
    expect([...PROXY_REQUEST_HEADERS]).toEqual([
      "content-type",
      "accept",
      "last-event-id",
      "x-request-id",
    ]);
    const out = upstreamRequestHeaders(
      new Headers({
        "content-type": "application/json",
        accept: "text/event-stream",
        "last-event-id": "42",
        "x-request-id": "req-1",
      }),
      "signed.token.here",
    );
    expect(Object.fromEntries(out)).toEqual({
      "content-type": "application/json",
      accept: "text/event-stream",
      "last-event-id": "42",
      "x-request-id": "req-1",
      "x-platform-token": "signed.token.here",
    });
  });

  it("P9 x-forwarded-for is exactly one address: the leftmost incoming entry", () => {
    const out = upstreamRequestHeaders(
      new Headers({ "x-forwarded-for": " 203.0.113.7 , 10.0.0.1", "x-real-ip": "198.51.100.2" }),
      "t",
    );
    expect(out.get("x-forwarded-for")).toBe("203.0.113.7");
  });

  it("P9 x-forwarded-for falls back to x-real-ip", () => {
    const out = upstreamRequestHeaders(new Headers({ "x-real-ip": "198.51.100.2" }), "t");
    expect(out.get("x-forwarded-for")).toBe("198.51.100.2");
  });

  it("P9 an empty leftmost x-forwarded-for entry falls back to x-real-ip", () => {
    const out = upstreamRequestHeaders(
      new Headers({ "x-forwarded-for": " , 10.0.0.1", "x-real-ip": "198.51.100.2" }),
      "t",
    );
    expect(out.get("x-forwarded-for")).toBe("198.51.100.2");
  });

  it("P9 x-forwarded-for is absent when the visitor's address is unknown", () => {
    const out = upstreamRequestHeaders(new Headers({ "x-forwarded-for": "  " }), "t");
    expect(out.has("x-forwarded-for")).toBe(false);
  });

  it("F6 never forwards credentials, origin headers or the browser's own token", () => {
    const out = upstreamRequestHeaders(
      new Headers({
        cookie: "session=secret",
        authorization: "Bearer leaked",
        origin: "https://slowquery-dashboard-frontend.vercel.app",
        referer: "https://slowquery-dashboard-frontend.vercel.app/",
        host: "slowquery-dashboard-frontend.vercel.app",
        "x-platform-token": "forged-by-the-browser",
        "x-admin-token": "guessed",
        "user-agent": "test",
      }),
      "fresh",
    );
    expect(Object.fromEntries(out)).toEqual({ "x-platform-token": "fresh" });
  });
});

describe("downstreamResponseHeaders", () => {
  it("P10 copies exactly the allowlisted headers", () => {
    expect([...PROXY_RESPONSE_HEADERS]).toEqual([
      "content-type",
      "cache-control",
      "retry-after",
      "x-request-id",
      "x-accel-buffering",
    ]);
    const out = downstreamResponseHeaders(
      new Headers({
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        "retry-after": "30",
        "x-request-id": "req-1",
        "x-accel-buffering": "no",
      }),
    );
    expect(Object.fromEntries(out)).toEqual({
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      "retry-after": "30",
      "x-request-id": "req-1",
      "x-accel-buffering": "no",
    });
  });

  it("F7 drops everything else", () => {
    const out = downstreamResponseHeaders(
      new Headers({
        "set-cookie": "a=b",
        location: "https://evil.example/",
        "content-length": "12",
        "content-encoding": "gzip",
        server: "uvicorn",
        "x-powered-by": "FastAPI",
        "access-control-allow-origin": "*",
      }),
    );
    expect([...out.keys()]).toEqual([]);
  });
});
