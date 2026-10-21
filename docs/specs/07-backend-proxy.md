# Spec 07 — Signed backend proxy (platform contract v2)

## Scope

slowquery-demo-backend moves to the workspace **platform-token contract v2** (its spec 14):
`/_slowquery/*` and `/branches/*` need an Ed25519 JWT in `X-Platform-Token` with `aud "slowquery"`; only
`/health`, the docs and the read-only commerce routes stay public. Every backend route this dashboard
uses is protected. Decision DR-0030 (workspace `knowledge/decisions/`): the frontend holds its own
Ed25519 key, mints a 60-second token per upstream call, and the browser reaches the backend only through a
same-origin proxy that signs and forwards.

| Piece | File |
|---|---|
| Token claims, base64url, key parsing (pure) | `src/lib/server/token-claims.ts` |
| Key loading and signing (`node:crypto`) | `src/lib/server/platform-token.ts` |
| Path allowlist and header allowlists (pure) | `src/lib/server/proxy-rules.ts` |
| The proxy itself (imperative shell) | `src/lib/server/backend-proxy.ts` |
| Route handler | `src/app/api/backend/[...path]/route.ts` |
| Server-side calls (RSC pages) | `src/lib/server/backend-client.ts` |
| Browser calls | `src/lib/api/client.ts` (`apiClient`) |

Every module under `src/lib/server/` starts with `import "server-only"`; Vitest aliases it to Next's empty
module.

## 1. The token

- **Key.** `SLOWQUERY_FRONTEND_SIGNING_KEY_PRIVATE`: Ed25519 private key, PKCS#8 DER, base64 (standard
  alphabet, no line breaks). Server-only, never `NEXT_PUBLIC_*`. The backend holds the public half (SPKI DER,
  base64) as `SLOWQUERY_FRONTEND_SIGNING_KEY_PUBLIC`.
- **Parsing.** A leading byte-order mark and edge whitespace are stripped; then unset/empty → **missing**;
  not strict base64 → **malformed**; not a PKCS#8 Ed25519 private key (RSA, X25519, an SPKI public key,
  junk) → **malformed**. The key is read per call, never at import.
- **Header.** Exactly `{"alg":"EdDSA","typ":"JWT","kid":"slowquery-frontend-2026-10"}`.
- **Claims** (contract v2 §1/§4), in this order:
  `{"iss":"slowquery-frontend","aud":"slowquery","sub":"slowquery-frontend","role":"frontend","service":"slowquery","iat":<now>,"exp":<now+60>,"jti":<uuid v4>}`,
  `iat` in whole seconds (floor). A fresh token, with a new `jti`, for every upstream request.
- **Encoding.** Compact JWS, base64url without padding, signature `crypto.sign(null, signingInput, key)`.

## 2. The proxy route

`/api/backend/<path>` forwards to `${NEXT_PUBLIC_API_URL}/<path>`. It exports `GET` and `POST` only, plus
`runtime = "nodejs"`, `dynamic = "force-dynamic"` and `maxDuration = 300` (the live timeline's stream; its
reconnect covers a cut).

### The path allowlist

The proxy forwards exactly what the dashboard uses, nothing else:

| Method | Path |
|---|---|
| `GET` | `health` |
| `GET` | `_slowquery/queries` |
| `GET` | `_slowquery/queries/{id}` with `id` matching `^[a-f0-9]{1,16}$` |
| `GET` | `_slowquery/api/stream` |
| `POST` | `branches/switch` |
| `GET` | `branches/current` |

First every segment must be non-empty RFC 3986 unreserved characters (`A–Z a–z 0–9 - . _ ~`), not `.` or
`..`, and the query must be empty or start with `?`; otherwise **400** `{"error":"invalid path"}`. A
well-formed path that is not in the table (including a listed path with the other method, e.g.
`force-explain`, `GET branches/switch`, a commerce route) answers **404** `{"error":"not proxied"}`. The
resolved URL must keep the backend's origin (SSRF guard), else 400. Neither refusal calls the backend.

### Headers

Browser → backend, copied when present: `content-type`, `accept`, `last-event-id`, `x-request-id`. Never
`cookie`, `authorization`, `origin`, `referer`, `host`; an incoming `x-platform-token` is replaced. Added:
`x-platform-token` (the fresh token) and `x-forwarded-for` set to **exactly one address**: the leftmost
entry of the incoming `x-forwarded-for` (Vercel puts the visitor there), else the leftmost of `x-real-ip`,
else omitted. The backend buckets a frontend token's rate limit on `slowquery-frontend:{that address}`
(contract v2 §2 as amended 2026-10-20: the frontend's `sub` is constant, so keying on it would put every
visitor in one bucket).

Backend → browser, copied only: `content-type`, `cache-control`, `retry-after`, `x-request-id`,
`x-accel-buffering`.

### Body, fetch and streaming

For `POST` the body is read as an `ArrayBuffer` and forwarded unchanged. The upstream `fetch` uses
`cache: "no-store"`, `redirect: "manual"` and `signal: request.signal` (a closed tab aborts it). The
response is `new Response(upstream.body, …)`: never read or buffered, so `text/event-stream` reaches the
browser event by event. The status is the upstream status.

### Errors

| Condition | Answer | Backend called |
|---|---|---|
| Malformed path | 400 `{"error":"invalid path"}` | no |
| Path not allowlisted | 404 `{"error":"not proxied"}` | no |
| Key missing or malformed | 503 `{"error":"proxy not configured"}`; log names the variable and which, never the value | no |
| Fetch throws | 502 `{"error":"backend unreachable"}`, logged | attempted |
| The browser left first | 502, not logged | aborted |

The proxy never sends an unsigned request.

## 3. Callers

