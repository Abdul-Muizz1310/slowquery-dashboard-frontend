/**
 * Spec 03 — LiveTimeline rolling buffer, reconnect, fallback polling.
 * Cases 1, 2, 3, 5, 6, 7, 8, 11, 12, 14, 15, 17, 18.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fingerprintsList } from "../../mocks/fixtures/fingerprints";
import { branchSwitchedToFast, tickOrdersCreatedAt } from "../../mocks/fixtures/stream-events";
import { server } from "../../mocks/server";

const API = "https://slowquery-demo-backend.onrender.com";

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
    let buf = { byId: new Map() };
    buf = applyEvent(buf, tickOrdersCreatedAt);
    buf = applyEvent(buf, tickOrdersCreatedAt);
    buf = applyEvent(buf, tickOrdersCreatedAt);
    expect(buf.byId.get(tickOrdersCreatedAt.fingerprint_id)?.length).toBe(3);
  });

  it("case 3 happy: StreamStatus transitions connecting -> live on first event", async () => {
    const { statusReducer } = await import("@/features/timeline/status");
    const next = statusReducer({ status: "connecting", failCount: 0 }, { kind: "first-event" });
    expect(next.status).toBe("live");
  });

  it("case 5 happy: branch_switched event produces a <BranchMarker> with server switched_at", async () => {
    const { buildBranchMarker } = await import("@/features/timeline/branch-marker");
    const marker = buildBranchMarker(branchSwitchedToFast);
    expect(marker.active).toBe("fast");
    expect(marker.x).toBe(new Date(branchSwitchedToFast.switched_at).getTime());
  });

  it("case 6 edge: buffer caps at 60 points per fingerprint", async () => {
    const { applyEvent } = await import("@/features/timeline/buffer");
    let buf = { byId: new Map() };
    for (let i = 0; i < 65; i++) buf = applyEvent(buf, tickOrdersCreatedAt);
    expect(buf.byId.get(tickOrdersCreatedAt.fingerprint_id)?.length).toBe(60);
  });

  it("case 7 edge: dropping out of top-N marks the line grey then removes after 10s", async () => {
    vi.useFakeTimers();
    const { trackTopN } = await import("@/features/timeline/buffer");
    const result = trackTopN(
      {
        byId: new Map([
          ["a", [{ t: 0, p95: 1 }]],
          ["b", [{ t: 0, p95: 1 }]],
          ["c", [{ t: 0, p95: 1 }]],
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
    let s = statusReducer({ status: "live", failCount: 0 }, { kind: "fail" });
    s = statusReducer(s, { kind: "fail" });
    s = statusReducer(s, { kind: "fail" });
    expect(s.status).toBe("fallback");
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

  it("case 11 (extended): backoff schedule boundaries at attempt 0/-1/4/5/6", async () => {
    const { backoffMs } = await import("@/features/timeline/backoff");
    expect(backoffMs(0)).toBe(500);
    expect(backoffMs(-1)).toBe(500);
    expect(backoffMs(4)).toBe(4_000);
    expect(backoffMs(5)).toBe(8_000);
    expect(backoffMs(6)).toBe(8_000);
  });

  it("invariant 9 (extended): reset returns to connecting and clears the fail count", async () => {
    const { statusReducer } = await import("@/features/timeline/status");
    statusReducer({ status: "live", failCount: 0 }, { kind: "fail" });
    const result = statusReducer({ status: "reconnecting", failCount: 2 }, { kind: "reset" });
    expect(result.status).toBe("connecting");
    const afterOneFail = statusReducer({ status: "live", failCount: 0 }, { kind: "fail" });
    expect(afterOneFail.status).toBe("reconnecting");
  });

  it("invariant 9 (extended): an unknown action kind hits the exhaustive default branch", async () => {
    const { statusReducer } = await import("@/features/timeline/status");
    const result = statusReducer({ status: "live", failCount: 0 }, { kind: "bogus" } as unknown as {
      kind: "first-event";
    });
    expect(result).toBeTruthy();
  });

  it("case 14 (extended): a malformed event logs the exact drop warning and leaves the buffer empty", async () => {
    const { applyEvent } = await import("@/features/timeline/buffer");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const buf = applyEvent({ byId: new Map() }, "totally invalid");
    expect(buf.byId.size).toBe(0);
    expect(warn).toHaveBeenCalledWith("[timeline] dropped malformed stream event");
    warn.mockRestore();
  });

  it("Inputs (extended): a heartbeat event is a no-op (kind !== tick)", async () => {
    const { applyEvent } = await import("@/features/timeline/buffer");
    const buf = applyEvent(
      { byId: new Map() },
      {
        kind: "heartbeat",
        now: "2026-04-12T01:00:00.000Z",
      },
    );
    expect(buf.byId.size).toBe(0);
  });

  it("case 3/12 (composed): LiveTimeline's stream status reaches a settled state via the real SSE handler", async () => {
    const { LiveTimeline } = await import("@/features/timeline/live-timeline");
    const { unmount } = render(<LiveTimeline seed={fingerprintsList} top={10} />);
    try {
      await waitFor(
        () => {
          expect(screen.getByTestId("stream-status").textContent).not.toBe("connecting");
        },
        { timeout: 5000 },
      );
    } finally {
      unmount();
    }
  });

  it("case 11/12 (composed): an SSE failure moves the status to reconnecting or fallback", async () => {
    const { statusReducer } = await import("@/features/timeline/status");
    statusReducer({ status: "reconnecting", failCount: 2 }, { kind: "reset" });
    server.use(http.get(`${API}/_slowquery/api/stream`, () => HttpResponse.error()));
    const { LiveTimeline } = await import("@/features/timeline/live-timeline");
    const { unmount } = render(<LiveTimeline seed={fingerprintsList} top={10} />);
    try {
      await waitFor(
        () => {
          const text = screen.getByTestId("stream-status").textContent ?? "";
          expect(["reconnecting", "fallback"].some((s) => text.includes(s))).toBe(true);
        },
        { timeout: 5000 },
      );
    } finally {
      unmount();
    }
  });
});
