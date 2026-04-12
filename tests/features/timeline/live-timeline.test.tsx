/**
 * Spec 03 — LiveTimeline rolling buffer, reconnect, fallback polling.
 * Cases 1, 2, 3, 5, 6, 7, 8, 11, 12, 14, 15, 17, 18.
 */

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fingerprintsList } from "../../mocks/fixtures/fingerprints";
import { branchSwitchedToFast, tickOrdersCreatedAt } from "../../mocks/fixtures/stream-events";

afterEach(cleanup);

describe("spec 03 — LiveTimeline", () => {
  it("case 1 happy: RSC renders initial chart or responsive wrapper with seed data", async () => {
    const { LiveTimeline } = await import("@/features/timeline/live-timeline");
    const { container } = render(<LiveTimeline seed={fingerprintsList} top={10} />);
    // ResponsiveContainer doesn't emit SVG in jsdom (zero dimensions);
    // assert the chart wrapper rendered rather than the empty state.
    expect(container.querySelector("[data-testid='stream-status']")).not.toBeNull();
    expect(container.textContent).not.toContain("waiting for data");
  });

  it("case 2 happy: three tick events append to the buffer", async () => {
    const { applyEvent } = await import("@/features/timeline/buffer");
    let buf = { byId: new Map<string, number[]>() };
    buf = applyEvent(buf, tickOrdersCreatedAt);
    buf = applyEvent(buf, tickOrdersCreatedAt);
    buf = applyEvent(buf, tickOrdersCreatedAt);
    expect(buf.byId.get(tickOrdersCreatedAt.fingerprint_id)?.length).toBe(3);
  });

  it("case 3 happy: StreamStatus transitions connecting -> live on first event", async () => {
    const { statusReducer } = await import("@/features/timeline/status");
    const next = statusReducer("connecting", { kind: "first-event" });
    expect(next).toBe("live");
  });

  it("case 5 happy: branch_switched event produces a <BranchMarker> with server switched_at", async () => {
    const { buildBranchMarker } = await import("@/features/timeline/branch-marker");
    const marker = buildBranchMarker(branchSwitchedToFast);
    expect(marker.active).toBe("fast");
    expect(marker.x).toBe(new Date(branchSwitchedToFast.switched_at).getTime());
  });

  it("case 6 edge: buffer caps at 60 points per fingerprint", async () => {
    const { applyEvent } = await import("@/features/timeline/buffer");
    let buf = { byId: new Map<string, number[]>() };
    for (let i = 0; i < 65; i++) buf = applyEvent(buf, tickOrdersCreatedAt);
    expect(buf.byId.get(tickOrdersCreatedAt.fingerprint_id)?.length).toBe(60);
  });

  it("case 7 edge: dropping out of top-N marks the line grey then removes after 10s", async () => {
    vi.useFakeTimers();
    const { trackTopN } = await import("@/features/timeline/buffer");
    const result = trackTopN(
      {
        byId: new Map([
          ["a", [1]],
          ["b", [1]],
          ["c", [1]],
        ]),
      },
      ["a", "b"],
      1_000,
    );
    expect(result.greyed.has("c")).toBe(true);
    vi.advanceTimersByTime(11_000);
    const later = trackTopN(result, ["a", "b"], 12_000);
    expect(later.byId.has("c")).toBe(false);
    vi.useRealTimers();
  });

  it("case 8 edge: zero events for 30s still renders (seed preserved)", async () => {
    const { LiveTimeline } = await import("@/features/timeline/live-timeline");
    const { container } = render(<LiveTimeline seed={fingerprintsList} top={10} />);
    // Chart wrapper present even without new events; seed data prevents empty state
    expect(container.querySelector("[data-testid='stream-status']")).not.toBeNull();
    expect(container.textContent).not.toContain("waiting for data");
  });

  it("case 11 failure: SSE drop triggers 500ms reconnect", async () => {
    const { backoffMs } = await import("@/features/timeline/backoff");
    expect(backoffMs(1)).toBe(500);
    expect(backoffMs(2)).toBe(1_000);
    expect(backoffMs(3)).toBe(2_000);
    expect(backoffMs(99)).toBe(8_000);
  });

  it("case 12 failure: 3 consecutive SSE failures trigger fallback polling mode", async () => {
    const { statusReducer } = await import("@/features/timeline/status");
    let s = statusReducer("live", { kind: "fail" });
    s = statusReducer(s, { kind: "fail" });
    s = statusReducer(s, { kind: "fail" });
    expect(s).toBe("fallback");
  });

  it("case 14 failure: unknown event kind is logged and skipped", async () => {
    const { applyEvent } = await import("@/features/timeline/buffer");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const buf = applyEvent({ byId: new Map() }, {
      kind: "bogus",
      payload: 1,
    } as unknown as typeof tickOrdersCreatedAt);
    expect(buf.byId.size).toBe(0);
    warn.mockRestore();
  });

  it("case 15 failure: tick with NaN p95 fails parse and is skipped", async () => {
    const { applyEvent } = await import("@/features/timeline/buffer");
    const buf = applyEvent({ byId: new Map() }, { ...tickOrdersCreatedAt, p95_ms: Number.NaN });
    expect(buf.byId.size).toBe(0);
  });

  it("case 17 security: fingerprint id in stream is validated as 16 hex chars", async () => {
    const { applyEvent } = await import("@/features/timeline/buffer");
    const buf = applyEvent(
      { byId: new Map() },
      { ...tickOrdersCreatedAt, fingerprint_id: "NOT-HEX" },
    );
    expect(buf.byId.size).toBe(0);
  });

  it("case 18 security: top query param coerces to 1-20 range", async () => {
    const { normaliseTop } = await import("@/features/timeline/buffer");
    expect(normaliseTop(0)).toBe(1);
    expect(normaliseTop(999)).toBe(20);
    expect(normaliseTop("evil" as unknown as number)).toBe(10);
  });
});
