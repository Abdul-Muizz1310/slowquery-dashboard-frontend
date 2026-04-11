# Spec 03 — Live p95 timeline at `/timeline`

## Goal

Render a live multi-line Recharts time-series where each line is one fingerprint's p95 latency over the last 60 seconds, updating in real time from `/_slowquery/api/stream`. This is the page the branch-switch story plays out on — the reader watches a line spike red under the `slow` branch, clicks "Apply on fast branch" (spec 04), and watches the line collapse to <20ms live. Cap the number of lines at the top-N by `total_ms` so the chart stays readable.

## Route

`app/timeline/page.tsx` — thin RSC shell that issues one `apiClient.listFingerprints()` for the initial seed, then passes the seed into a client component `<LiveTimeline>` that opens the SSE connection.

## Inputs

- `apiClient.listFingerprints()` — seed data for the first render so the chart isn't empty before any event arrives
- `apiClient.streamFingerprints(signal)` — async iterable of `StreamEvent`s:
  ```ts
  type StreamEvent =
    | { kind: "tick"; fingerprint_id: string; p95_ms: number; sampled_at: string }
    | { kind: "heartbeat"; now: string }
    | { kind: "branch_switched"; active: "slow" | "fast"; switched_at: string }
  ```
- Route query param `top` (default 10, max 20) to control line count

## Outputs

- `<LiveTimeline>` — client component managing an in-memory rolling buffer keyed by `fingerprint_id`, max 60 points per line
- `<LatencyChart>` — pure Recharts `<LineChart>` renderer, dumb and prop-driven
- `<StreamStatus>` — small client indicator showing one of `connecting | live | reconnecting in Ns | fallback polling`
- `<BranchMarker>` — vertical reference line on the chart placed at every `branch_switched` event's timestamp, labelled with the new active branch
- `<TopNSelector>` — client island that rewrites `?top=N`

## Invariants

1. SSE connection opens in a `useEffect` with an `AbortController`; closes on unmount.
2. Reconnection uses exponential backoff: `500ms, 1s, 2s, 4s, 8s, capped at 8s`; counter resets on a successful event.
3. After 3 consecutive failed connection attempts, the component switches to **polling fallback** — `apiClient.listFingerprints()` every 2s — and displays `fallback polling` in `<StreamStatus>`. The backend SSE gap (DEVIATIONS §absent) is the main reason this path exists.
4. The rolling buffer is capped at 60 points per line. Overflow drops the oldest point.
5. The chart renders **exactly** N lines where `N = min(top, topFingerprintsByTotalMs.length)`. A fingerprint that drops out of the top-N has its line greyed out and removed after 10s.
6. `StreamEvent` is Zod-parsed per event in the client helper; malformed events are skipped and logged (not thrown).
7. `branch_switched` events trigger a `<BranchMarker>` at the event's `switched_at` and a subtle background colour flash. Rolling buffer is **not** cleared (we want to see the before/after on the same chart).
8. Chart's X axis is always "seconds ago" from `Date.now()`, recomputed every 500ms via `setInterval` inside the component; unmount clears the interval.
9. No `any`. `StreamEvent` is a discriminated union; exhaustive `switch` with `never` default.
10. The component does not mutate state from outside React (no module-level globals); all mutation is inside `useState`/`useRef`.
11. Hydration-safe: server renders the seed chart without any `Date.now()` calls. `Date.now()`-dependent rendering happens only after mount in a `useEffect`.

## Enumerated test cases

### Happy

1. RSC renders an initial chart populated with one point per seed fingerprint (at `x = 0s ago`).
2. Client receives three `tick` events for fingerprint `abc` and the chart now has four points on the `abc` line (seed + 3).
3. `StreamStatus` transitions `connecting → live` on first successful event.
4. `TopNSelector` rewrites `?top=5` and `LatencyChart` renders at most 5 lines.
5. `branch_switched` event places a `<BranchMarker>` at the correct X position, labelled with the new branch.

### Edge

6. Buffer cap: receiving 65 ticks for a single fingerprint leaves 60 points on that line.
7. A fingerprint that falls out of the top-N is greyed out immediately and removed after 10 simulated seconds (`vi.useFakeTimers`).
8. Receiving 0 events for 30 seconds still renders the chart (seed) without crashing — heartbeat events keep the connection alive.
9. Chart X axis correctly shows "30s ago" for a point whose `sampled_at` was 30 seconds before `Date.now()`.
10. `top=0` is clamped to `top=1`; `top=999` is clamped to `top=20`.

### Failure

11. SSE connection drops once → reconnects after 500ms; `StreamStatus` shows `reconnecting in 500ms`.
12. Three consecutive SSE failures → `StreamStatus` shows `fallback polling`; polling path issues `listFingerprints()` calls.
13. Polling path throws `HttpError` → `<ErrorState>` overlays the chart; existing chart data remains visible underneath.
14. `StreamEvent` with unknown `kind` is logged (`console.warn` stub assertion) and skipped; no crash.
15. A `tick` event with `p95_ms: NaN` fails Zod parse and is skipped (Zod's `.finite()` on the number).

### Security

16. SSE endpoint URL is always constructed from `env.apiUrl`; no user input is concatenated into it.
17. Fingerprint ids in the stream are validated before being used as chart keys (same `^[a-f0-9]{16}$` regex as spec 02).
18. `top` query param is coerced via `z.coerce.number().int().min(1).max(20)`; any other value falls back to 10.
19. The SSE `EventSource` (or `fetch` + `ReadableStream` equivalent) is closed on unmount and on tab-hidden (`visibilitychange`), so backgrounded tabs don't leak connections.

## Acceptance criteria

- [ ] `src/app/timeline/page.tsx` exists as an RSC that passes seed data to `<LiveTimeline>`
- [ ] `src/features/timeline/live-timeline.tsx` is the stateful client component
- [ ] `src/features/timeline/latency-chart.tsx` is a pure Recharts wrapper
- [ ] `src/lib/api/sse.ts` exposes an SSE-or-polling helper consumed by `streamFingerprints`
- [ ] 19 Vitest cases under `tests/features/timeline/*.test.tsx`
- [ ] One Playwright E2E under `tests/e2e/timeline.spec.ts` that visits `/timeline`, asserts `<StreamStatus>` reaches `live` or `fallback polling`, and captures a screenshot for the README gif baseline
- [ ] Biome clean, tsc strict clean, 0 `any`, Recharts is the only chart dep
