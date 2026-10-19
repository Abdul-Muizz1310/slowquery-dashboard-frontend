import "server-only";

/**
 * What the backend proxy forwards (spec 07 §2): the segment guard, the path
 * allowlist and the header allowlists in both directions. Pure; the proxy
 * itself is `backend-proxy.ts`.
 */

/** Request headers copied from the browser. Never cookies, never `authorization`. */
export const PROXY_REQUEST_HEADERS = [
  "content-type",
  "accept",
  "last-event-id",
  "x-request-id",
] as const;

/** Response headers copied from the backend. */
export const PROXY_RESPONSE_HEADERS = [
  "content-type",
  "cache-control",
  "retry-after",
  "x-request-id",
  "x-accel-buffering",
] as const;

type ProxyMethod = "GET" | "POST";

/** Exactly the backend calls the dashboard makes; everything else is refused. */
const PROXY_ROUTES: ReadonlyArray<{ method: ProxyMethod; pattern: RegExp }> = [
  { method: "GET", pattern: /^health$/ },
  { method: "GET", pattern: /^_slowquery\/queries$/ },
  { method: "GET", pattern: /^_slowquery\/queries\/[a-f0-9]{1,16}$/ },
  { method: "GET", pattern: /^_slowquery\/api\/stream$/ },
  { method: "POST", pattern: /^branches\/switch$/ },
  { method: "GET", pattern: /^branches\/current$/ },
];

// RFC 3986 unreserved characters only: no `%` (so nothing encoded is ever
// decoded later), no `/` or `\`, no `:` or `@`.
const SEGMENT = /^[A-Za-z0-9._~-]+$/;

export type ProxyTarget =
  | { readonly kind: "forward"; readonly url: URL }
  | { readonly kind: "invalid" }
  | { readonly kind: "not-proxied" };

/**
 * Where a proxied call goes. `invalid` (400): no segments, a segment outside
 * the unreserved set or equal to `.`/`..`, a query that does not start with
 * `?`, or a result off the backend's origin (the SSRF guard). `not-proxied`
 * (404): a well-formed method + path the dashboard never calls.
 */
export function resolveProxyTarget(
  method: string,
  backendBase: string,
  segments: readonly string[],
  search: string,
): ProxyTarget {
  if (segments.length === 0) return { kind: "invalid" };
  for (const segment of segments) {
    if (!SEGMENT.test(segment) || segment === "." || segment === "..") return { kind: "invalid" };
  }
  if (search !== "" && !search.startsWith("?")) return { kind: "invalid" };

  const path = segments.join("/");
  const verb = method.toUpperCase();
  if (!PROXY_ROUTES.some((route) => route.method === verb && route.pattern.test(path))) {
    return { kind: "not-proxied" };
  }

  const base = new URL(backendBase);
  const prefix = base.pathname.replace(/\/+$/, "");
  const url = new URL(`${prefix}/${path}${search}`, base.origin);
  return url.origin === base.origin ? { kind: "forward", url } : { kind: "invalid" };
}

/**
 * The visitor's address, exactly one: the leftmost `x-forwarded-for` entry
 * (Vercel puts the client there), else `x-real-ip`. The backend buckets a
 * frontend token's rate limit on it (contract v2 §2 as amended 2026-10-20),
 * so a chain must never pass through and let a visitor pick its own bucket.
 */
function clientAddress(incoming: Headers): string | null {
  for (const name of ["x-forwarded-for", "x-real-ip"]) {
    const leftmost = incoming.get(name)?.split(",")[0]?.trim();
    if (leftmost) return leftmost;
  }
  return null;
}

/** Headers for the upstream request: the allowlist, the fresh token, the visitor's address. */
export function upstreamRequestHeaders(incoming: Headers, token: string): Headers {
  const out = new Headers();
  for (const name of PROXY_REQUEST_HEADERS) {
    const value = incoming.get(name);
    if (value !== null) out.set(name, value);
  }
  out.set("x-platform-token", token);
  const client = clientAddress(incoming);
  if (client !== null) out.set("x-forwarded-for", client);
  return out;
}

/** Headers for the browser: the allowlist, nothing else. */
export function downstreamResponseHeaders(upstream: Headers): Headers {
  const out = new Headers();
  for (const name of PROXY_RESPONSE_HEADERS) {
    const value = upstream.get(name);
    if (value !== null) out.set(name, value);
  }
  return out;
}
