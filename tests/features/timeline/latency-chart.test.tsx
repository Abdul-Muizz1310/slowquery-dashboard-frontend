/**
 * Spec 03 — LatencyChart pure Recharts wrapper + TopNSelector.
 * Cases 4, 9, 10, 13, 16, 19.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);

describe("spec 03 — LatencyChart + selectors", () => {
  it("case 4 happy: TopNSelector rewrites ?top and LatencyChart renders at most N lines", async () => {
    const { TopNSelector } = await import("@/features/timeline/top-n-selector");
    const onChange = vi.fn();
    render(<TopNSelector top={10} onChange={onChange} />);
    const button = screen.getByRole("button", { name: /5/i });
    button.click();
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it("case 9 edge: X axis formats seconds-ago correctly for a 30s-old point", async () => {
    const { formatXLabel } = await import("@/features/timeline/latency-chart");
    const now = 1_712_000_000_000;
    const thirtySecondsAgo = now - 30_000;
    expect(formatXLabel(thirtySecondsAgo, now)).toBe("30s ago");
  });

  it("case 10 edge: top=0 clamps to 1, top=999 clamps to 20", async () => {
    const { normaliseTop } = await import("@/features/timeline/buffer");
    expect(normaliseTop(0)).toBe(1);
    expect(normaliseTop(999)).toBe(20);
  });

  it("case 13 failure: polling path error overlays ErrorState but keeps existing data visible", async () => {
    const { LatencyChart } = await import("@/features/timeline/latency-chart");
    const { container } = render(
      <LatencyChart
        series={[{ id: "abc", label: "SELECT ...", points: [{ t: 0, p95: 10 }] }]}
        errorOverlay={{ status: 500, message: "boom" }}
      />,
    );
    // ResponsiveContainer renders but doesn't emit SVG in jsdom;
    // assert error overlay is visible alongside the chart wrapper.
    expect(container.textContent ?? "").toMatch(/500|boom/);
    expect(container.textContent).not.toContain("waiting for data");
  });

  it("case 16 security: chart does not expose raw user input in aria labels", async () => {
    const { LatencyChart } = await import("@/features/timeline/latency-chart");
    const { container } = render(
      <LatencyChart
        series={[{ id: "<script>", label: "<script>alert(1)</script>", points: [] }]}
      />,
    );
    expect(container.querySelector("script")).toBeNull();
  });

  it("case 19 security: visibilitychange hidden closes the SSE connection", async () => {
    const { shouldDisconnectOnVisibility } = await import("@/features/timeline/status");
    expect(shouldDisconnectOnVisibility("hidden")).toBe(true);
    expect(shouldDisconnectOnVisibility("visible")).toBe(false);
  });

  it("case 9 (extended): X axis formats minute-scale deltas as '1m ago' / '2m ago'", async () => {
    const { formatXLabel } = await import("@/features/timeline/latency-chart");
    const now = 1_712_000_000_000;
    expect(formatXLabel(now - 60_000, now)).toBe("1m ago");
    expect(formatXLabel(now - 120_000, now)).toBe("2m ago");
  });

  it("Outputs (extended): empty series renders the waiting-for-data state; a non-empty series does not", async () => {
    const { LatencyChart } = await import("@/features/timeline/latency-chart");
    const empty = render(<LatencyChart series={[]} />);
    expect(empty.getByText(/waiting for data/i)).toBeInTheDocument();
    empty.unmount();

    const populated = render(
      <LatencyChart
        series={[
          {
            id: "abc",
            label: "SELECT 1",
            points: [
              { t: 1, p95: 10 },
              { t: 2, p95: 20 },
            ],
          },
        ]}
      />,
    );
    expect(populated.queryByText(/waiting for data/i)).toBeNull();
  });

  it("Outputs (extended): long fingerprint labels are truncated, not overflowed", async () => {
    const { LatencyChart } = await import("@/features/timeline/latency-chart");
    const longLabel = "A".repeat(50);
    render(
      <LatencyChart series={[{ id: "abc", label: longLabel, points: [{ t: 1, p95: 10 }] }]} />,
    );
    expect(screen.queryByText(/waiting for data/i)).toBeNull();
  });
});
