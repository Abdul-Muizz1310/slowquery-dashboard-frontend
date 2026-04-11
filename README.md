# slowquery-dashboard-frontend

> Next.js dashboard for [`slowquery-detective`](https://pypi.org/project/slowquery-detective/) — live fingerprints table, EXPLAIN plan viewer with rule/LLM suggestions, live p95 timeline, and one-click branch switch between a slow and fast Neon branch.

![ci](https://img.shields.io/github/actions/workflow/status/Abdul-Muizz1310/slowquery-dashboard-frontend/ci.yml?style=flat-square)
![node](https://img.shields.io/badge/node-24-3c873a?style=flat-square&logo=node.js&logoColor=white)
![license](https://img.shields.io/github/license/Abdul-Muizz1310/slowquery-dashboard-frontend?style=flat-square)

**Live:** _coming in S5 at_ `https://slowquery-dashboard-frontend.vercel.app`
**Backend:** https://slowquery-demo-backend.onrender.com

Phase 4c of the slowquery-detective portfolio project. Consumes the dashboard API and SSE stream exposed by [`slowquery-demo-backend`](https://github.com/Abdul-Muizz1310/slowquery-demo-backend) on `/_slowquery/*`.

Authoritative spec: [`docs/projects/50-slowquery-detective.md`](https://github.com/Abdul-Muizz1310/slowquery-detective/blob/main/docs/projects/50-slowquery-detective.md).

## What it shows

| View | Purpose |
|---|---|
| `/` | Fingerprints table sorted by `total_ms` desc with p50/p95/p99, call counts, and the `sort_without_index` / `seq_scan_large_table` / `n_plus_one` rule badges |
| `/queries/[id]` | Single-fingerprint detail: canonical SQL in Monaco, EXPLAIN plan JSON with a postgres-plan highlighter, suggestion cards (rule-sourced first, LLM fallback second) |
| `/timeline` | Live p95 line chart per fingerprint via SSE |
| `/demo` | Chromeless version for the README gif — fingerprints panel + timeline + branch-switch button |

The "apply suggestion" button POSTs to `/branches/switch` on the backend and the timeline re-renders against the fast branch — that's the 1200ms → 18ms drop the demo is built around.

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 16 App Router, React 19, React Server Components where they make sense |
| Language | TypeScript 5 strict, no `any` |
| Styling | Tailwind 4 via `@tailwindcss/postcss` |
| Lint / format | Biome 2 |
| Unit tests | Vitest 4 + Testing Library + jsdom |
| E2E | Playwright (chromium only) |
| Charts | Recharts (added in S3/S4 when the timeline spec lands) |
| Code / plan viewer | Monaco via `@monaco-editor/react` (added in S3/S4) |
| Runtime validation | Zod at all backend/API boundaries |
| Package manager | pnpm 10, Node 24 |
| Hosting | Vercel Hobby, auto-deploy on push to main |

## Engineering principles

- **Spec-TDD** — every feature has a spec in [`docs/specs/`](docs/specs/) with enumerated test cases before code ships.
- **Negative-space programming** — Zod parse at every boundary, discriminated unions for suggestion kinds, `Literal` types for branch targets.
- **Pure core, imperative shell** — fetchers and SSE wiring live at the edges; presentation components are dumb and unit-testable.

## Run locally

```bash
pnpm install
cp .env.example .env.local                   # point at the live Render backend or your own
pnpm dev                                     # → http://localhost:3000
pnpm test                                    # unit tests (vitest)
pnpm test:e2e                                # Playwright E2E
pnpm lint && pnpm typecheck && pnpm build    # full CI gate locally
```

## Phase status

- [x] S1 — scaffold Next.js 16 + Biome + Vitest + Playwright, CI green on empty project
- [ ] S2 — feature specs (`docs/specs/00..05`)
- [ ] S3 — red tests for every enumerated case
- [ ] S4 — green implementation of every spec
- [ ] S5 — Vercel deploy + wired to live backend
- [ ] S6 — acceptance criteria green, README gif, `v0.1.0` tag

See [`docs/PLAN.md §9.4`](https://github.com/Abdul-Muizz1310/slowquery-detective/blob/main/docs/PLAN.md) for the full phase plan.
