# Spec 04 — Branch switch panel + "Apply on fast branch" button

## Goal

Give the user one button that POSTs `{target: "fast"}` to `/branches/switch`, surfaces the live latency of the switch in a toast, flips the client-side "active branch" indicator, and cues `<LiveTimeline>` to place a `<BranchMarker>` at the server-reported `switched_at` so the before/after is visible on the chart. This is the "1200ms → 18ms drop" moment the whole Phase 4 story is built around. The button lives both in `<SuggestionCard kind="index">` (spec 02) and as a standalone toggle on `/demo` (spec 05).

## Inputs

- `apiClient.switchBranch(target: BranchName)` from spec 00
- `SwitchBranchResponse = { active: "slow" | "fast", switched_at: Date, latency_ms: number }` — parsed from JSON into a real `Date`
- A global client store (Zustand, small) holding `activeBranch: BranchName` + `switchInFlight: boolean` so both surfaces stay in sync without prop-drilling

## Outputs

- `<ApplyOnFastBranchButton>` — primary variant renders "Apply on fast branch" when `activeBranch === "slow"`, disabled "Already on fast" when `activeBranch === "fast"`, disabled "Switching…" while `switchInFlight`
- `<BranchIndicator>` — pill showing `slow` (red) or `fast` (green), visible in the top-right of every page
- `<SwitchToast>` — transient toast on success: "Switched to `fast` in 1.9s"; on failure: the typed error mapped to a friendly message
- Zustand store `useBranchStore` exporting `activeBranch`, `switchInFlight`, `switch(target)`, `reset()`

## Invariants

1. `useBranchStore.switch(target)` is the only caller of `apiClient.switchBranch`. No component calls the API directly.
2. While `switchInFlight === true`, every `<ApplyOnFastBranchButton>` instance on the page is disabled — concurrent switches are impossible from the UI.
3. `useBranchStore.switch(target)` is idempotent against the same target: if `activeBranch === target` or `switchInFlight === true`, it returns immediately without a network call.
4. On `HttpError(409)` ("switch already in progress" from the backend's `asyncio.Lock`), the toast says exactly that and the store does **not** flip `activeBranch`.
5. On `HttpError(500)`, the store does not optimistically flip `activeBranch`; the button re-enables after the error resolves.
6. On success, the store flips `activeBranch` first, then closes the toast after 4s.
7. `BranchName` is never read from user input; it's always a literal in code (`"fast"` from the apply button, `"slow"` from the reset button on `/demo`).
8. The store is hydration-safe: `activeBranch` is seeded from an RSC prop on the first render, not read from `localStorage`.
9. A successful switch emits a synthetic `branch_switched` event into `<LiveTimeline>`'s event queue so the chart marker renders even if the backend's SSE hasn't caught up. The marker uses `response.switched_at`, not client `Date.now()`, as the X position.
10. The button is a plain `<button>` (not a `<form>` with a Server Action) so the request completes without a full route transition — the user stays on the detail page or `/demo`.

## Acknowledged backend gap

Per [slowquery-demo-backend/docs/DEVIATIONS.md §3](slowquery-demo-backend/docs/DEVIATIONS.md#3-post-branchesswitch-does-not-actually-rebuild-the-engine), the backend endpoint today validates, persists `.branch_state`, and returns a well-formed `SwitchBranchResponse`, but **does not** rebuild the SQLAlchemy engine — subsequent queries still hit whichever branch the process booted on. The frontend cannot distinguish "switched" from "rebuilt and routing to fast" from the client alone. This spec ships against the endpoint-as-contract; the backend-side close described in DEVIATIONS §3 lands in the pre-S5 backend sweep. Until that sweep, the demo gif will show the p95 line flattening for a different reason (caching) rather than a real index hit.

## Enumerated test cases

### Happy

1. Click the apply button while `activeBranch === "slow"` → store sets `switchInFlight = true`, makes one POST, receives `{active: "fast", switched_at, latency_ms: 1850}`, flips `activeBranch` to `"fast"`, shows success toast with "1.9s".
2. `<BranchIndicator>` flips from red `slow` to green `fast` after the store updates.
3. After success, `<LiveTimeline>` receives a synthetic `branch_switched` event with the server's `switched_at`.
4. `<ApplyOnFastBranchButton>` renders "Already on fast" (disabled) when `activeBranch === "fast"`.

### Edge

5. Clicking the button twice rapidly results in exactly one POST (the second call short-circuits on `switchInFlight === true`).
6. Clicking the button when `activeBranch === target` (no-op case) results in zero POSTs.
7. `latency_ms < 1000` renders as "in 0.9s"; `latency_ms >= 1000` renders as "in 2.1s"; `latency_ms >= 10000` renders as "in 12s".
8. A switch that takes > 30s times out per spec 00's 10s default (configurable per-method to 45s for this endpoint specifically) and resolves into the failure path.
9. Store hydrates from the RSC prop once; re-mounting the button component does not re-hit localStorage.
10. `activeBranch` in the RSC prop is validated against the Zod `BranchName` enum; an unexpected value (e.g. backend file corrupted) falls back to `"slow"`.

### Failure

11. `HttpError(500)` → toast "Backend error — try again"; `activeBranch` unchanged; button re-enables.
12. `HttpError(409)` → toast "Switch already in progress"; `activeBranch` unchanged.
13. `HttpError(422)` (should be unreachable given our literal type, but parse the message) → toast "Invalid branch target".
14. `TimeoutError` → toast "Switch timed out — the server may still finish"; button re-enables.
15. `ParseError` (backend returns unexpected shape) → toast "Backend response looked malformed"; `activeBranch` unchanged.

### Security

16. Target literal is enforced by TypeScript; no path in the app concatenates a string into the POST body.
17. The button never renders any user-controlled string; all copy is constant.
18. The Zustand store is declared with `devtools` off in production builds (no Redux devtools exposing state to extensions).
19. The POST body is `JSON.stringify({target})` with `Content-Type: application/json`; no form-encoded or query-string path.

## Acceptance criteria

- [ ] `src/features/branches/use-branch-store.ts` is the Zustand store
- [ ] `src/features/branches/apply-button.tsx` is the primary `<ApplyOnFastBranchButton>`
- [ ] `src/features/branches/branch-indicator.tsx` is the pill
- [ ] `src/features/branches/switch-toast.tsx` consumes the success/failure result
- [ ] `<SuggestionCard kind="index">` (spec 02) renders the apply button
- [ ] `<LiveTimeline>` (spec 03) consumes synthetic `branch_switched` events from the store
- [ ] 19 Vitest cases under `tests/features/branches/*.test.tsx`
- [ ] One Playwright E2E under `tests/e2e/branch-switch.spec.ts` that clicks the button and asserts the indicator flips
- [ ] Biome clean, tsc strict clean, 0 `any`