- **Browser** (`apiClient` in `src/lib/api/client.ts`): `streamFingerprints` → `GET /api/backend/_slowquery/api/stream`,
  `listFingerprints` (the timeline's polling fallback) → `GET /api/backend/_slowquery/queries`,
  `switchBranch` → `POST /api/backend/branches/switch`. Always the page's own origin; never the backend's.
  Used outside a browser it throws `ConfigError`.
- **Server** (`serverApiClient` in `src/lib/server/backend-client.ts`, used by the RSC pages and
  `getCachedFingerprints`): calls `${NEXT_PUBLIC_API_URL}` directly with a freshly minted token, never its own
  proxy. A missing or malformed key throws `ConfigError` before any request (the pages render their error
  state), so no unsigned request leaves the server either.
- With no browser call to the backend origin left, the CSP's `connect-src` is `'self'` only.

## 4. Bundle boundary

After `pnpm build`, `.next/static` contains neither `SLOWQUERY_FRONTEND_SIGNING_KEY_PRIVATE` nor
`createPrivateKey`; CI's build job greps for both.

## 5. End to end

`playwright.config.ts` generates a throwaway Ed25519 pair, starts `next dev` with the private half and
`NEXT_PUBLIC_API_URL` pointed at a local mock backend (`tests/e2e/fixtures/mock-backend.ts`, started by
`tests/e2e/global-setup.ts`), which verifies every token with the public half like the real backend
(contract v2 rules for a frontend token) and records what it received. It never reuses a running server.

## Test cases

Unit: `tests/lib/server/*.test.ts`, `tests/app/api/backend/route.test.ts` (Node environment, a stubbed
`fetch`, keys generated per run); callers in `tests/lib/api/*.test.ts`; E2E in `tests/e2e/proxy.spec.ts`.

### Pass

- **P1** `base64url` matches RFC 4648 vectors without padding.
- **P2** the header is exactly §1's.
- **P3** the claims for a given `now`: the eight claims of §1 in order, `iat = floor(now/1000)`,
  `exp = iat + 60`, the given `jti`.
- **P4** the signing input is `base64url(JSON(header)) "." base64url(JSON(claims))`.
- **P5** a minted token verifies against the public half in the backend's format, and decodes to P2/P3.
- **P6** two mints differ in `jti`; each lives exactly 60 s.
- **P7** the key loads from PKCS#8 DER base64, also wrapped in a BOM and a trailing CRLF.
- **P8** every allowlisted method + path resolves onto the backend base (with or without a base path),
  query kept.
- **P9** request headers: the four allowlisted ones copied, the token set, `x-forwarded-for` exactly one
  address (the leftmost incoming `x-forwarded-for` entry, else `x-real-ip`, else absent).
- **P10** response headers: only the five allowlisted ones.
- **P11** `GET` through the route reaches the backend with a token that verifies, the allowlisted headers,
  `cache: "no-store"`, `redirect: "manual"` and the request's signal; status and body come back.
- **P12** `POST branches/switch` forwards its body byte for byte.
- **P13** SSE: the first event reaches the client while the upstream is still open; `last-event-id`
  forwarded; closing the client aborts the upstream.
- **P14** a redirect comes back without being followed and without `location`.
- **P15** the route exports `GET`, `POST`, `runtime = "nodejs"`, `dynamic = "force-dynamic"`,
  `maxDuration = 300`, and no other method.
- **P16** the browser client's three calls go to `/api/backend/…` on the page's origin and carry no token.
- **P17** the server client calls the backend origin with an `x-platform-token` that verifies, a fresh one
  per call.
- **P18** (E2E, composed, no browser mocks) `/` lists the mock's fingerprints (server path, signed; the
  list is cached for 5 s, spec 00, so its signed call may come from an earlier test's fill);
  `/timeline` shows the first live tick while the mock holds the stream open; the apply button switches the
  branch through the proxy; every request the mock saw carried a valid token (contract-v2 claims), none a
  cookie or `authorization`, and the browser-originated ones the visitor's `x-forwarded-for`.

### Failure (negative space)

- **F1** missing key (unset, empty, whitespace) → missing.
- **F2** malformed key: non-base64, inner line break, bad length, junk bytes, an SPKI public key, an RSA
  key, an X25519 key.
- **F3** a token does not verify with another key nor after its claims change.
- **F4** the segment guard refuses: no segments, empty segment, `.`, `..`, a backslash, `%2e%2e`, `%2F`,
  `https:`, `evil.com@`, a space, a NUL byte, non-ASCII; a query not starting with `?`.
- **F5** the allowlist refuses: `_slowquery/queries/{id}/force-explain` (both methods), `GET branches/switch`,
  `POST branches/current`, `_slowquery/queries/NOT-HEX`, an id of 17 characters, `users`, `orders/x`,
  `metrics`, `docs`, `_slowquery`, `branches`.
- **F6** request headers never carry `cookie`, `authorization`, `origin`, `referer`, `host` or the browser's
  own `x-platform-token`.
- **F7** response headers never carry `set-cookie`, `location`, `content-length`, `content-encoding`,
  `server`, `x-powered-by`.
- **F8** through the route, F4 answers 400 and F5 answers 404; the backend is never called.
- **F9** missing key → 503, backend never called, the log names the variable; malformed key → 503 and
  the log never holds the value.
- **F10** fetch rejects → 502 and logged; aborted by the browser → 502, not logged.
- **F11** the server client with a missing or malformed key throws `ConfigError` and calls nothing.
- **F12** the browser client used without `window` throws `ConfigError`.
- **F13** (E2E) a traversal path or a non-allowlisted path sent to the running server never reaches the mock.
- **F14** (build) `.next/static` contains neither the key's variable name nor `createPrivateKey`.
