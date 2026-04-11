# Spec 02 — Query detail at `/queries/[id]`

## Goal

Show everything a developer needs to decide whether a slow query is worth fixing: the canonical (parameter-stripped) SQL in a Monaco editor with Postgres syntax, the EXPLAIN plan JSON in a tree-view highlighter, and one suggestion card per suggestion (rule-sourced first, then LLM-sourced). Every card exposes a single action — copy the DDL, or (on suggestions whose `kind === "index"`) open the branch-switch panel defined in spec 04. This is the page a user lands on after clicking any row in spec 01.

## Route

`app/queries/[id]/page.tsx` — RSC shell that fetches `apiClient.getFingerprint(id)`; Monaco and the plan viewer are lazy client components (`"use client"` + `next/dynamic({ ssr: false })`).

## Inputs

- Dynamic segment `id: string` (16-char sha1 prefix — the fingerprint id per [alembic/versions/0001_initial.py](slowquery-demo-backend/alembic/versions/0001_initial.py#L152))
- `apiClient.getFingerprint(id)` → `FingerprintDetail`:
  ```ts
  {
    fingerprint: Fingerprint,       // same shape as spec 01 rows
    canonical_sql: string,
    explain_plan: ExplainPlan | null,   // plan_json + plan_text + cost + captured_at
    suggestions: Suggestion[],          // { kind, source, sql | null, rationale, rule?, applied_at | null }
    recent_samples: QuerySample[],      // last 10 samples, { duration_ms, rows, sampled_at }
  }
  ```

## Outputs

- `<FingerprintHeader>` — fingerprint id (short), p50/p95/p99, total_ms, call_count, first/last seen
- `<CanonicalSql>` — Monaco editor, read-only, PostgreSQL language, collapses whitespace preserved from sqlglot
- `<ExplainPlanViewer>` — recursive tree over `plan_json`, highlighting nodes by `Node Type`, showing `Total Cost` / `Plan Rows` / `Actual Rows` when `ANALYZE` was run (per DEVIATIONS §accepted it isn't today)
- `<SuggestionCard>` — discriminated-union renderer over `kind`:
  - `index` → shows the DDL, "Copy" button, "Apply on fast branch" button (spec 04)
  - `rewrite` → shows before/after SQL
  - `denormalize` / `partition` → shows rationale only (no apply action)
- `<RecentSamplesTable>` — compact 10-row table of the most recent samples
- `<NotFound>` — shown on `HttpError(404)`

## Invariants

1. Monaco is loaded via `next/dynamic({ ssr: false, loading: () => <pre>{canonical_sql}</pre> })` so the RSC ships the raw SQL as a `<pre>` fallback and Monaco hydrates over it client-side. No flash of empty editor.
2. `explain_plan` being `null` renders a friendly notice "EXPLAIN plan not captured yet" — never a broken viewer or empty box.
3. `suggestions` being `[]` renders "No suggestions yet — rules didn't match and LLM fallback is disabled" with a link to the backend's DEVIATIONS §5.
4. Suggestion cards are ordered: `source === "rules"` first, then `source === "llm"`, stable within each group by `id`.
5. `SuggestionCard` is a discriminated union on `kind`; `default:` in the switch is unreachable (enforced by `never` assertion).
6. Copy button uses `navigator.clipboard.writeText`; falls back to a manual select-on-click for Firefox without clipboard permission.
7. The plan viewer never renders `plan_json` as a raw stringified JSON blob unless the tree recursion fails — in which case it shows `<pre>{JSON.stringify(plan_json, null, 2)}</pre>` as a safe fallback.
8. All plan-node text is string-escaped by React; no `dangerouslySetInnerHTML`.
9. Applied-on-fast-branch state is client-local (optimistic after spec 04 returns), never persisted in the dashboard; the backend is the source of truth for `applied_at`.
10. The page is pre-rendered statically where possible; dynamic data flows through Next.js's `use cache` directive with `cacheLife("seconds")` for the fingerprint payload.

## Enumerated test cases

### Happy

1. Given a fixture fingerprint with `canonical_sql`, plan, and one rule-sourced `sort_without_index` index suggestion, the page renders the header, a Monaco `<pre>` fallback with the SQL visible in the RSC HTML, one plan viewer, and one suggestion card with a "Copy" button.
2. A fixture with two suggestions (one rules, one LLM) renders both cards with the rules card first.
3. A fixture with a plan containing a top-level `Sort` node highlights the Sort node with the cost-hotspot colour.
4. `applied_at: null` renders the "Apply on fast branch" button enabled; `applied_at` set renders a "Applied 3 min ago" badge and the button disabled.
5. `RecentSamples` shows 10 rows when 10 samples returned, in descending `sampled_at` order.

### Edge

6. `explain_plan: null` → "EXPLAIN plan not captured yet" notice, no viewer component rendered.
7. `suggestions: []` → empty-state copy, page still valid.
8. `canonical_sql` containing multi-byte Unicode (e.g. a non-ASCII identifier) renders correctly in the `<pre>` fallback and Monaco.
9. `canonical_sql` containing a `</pre>` substring is correctly escaped by React.
10. `recent_samples: []` renders "No recent samples" row.
11. A suggestion with `kind: "rewrite"` renders the before/after block, not a DDL copy button.
12. A suggestion with `kind: "denormalize"` renders rationale only; no apply button.
13. Unknown suggestion `kind` → Zod parse fails at the client boundary (spec 00 invariant); the whole page renders `<ErrorState>` and logs the issue path.
14. Plan viewer recursion on a malformed tree falls back to the raw JSON `<pre>` within the same panel, does not crash the page.

### Failure

15. `HttpError(404)` from `getFingerprint` renders `<NotFound>` with a link back to `/`.
16. `HttpError(500)` renders `<ErrorState>` with "Retry" link.
17. `ParseError` renders `<ErrorState>` server-side and logs Zod issues to server logs only (not leaked to client HTML).
18. Monaco fails to load (e.g. CDN down) → `<pre>` fallback stays visible; the page does not hang.

### Security

19. Fingerprint `id` from the URL is validated against `/^[a-f0-9]{16}$/` at the server boundary; invalid shape renders `<NotFound>` without calling the backend.
20. Suggestion DDL is rendered as text, never executed client-side; "Copy" merely writes to the clipboard.
21. Plan node labels are escaped — fixture with `"Node Type": "<script>"` asserts no `<script>` element in the DOM.
22. Monaco is loaded with `readOnly: true`; the test asserts the editor's `updateOptions({readOnly})` value is `true`.
23. No `id` value is passed through to any `eval`, `new Function`, or template string that gets rendered as HTML.

## Acceptance criteria

- [ ] `src/app/queries/[id]/page.tsx` exists as an RSC with `async` `params`
- [ ] `src/features/query-detail/canonical-sql.tsx` is a client component (Monaco)
- [ ] `src/features/query-detail/explain-plan-viewer.tsx` recursively renders plan nodes
- [ ] `src/features/query-detail/suggestion-card.tsx` is a discriminated union over `kind`
- [ ] `src/features/query-detail/recent-samples-table.tsx` renders up to 10 samples
- [ ] 23 Vitest cases under `tests/features/query-detail/*.test.tsx`
- [ ] One Playwright E2E under `tests/e2e/query-detail.spec.ts` that visits a known-good fingerprint id and asserts the Monaco fallback + at least one suggestion card
- [ ] Biome clean, tsc strict clean, 0 `any`
