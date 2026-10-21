# Spec 08 — slowquery-detective 0.2 response shapes

## Scope

On its `contract-v2` branch slowquery-demo-backend serves `GET /_slowquery/queries` and
`GET /_slowquery/queries/{id}` from slowquery-detective 0.2 (backend spec 15) instead of its own routes.
bastion reads the same routes (`?request_id=`), so the routes keep the library's models and the dashboard
adapts. The library's models are a subset of what the 0.1-era backend returned:

| Field | 0.1-era backend | slowquery-detective 0.2 |
|---|---|---|
| suggestion | `id, fingerprint_id, kind, source, rule, sql, rationale, applied_at` | `kind, source, sql, rationale, applied_at` |
| fingerprint `total_ms` | integer | number |
| `explain_plan` | `fingerprint_id, plan_json, plan_text, cost, captured_at` | `plan_json, cost, captured_at` |
| `recent_samples[]` | `id, fingerprint_id, params, duration_ms, rows, sampled_at` | `duration_ms, request_id, sampled_at` |

## Contract

- `src/lib/api/schemas.ts` accepts **both** shapes: the fields only the 0.1-era backend sent are optional,
  `total_ms` is any non-negative number, and a sample may carry `request_id`. Closed enums stay closed
  (`kind`, `source`), so real drift is still a `ParseError`.
- Rendering never depends on a field the library does not send: React keys and the suggestion order fall
  back to the list position; `total_ms` is shown rounded to whole milliseconds; a sample without `rows`
  shows `—`; the plan viewer reads only `plan_json`.
- The fixtures in `tests/mocks/fixtures/` keep the 0.1-era shape (component suites pin those);
  `tests/mocks/fixtures/library-shapes.ts` derives the library shape from them, and the E2E mock backend
  serves the library shape, so the composed pages are proven against what the backend now returns.

## Test cases

- **S1** a library `QueryRow` list (no suggestion `id`/`fingerprint_id`/`rule`, fractional `total_ms`)
  parses.
- **S2** a library `QueryDetail` (plan without `fingerprint_id`/`plan_text`; samples with `request_id`) parses.
- **S3** the 0.1-era list and detail still parse unchanged.
- **S4** an unknown suggestion `kind`, a negative `total_ms` and a missing `plan_json` are still rejected.
- **S5** the fingerprints table shows a fractional `total_ms` rounded, and renders every suggestion badge of
  a fingerprint whose suggestions have no `id`.
- **S6** the suggestion list puts rule suggestions first and keeps list order within a source when there is
  no `id`.
- **S7** the recent-samples table renders library samples (no `id`, no `rows`) with `—` for rows.
- **S8** (E2E) `/`, `/queries/{id}` and `/timeline` render the library shape served by the mock backend.
