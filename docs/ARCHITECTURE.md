# Architecture

The slowquery dashboard is a Next.js 16 App Router application deployed on Vercel. It is the frontend for `slowquery-demo-backend` (FastAPI on Render), which runs slow queries against two Neon Postgres branches to demonstrate index-driven performance improvements.

## System context

```mermaid
flowchart TD
    Browser[Browser] --> Vercel[Vercel Edge Network]
    Vercel --> Next[Next.js 16 App Router<br>RSC + Client Components]

    Next -- "GET /queries" --> API[slowquery-demo-backend<br>Render]
    Next -- "GET /queries/:id" --> API
    Next -- "GET /api/stream (SSE)" --> API
    Next -- "POST /branches/switch" --> API

    API --> Slow[(Neon: slowquery branch<br>no indexes)]
    API --> Fast[(Neon: slowquery-fast branch<br>optimized indexes)]

    style Browser fill:#0a0a0a,stroke:#2a2a3d,color:#fafafa
    style Slow fill:#12121a,stroke:#a78bfa,color:#fafafa
    style Fast fill:#12121a,stroke:#a78bfa,color:#fafafa
```

## Component map

| Layer | Module | Purpose | Key files |
|---|---|---|---|
| Routes | `/` | Fingerprints table (landing page) | `src/app/page.tsx` |
| Routes | `/queries/[id]` | Query detail: SQL, EXPLAIN, suggestions | `src/app/queries/[id]/page.tsx` |
| Routes | `/timeline` | Live latency chart via SSE | `src/app/timeline/page.tsx` |
| Routes | `/demo` | Guided demo panel for interviews | `src/app/demo/page.tsx`, `demo-panel.tsx` |
| Terminal UI | AppNav, PageFrame, StatusBar, TerminalWindow | Shared shell with terminal aesthetic | `src/components/terminal/` |
| Feature | fingerprints | Table, sort, rule badges, Zod parse | `src/features/fingerprints/` |
| Feature | query-detail | Canonical SQL, EXPLAIN plan viewer, suggestion card | `src/features/query-detail/` |
| Feature | timeline | Live SSE chart, backoff, buffer, branch markers | `src/features/timeline/` |
| Feature | branches | Apply button, branch indicator, Zustand store | `src/features/branches/` |
| Lib | api/client | Typed fetch wrapper with error handling | `src/lib/api/client.ts` |
| Lib | api/schemas | Zod schemas for all API responses | `src/lib/api/schemas.ts` |
| Lib | api/errors | Discriminated error union (network, parse, http) | `src/lib/api/errors.ts` |
| Lib | api/sse | SSE helper with reconnection logic | `src/lib/api/sse.ts` |
| Lib | env | Runtime env parsing via Zod | `src/lib/env.ts` |

## Data flow: fingerprints page

```mermaid
flowchart TD
    RSC[RSC: page.tsx] --> Fetch[fetch /queries<br>server-side]
    Fetch --> Zod[Zod parse<br>FingerprintArraySchema]
    Zod -->|success| Table[FingerprintsTable<br>client component]
    Zod -->|failure| Err[ErrorState<br>typed error display]
    Table --> Sort[SortHeader<br>client-side sort]
    Table --> Badges[RuleBadges<br>sort_without_index, seq_scan, etc.]
    Table --> Link[Click row -> /queries/id]
```

## SSE timeline

```mermaid
sequenceDiagram
    participant B as Browser
    participant Hook as useSSE hook
    participant API as Backend SSE
    participant Store as Zustand Store
    participant Chart as Recharts

    B->>Hook: Mount LiveTimeline
    Hook->>API: EventSource /api/stream
    API-->>Hook: data: {fingerprint, p95, ts}
    Hook->>Hook: Buffer events (100ms window)
    Hook->>Store: Batch append to timeline store
    Store->>Chart: Re-render latency chart

    Note over Hook,API: On disconnect
    Hook->>Hook: Exponential backoff (1s, 2s, 4s, max 30s)
    Hook->>API: Reconnect EventSource
```

## Branch switch

```mermaid
sequenceDiagram
    participant U as User
    participant Btn as ApplyButton
    participant API as Backend
    participant Store as BranchStore (Zustand)
    participant TL as LiveTimeline

    U->>Btn: Click "Apply on fast branch"
    Btn->>API: POST /branches/switch {branch: "fast"}
    API-->>Btn: 200 OK
    Btn->>Store: setBranch("fast")
    Store->>TL: Branch marker injected
    Note over TL: p95 drops from ~1200ms to ~18ms<br>within next SSE batch
```

## Feature module structure

Each feature directory (`src/features/*`) is self-contained:

- **Components** — React client components scoped to that feature
- **Parse** — Zod parsing functions that validate API data at the boundary
- **Format** — Pure display formatters (duration, percentiles, SQL highlighting)
- **Store** (where needed) — Zustand slice for client-side state (branches, timeline buffer)
- **Error routing** — Maps typed error unions to user-facing messages

Features import from `src/lib/` but never from each other. The `lib/api/` layer owns all network calls and Zod schemas; features consume parsed, typed data.

## Invariants

1. **Zod at every boundary** — all API responses are parsed through Zod schemas before reaching components. No `any` types cross module boundaries.
2. **Typed error union** — network errors, HTTP errors, and parse errors are discriminated (`{ tag: "network" } | { tag: "http", status } | { tag: "parse", issues }`). Components pattern-match on the tag to render appropriate error states.
3. **Discriminated suggestions** — query optimization suggestions carry a `kind` field (`rule_based | llm_fallback`) so the UI can distinguish deterministic rule matches from LLM-generated advice.
4. **SSE reconnection** — the SSE hook uses exponential backoff with jitter. It never silently drops the connection; the StatusBar reflects connection state.
5. **Branch state is global** — the active Neon branch lives in a Zustand store so the timeline, fingerprints table, and apply button stay in sync without prop drilling.
6. **Server Components by default** — only components that need browser APIs (EventSource, Zustand, Monaco) are marked `"use client"`. Pages fetch data server-side.
