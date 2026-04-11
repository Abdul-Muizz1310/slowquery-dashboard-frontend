# Spec 00 — Env parsing + typed API client

## Goal

At module load, parse `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SITE_URL` with Zod and throw on any missing/invalid value so misconfigured builds fail loudly at startup rather than producing half-broken pages. Ship a single typed fetch client that wraps every `slowquery-demo-backend` endpoint the dashboard touches, returning already-validated domain objects. Every API response crosses one Zod boundary and is never trusted after that boundary — no `any`, no `unknown` leaks past the client.

## Authoritative endpoint surface

Matched against [slowquery-demo-backend/src/slowquery_demo/api/routers/dashboard.py](slowquery-demo-backend/src/slowquery_demo/api/routers/dashboard.py) and [slowquery-demo-backend/src/slowquery_demo/api/routers/branches.py](slowquery-demo-backend/src/slowquery_demo/api/routers/branches.py):

| Method | Path | Today | Target (after backend gap close) |
|---|---|---|---|
| GET | `/_slowquery/queries` | returns `[]` (library stub) | returns `Fingerprint[]` from `query_fingerprints` |
| GET | `/_slowquery/queries/{id}` | does not exist | returns `FingerprintDetail` (fingerprint + plan + suggestions + recent samples) |
| GET | `/_slowquery/api/stream` | does not exist | SSE of `StreamEvent` deltas |
| POST | `/branches/switch` | validates + persists state, does not rebuild engine | validates + rebuilds engine, returns `SwitchBranchResponse` |

Schemas mirror the Pydantic types in the backend: `BranchName = "slow" \| "fast"`, `SwitchBranchResponse = {active, switched_at, latency_ms}`. Dashboard Zod schemas are the single source of truth on the frontend; a mismatch with the backend is a parse error, not a silent type hole.

## Inputs

- `process.env.NEXT_PUBLIC_API_URL` — absolute URL of the backend
- `process.env.NEXT_PUBLIC_SITE_URL` — absolute URL of this deployment
- HTTP responses from the endpoints above

## Outputs

- `env` — frozen object with `apiUrl: URL`, `siteUrl: URL`; thrown `ConfigError` if either is missing/invalid
- `apiClient` — object with methods:
  - `listFingerprints(): Promise<Fingerprint[]>`
  - `getFingerprint(id: string): Promise<FingerprintDetail>`
  - `streamFingerprints(signal: AbortSignal): AsyncIterable<StreamEvent>`
  - `switchBranch(target: BranchName): Promise<SwitchBranchResponse>`
- Exported Zod schemas: `FingerprintSchema`, `FingerprintDetailSchema`, `SuggestionSchema`, `ExplainPlanSchema`, `QuerySampleSchema`, `StreamEventSchema`, `SwitchBranchRequestSchema`, `SwitchBranchResponseSchema`
- Typed errors (discriminated union): `ConfigError`, `NetworkError`, `TimeoutError`, `HttpError{status}`, `ParseError`

## Invariants

1. Env parse runs once at module import. Re-importing `@/lib/env` never re-reads `process.env`.
2. `apiUrl` is always `https://` in production (`process.env.NODE_ENV === "production"`); `http://` accepted for local dev.
3. Every fetch goes through one `request()` helper that: applies a 10s default `AbortSignal.timeout`, injects `Accept: application/json`, parses JSON, pipes it through the response schema's `safeParse`, and throws `ParseError` on failure.
4. `BranchName` is a Zod `z.enum(["slow", "fast"])` → TypeScript `Literal`. The compiler refuses any other string.
5. `Suggestion.kind` is a discriminated union over `"index" | "rewrite" | "denormalize" | "partition"`; unknown kinds fail parse (catches library drift).
6. `Suggestion.source` is `"rules" | "llm"`.
7. No response schema has an open `z.record(z.string(), z.any())`. Every field is declared.
8. `apiClient` never throws an untyped error; all failures map to the typed error union above.

## Enumerated test cases

### Happy

1. `env.apiUrl.toString()` equals `NEXT_PUBLIC_API_URL` with a trailing slash normalised.
2. `apiClient.listFingerprints()` against MSW returning `[]` resolves to `[]`.
3. `apiClient.listFingerprints()` against MSW returning one well-formed fingerprint returns a one-element array with all numeric fields narrowed to `number`.
4. `apiClient.getFingerprint("abc")` against MSW returning a full detail payload resolves to an object whose `suggestions[0].kind` is typed as a literal member of the union.
5. `apiClient.switchBranch("fast")` against MSW returning `{active:"fast", switched_at:"2026-04-12T01:00:00Z", latency_ms:1850}` resolves to a parsed object whose `switched_at` is a JS `Date`.
6. `streamFingerprints(signal)` yields three parsed events in order when MSW sends three SSE messages.

### Edge

7. Trailing `/` on `NEXT_PUBLIC_API_URL` is preserved once and never duplicated in constructed URLs.
8. `p95_ms: null` in the response parses to `null` (nullable), not `undefined`, not `0`.
9. `explain_plan: null` on a detail response parses successfully (no plan captured yet).
10. `suggestions: []` on a detail response parses successfully.
11. Unknown rule name on a suggestion still parses (`rule: string`) — only `kind` and `source` are closed enums; the rule name is free text because the library's rule set grows.
12. Timezone-aware ISO timestamps with or without milliseconds both parse.

### Failure

13. Missing `NEXT_PUBLIC_API_URL` throws `ConfigError` at import time with message naming the variable.
14. `NEXT_PUBLIC_API_URL="not-a-url"` throws `ConfigError`.
15. Backend 500 → client throws `HttpError` with `status: 500` and preserves the response text in `.body`.
16. Backend returns `{unexpected: "shape"}` → client throws `ParseError` with the Zod issue path.
17. Backend returns non-JSON → client throws `ParseError` (not `SyntaxError`).
18. Request exceeds 10s → client throws `TimeoutError` (not a raw `AbortError`).
19. `fetch` itself rejects (DNS, offline) → client throws `NetworkError`.
20. `switchBranch("nonsense" as BranchName)` never compiles; cast-and-call at runtime throws `ParseError` before the request leaves.
21. SSE message with malformed JSON — the async iterator skips it and logs `structlog.warn`-equivalent, does not throw, does not break the stream.
22. SSE connection drops mid-stream — iterator rethrows `NetworkError` so the caller can reconnect.

### Security

23. `apiUrl` in `production` must be `https:`; `http://` in production throws `ConfigError`.
24. Response bodies are never `dangerouslySetInnerHTML`-rendered — the schema layer produces strings, never HTML.
25. `switchBranch` body is built from a `BranchName` literal, never from user input that hasn't been narrowed through Zod first.

## Acceptance criteria

- [ ] `src/lib/env.ts` exists, Zod-parses env at import, throws `ConfigError` on miss
- [ ] `src/lib/api/client.ts` exposes `apiClient` with the four methods above
- [ ] `src/lib/api/schemas.ts` exports every Zod schema named in "Outputs"
- [ ] `src/lib/api/errors.ts` exports the typed error union
- [ ] All 25 test cases have matching Vitest cases under `tests/lib/api/*.test.ts` and `tests/lib/env.test.ts`
- [ ] Biome clean, tsc strict clean, 0 `any`
- [ ] MSW handlers (`tests/mocks/handlers.ts`) are the single source of truth for fixture payloads — specs 01-05 all consume them
