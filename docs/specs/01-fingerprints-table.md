# Spec 01 — Fingerprints table at `/`

## Goal

Render every query fingerprint captured by `slowquery-demo-backend` as a sortable table, sorted by `total_ms` desc by default, with p50/p95/p99, call counts, age, and a rule-badge column that collapses the `(rule name → severity colour)` mapping into one glyph the user can scan at a glance. The row is a link to `/queries/[id]` (spec 02). Use a React Server Component to fetch on first render; hydrate a small client island only for the sort controls.

## Route

`app/page.tsx` — Next.js 16 App Router, default RSC. Data fetch happens in the server component with `cache: "no-store"` so each navigation sees fresh data; the timeline view (spec 03) is the live-polling surface.

## Inputs

- `apiClient.listFingerprints()` from spec 00
- Query params (all optional): `sort = "total_ms" | "p95_ms" | "call_count" | "last_seen"`, `order = "asc" | "desc"`
- `searchParams` from the route (Next.js 16 — `async` per the new convention)

## Outputs

- `<FingerprintsTable>` — server-rendered `<table>` with sticky header, one row per fingerprint
- `<SortHeader>` — thin client island that updates `searchParams` on click, triggers a Server Action refresh
- `<RuleBadges suggestions={suggestions}>` — deterministic colour per rule name (`seq_scan_large_table → red`, `sort_without_index → yellow`, `n_plus_one → orange`, `missing_fk_index → red`, `function_in_where → yellow`, `select_star → neutral`; LLM-sourced suggestions → purple)
- `<EmptyState>` — shown when the API returns `[]`
- `<ErrorState>` — shown when the client throws any error from the spec 00 error union

## Invariants

1. Page is a server component; the table body is server-rendered HTML with no client JS.
2. Every row is wrapped in `<Link href={"/queries/" + id}>` so the browser can prefetch on hover.
3. Sorting is deterministic: if `sort=p95_ms` and `p95_ms` is null, that row sinks to the bottom regardless of order.
4. Rule name → colour mapping is a frozen `Record<string, Severity>`; unknown rule names default to `neutral`.
5. Fingerprint text is rendered with `<code>` and zero interpolation; never `dangerouslySetInnerHTML`.
6. `call_count` is formatted with `Intl.NumberFormat("en", { notation: "compact" })` (`1.2k`, `3.4M`).
7. Milliseconds are formatted with 0 or 1 decimal depending on magnitude (`1_234 → 1234`, `12.3 → 12.3`, `0.42 → 0.4`).
8. Relative timestamps use `Intl.RelativeTimeFormat`; stable across re-renders within the same second.

## Enumerated test cases

### Happy

1. Given MSW returning 3 fingerprints, the rendered table has 3 rows, sorted by `total_ms` desc by default.
2. Clicking the `p95_ms` header re-fetches with `?sort=p95_ms&order=desc`, and the new order matches the fixture's p95 values.
3. A row's `<Link>` has `href="/queries/<id>"`.
4. A fingerprint whose detail response has a `sort_without_index` suggestion renders a yellow badge.
5. A fingerprint with both a rule-sourced and an LLM-sourced suggestion renders two badges in rule-first order.

### Edge

6. MSW returns `[]` → `<EmptyState>` renders with copy "No fingerprints captured yet" and a one-line hint pointing at the seeded endpoints.
7. `p95_ms: null` on a row renders as `—`, not `NaNms` or `0ms`.
8. `last_seen` 8 seconds ago renders as `"8 seconds ago"`; 2 days ago renders as `"2 days ago"`.
9. A fingerprint with `call_count: 1_234_567` renders as `"1.2M"`.
10. Unknown rule name (`"bogus_rule"`) renders with the neutral badge, not an error.
11. Click `p95_ms` when already sorted `p95_ms desc` → flips to `p95_ms asc`.
12. Server-rendered HTML includes the first page of rows without requiring JS (test via RSC renderer, assert on the serialized HTML string).

### Failure

13. `apiClient.listFingerprints()` throws `HttpError(500)` → `<ErrorState>` renders with status code and a retry link.
14. `apiClient.listFingerprints()` throws `TimeoutError` → `<ErrorState>` renders "Backend timed out".
15. `apiClient.listFingerprints()` throws `ParseError` → `<ErrorState>` renders "Backend response looked malformed" and logs the Zod issue path server-side (never to the client).
16. A single fingerprint with invalid shape triggers `ParseError`; the whole page shows `<ErrorState>`, no partial render of other rows (spec 00 invariant: parse-at-boundary, fail loud).

### Security

17. Fingerprint text containing `<script>alert(1)</script>` renders as literal text inside `<code>`; the DOM test asserts no `<script>` element was created.
18. `searchParams.sort` arriving as `"malicious"` is rejected by a Zod enum parse in the RSC; the page renders with the default sort, not a thrown 500.
19. Query string roundtrip does not leak any other header or form field.

## Acceptance criteria

- [ ] `src/app/page.tsx` renders the fingerprints table as an RSC
- [ ] `src/features/fingerprints/fingerprints-table.tsx` is the presentational component (prop-driven, unit-testable)
- [ ] `src/features/fingerprints/rule-badges.tsx` exports the frozen rule → severity mapping
- [ ] `src/features/fingerprints/sort-header.tsx` is the only client component on this page
- [ ] 19 Vitest cases under `tests/features/fingerprints/*.test.tsx`
- [ ] One Playwright E2E under `tests/e2e/fingerprints.spec.ts` that loads `/` against the live backend (or MSW-backed `pnpm dev`) and asserts the table exists with >= 1 row or the empty state
- [ ] Biome clean, tsc strict clean, 0 `any`
