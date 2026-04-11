# Spec 05 — Chromeless demo view at `/demo`

## Goal

One route, one page, no nav chrome, fixed viewport, composed from the building blocks of specs 01 / 03 / 04 — a compact fingerprints panel on the left, the live timeline on the right, the branch indicator + apply button top-center. Designed to be recorded by [ScreenToGif](https://www.screentogif.com/) at `1280×720` producing the single gif the spec's "1200ms → 18ms live drop" money shot lands as. This page exists so the README's demo gif is reproducible on any machine — not a custom component, just a composition.

## Route

`app/demo/page.tsx` — RSC shell. Reuses:

- `<FingerprintsTable compact />` from spec 01 (new `compact` prop hides the sort controls and caps at 5 rows)
- `<LiveTimeline />` from spec 03, with `top=5` hard-coded
- `<BranchIndicator />` + `<ApplyOnFastBranchButton />` from spec 04

No new feature modules — only a new `app/demo/page.tsx` + a tiny `<DemoLayout>` that enforces the fixed `1280×720` viewport and hides the main site chrome.

## Inputs

- Same as specs 01 + 03: `apiClient.listFingerprints()` for seed, SSE stream for live, `switchBranch` for the apply button.
- No user input at all. The page takes no query params, no cookies, no auth headers.

## Outputs

- `<DemoLayout>` — full-viewport layout that:
  - Sets `<body>` to `overflow: hidden`
  - Hides the main navbar (if any is added in later chrome sweeps)
  - Constrains content to `min(100vw, 1280px) × min(100vh, 720px)` centered in the viewport
  - Applies a neutral grid background so the gif isn't pure white
- `<DemoPanel>` — two-column grid: left `<FingerprintsTable compact />`, right `<LiveTimeline />`, top bar holds `<BranchIndicator />` + `<ApplyOnFastBranchButton />`

## Invariants

1. The page reuses existing feature modules unchanged — no duplicate rendering logic. `<FingerprintsTable compact />` is a prop flag, not a separate component.
2. `<DemoLayout>` does not add any network calls of its own; all I/O happens inside the reused feature modules.
3. The viewport is clamped so a user resizing their browser doesn't break the gif composition — the page letterboxes instead.
4. The fingerprints panel is limited to 5 rows (top-by-total_ms), matching `<LiveTimeline top=5 />` so both panels show the same set of fingerprints.
5. No new Zod schemas, no new API methods. If spec 05 needs a new field, it goes in spec 00 first.
6. The page is SEO-invisible: `robots: noindex, nofollow` (demo view, not crawlable content).
7. Dark mode is the default on `/demo` regardless of user preference — gif recordings look better against a dark background.
8. The chromeless layout only applies to `/demo`; other routes keep their normal layout wrapper.

## Enumerated test cases

### Happy

1. RSC renders both panels simultaneously with seed data from `listFingerprints()`.
2. The left panel shows exactly 5 rows (or fewer if the seed has fewer).
3. The right panel (`<LiveTimeline />`) is mounted and transitions `connecting → live` when the mock SSE starts.
4. The apply button is visible in the top bar and triggers spec 04's flow when clicked.
5. Document `<head>` has `<meta name="robots" content="noindex,nofollow">`.
6. `<body>` class on `/demo` includes `overflow-hidden`; on `/` it does not.

### Edge

7. Seed returns 0 fingerprints → left panel shows the empty state from spec 01; right panel still mounts and shows "Waiting for events".
8. Viewport `< 1280×720` letterboxes instead of scrolling — `<DemoLayout>` is flex-centered with `max-w` / `max-h` clamps.
9. Viewport `> 1280×720` (4K monitor) letterboxes with a neutral backdrop; inner content stays `1280×720`.
10. Dark mode is applied regardless of `prefers-color-scheme: light`.

### Failure

11. Seed fetch throws `HttpError(500)` → `<ErrorState>` takes over the left panel; right panel still mounts and renders "Waiting for events".
12. Branch switch fails during the gif recording → toast appears over the panels without shifting layout (absolute positioning, not flex child).
13. SSE fallback polling kicks in → `<StreamStatus>` shows `fallback polling` inside the right panel without breaking layout.

### Security

14. The chromeless layout does not expose any additional endpoints or data beyond what specs 01 + 03 + 04 already consume.
15. `robots: noindex` is asserted in both a Vitest DOM check and a Playwright page assertion.
16. No `dangerouslySetInnerHTML` anywhere in `<DemoLayout>` or `<DemoPanel>`.

## Acceptance criteria

- [ ] `src/app/demo/page.tsx` renders the composed view as an RSC
- [ ] `src/app/demo/layout.tsx` implements `<DemoLayout>` with the 1280×720 clamp
- [ ] `<FingerprintsTable>` gains a `compact?: boolean` prop (new test case added to spec 01)
- [ ] `<LiveTimeline>` accepts a `top` prop override (new test case added to spec 03)
- [ ] 16 Vitest cases under `tests/app/demo/*.test.tsx`
- [ ] One Playwright E2E under `tests/e2e/demo.spec.ts` that visits `/demo`, asserts both panels are mounted, takes a baseline screenshot, and validates the viewport clamp
- [ ] The Playwright screenshot is used as the first frame of `assets/demo.gif` (recorded manually at S6)
- [ ] Biome clean, tsc strict clean, 0 `any`
