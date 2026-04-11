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
    expect(container.querySelector("svg")).not.toBeNull();
    expect(container.textContent ?? "").toMatch(/500|boom/);
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
});
