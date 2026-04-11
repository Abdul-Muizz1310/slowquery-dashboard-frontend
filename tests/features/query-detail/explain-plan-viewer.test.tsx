/**
 * Spec 02 — ExplainPlanViewer recursive plan tree renderer.
 * Cases 3, 6, 14, 21 (security — escape node type).
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { detailOrdersByCreatedAt } from "../../mocks/fixtures/fingerprint-detail";

afterEach(cleanup);

describe("spec 02 — ExplainPlanViewer", () => {
  it("case 3 happy: top-level Sort node highlighted as cost hotspot", async () => {
    const { ExplainPlanViewer } = await import("@/features/query-detail/explain-plan-viewer");
    render(<ExplainPlanViewer plan={detailOrdersByCreatedAt.explain_plan!} />);
    const sortNode = screen.getByText(/^Sort$/);
    expect(sortNode.className).toMatch(/hotspot|red|warning/);
  });

  it("case 6 edge: explain_plan null renders friendly notice instead of empty viewer", async () => {
    const { PlanNotAvailable } = await import("@/features/query-detail/explain-plan-viewer");
    render(<PlanNotAvailable />);
    expect(screen.getByText(/explain plan not captured yet/i)).toBeInTheDocument();
  });

  it("case 14 edge: malformed plan tree falls back to raw JSON <pre>", async () => {
    const { ExplainPlanViewer } = await import("@/features/query-detail/explain-plan-viewer");
    const { container } = render(
      <ExplainPlanViewer
        plan={{
          fingerprint_id: "deadbeefdeadbeef",
          plan_json: { not: "a node" } as unknown as Record<string, unknown>,
          plan_text: "...",
          cost: null,
          captured_at: "2026-04-12T01:00:00.000Z",
        }}
      />,
    );
    expect(container.querySelector("pre")).not.toBeNull();
  });

  it("case 21 security: plan node label containing <script> is escaped", async () => {
    const { ExplainPlanViewer } = await import("@/features/query-detail/explain-plan-viewer");
    const { container } = render(
      <ExplainPlanViewer
        plan={{
          fingerprint_id: "deadbeefdeadbeef",
          plan_json: { "Node Type": "<script>alert(1)</script>" },
          plan_text: "...",
          cost: null,
          captured_at: "2026-04-12T01:00:00.000Z",
        }}
      />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
  });
});
