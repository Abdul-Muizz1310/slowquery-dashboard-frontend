/**
 * Integration tests that drive the *composed* request/render paths, not the
 * pure helpers. These are the assertions the audit's "coverage-driven, not
 * integration" finding asked for: they fail against the pre-fix wiring gaps
 * (empty rule badges, unwired reconnect, unwired branch markers, index-as-
 * timestamp X-axis) rather than exercising exported functions in isolation.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fingerprintsList } from "../mocks/fixtures/fingerprints";
import { tickOrdersCreatedAt } from "../mocks/fixtures/stream-events";
import { server } from "../mocks/server";

const API = "https://slowquery-demo-backend.onrender.com";

afterEach(cleanup);

/* ------------------------------------------------------------------ */
/* Finding 3 — rule badges are populated on the real landing page      */
/* ------------------------------------------------------------------ */
describe("/ page — rule badges (composed RSC)", () => {
  it("renders a rule badge and an llm badge from the fetched list suggestions", async () => {
    const Page = (await import("@/app/page")).default;
    const el = await Page({ searchParams: Promise.resolve({}) });
    render(el);
    // fingerprintOrdersByCreatedAt carries a rules `sort_without_index`
    // suggestion; fingerprintUsersOrders carries an llm one. Before the fix
    // the table never received suggestions, so both badges were absent.
    expect(screen.getByText("sort_without_index")).toBeInTheDocument();
    expect(screen.getByText("llm")).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
/* Finding 2 — LiveTimeline reconnects + subscribes to branch events   */
/* ------------------------------------------------------------------ */
describe("LiveTimeline — wired reconnect + store subscription", () => {
  it("re-invokes streamFingerprints after an SSE failure (reconnect loop)", async () => {
    server.use(http.get(`${API}/_slowquery/api/stream`, () => HttpResponse.error()));
    const { apiClient } = await import("@/lib/api/client");
    const streamSpy = vi.spyOn(apiClient, "streamFingerprints");
    const { LiveTimeline } = await import("@/features/timeline/live-timeline");
    const { unmount } = render(<LiveTimeline seed={fingerprintsList} top={10} />);
    try {
      // First connect fails immediately; backoff schedules a second attempt.
      await waitFor(() => expect(streamSpy.mock.calls.length).toBeGreaterThanOrEqual(2), {
        timeout: 5000,
      });
      await waitFor(() =>
        expect(["reconnecting", "fallback"]).toContain(
          screen.getByTestId("stream-status").textContent,
        ),
      );
    } finally {
      unmount();
      streamSpy.mockRestore();
    }
  });

  it("subscribes to the branch store's synthetic events on mount", async () => {
    const { useBranchStore } = await import("@/features/branches/use-branch-store");
    useBranchStore.getState().reset();
    const subscribeSpy = vi.spyOn(useBranchStore.getState(), "onSyntheticEvent");
    const { LiveTimeline } = await import("@/features/timeline/live-timeline");
    const { unmount } = render(<LiveTimeline seed={fingerprintsList} top={10} />);
    try {
      // Pre-fix this had zero subscribers, so a switch could never move the
      // chart. The component must register a listener while mounted.
      expect(subscribeSpy).toHaveBeenCalled();
    } finally {
      unmount();
      subscribeSpy.mockRestore();
    }
  });
});

/* ------------------------------------------------------------------ */
/* Finding 2/5 — branch marker renders on the chart                    */
/* ------------------------------------------------------------------ */
describe("LatencyChart — branch marker reference line", () => {
  beforeEach(() => {
    class MockResizeObserver {
      cb: ResizeObserverCallback;
      constructor(cb: ResizeObserverCallback) {
        this.cb = cb;
      }
      observe(target: Element) {
        this.cb(
          [
            {
              target,
              contentRect: { width: 800, height: 320 } as DOMRectReadOnly,
            } as unknown as ResizeObserverEntry,
          ],
          this,
        );
      }
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
    Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
      configurable: true,
      get: () => 800,
    });
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get: () => 320,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders a reference line when a branch marker is present", async () => {
    const { LatencyChart } = await import("@/features/timeline/latency-chart");
    const t0 = Date.parse("2026-04-12T01:02:45.000Z");
    const { container } = render(
      <LatencyChart
        series={[
          {
            id: "c168fc78a2e7d01c",
            label: "orders",
            points: [
              { t: t0, p95: 2000 },
              { t: t0 + 1000, p95: 1500 },
            ],
          },
        ]}
        markers={[{ active: "fast", x: t0 + 500 }]}
      />,
    );
    expect(container.querySelector(".recharts-reference-line")).not.toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* Finding 5 — buffer points carry a real timestamp, not an index      */
/* ------------------------------------------------------------------ */
describe("buffer — X-axis uses real timestamps", () => {
  it("applyEvent stores sampled_at as the point's t (not an array index)", async () => {
    const { applyEvent } = await import("@/features/timeline/buffer");
    const buf = applyEvent({ byId: new Map() }, tickOrdersCreatedAt);
    const points = buf.byId.get(tickOrdersCreatedAt.fingerprint_id);
    expect(points?.[0]).toEqual({
      t: Date.parse(tickOrdersCreatedAt.sampled_at),
      p95: tickOrdersCreatedAt.p95_ms,
    });
    // Sanity: the timestamp is a real epoch value in the billions, never 0.
    expect(points?.[0]?.t).toBeGreaterThan(1_000_000_000_000);
  });
});
