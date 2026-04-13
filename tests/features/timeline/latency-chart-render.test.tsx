/**
 * LatencyChart rendering tests that exercise the Recharts JSX (lines 59-77).
 * We stub dimension getters so ResponsiveContainer gives non-zero size.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Stub ResizeObserver since jsdom doesn't provide it
class MockResizeObserver {
  callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }
  observe(target: Element) {
    // Fire immediately with a fake entry
    this.callback(
      [
        {
          target,
          contentRect: { width: 800, height: 320, top: 0, left: 0, bottom: 320, right: 800, x: 0, y: 0, toJSON: () => ({}) },
          borderBoxSize: [{ blockSize: 320, inlineSize: 800 }],
          contentBoxSize: [{ blockSize: 320, inlineSize: 800 }],
          devicePixelContentBoxSize: [{ blockSize: 320, inlineSize: 800 }],
        } as unknown as ResizeObserverEntry,
      ],
      this,
    );
  }
  unobserve() {}
  disconnect() {}
}

beforeEach(() => {
  vi.stubGlobal("ResizeObserver", MockResizeObserver);
  // Make getBoundingClientRect return non-zero dimensions
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    width: 800,
    height: 320,
    top: 0,
    left: 0,
    bottom: 320,
    right: 800,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  // Stub offsetWidth/offsetHeight
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", { configurable: true, get: () => 800 });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", { configurable: true, get: () => 320 });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("LatencyChart with dimensions", () => {
  it("renders LineChart children when container has dimensions", async () => {
    const { LatencyChart } = await import("@/features/timeline/latency-chart");
    render(
      <LatencyChart
        series={[
          {
            id: "abc",
            label: "SELECT users FROM...",
            points: [
              { t: 1, p95: 10 },
              { t: 2, p95: 20 },
            ],
          },
          {
            id: "def",
            label: "SELECT orders FROM something very long that needs truncation past forty chars",
            points: [
              { t: 1, p95: 15 },
              { t: 3, p95: 25 },
            ],
          },
        ]}
        errorOverlay={{ status: 503, message: "service down" }}
      />,
    );
    // Should not show empty state
    expect(screen.queryByText(/waiting for data/i)).toBeNull();
  });
});
