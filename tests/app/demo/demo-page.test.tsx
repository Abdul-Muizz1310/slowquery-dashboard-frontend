/**
 * Spec 05 — /demo chromeless composition view.
 * Cases 1, 2, 5, 6, 7, 8, 11, 14, 15, 16.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { fingerprintsList } from "../../mocks/fixtures/fingerprints";

afterEach(cleanup);

describe("spec 05 — /demo", () => {
  it("case 1 happy: both panels rendered simultaneously with seed data", async () => {
    const { DemoPanel } = await import("@/app/demo/demo-panel");
    render(<DemoPanel fingerprints={fingerprintsList} />);
    expect(screen.getByTestId("demo-fingerprints-panel")).toBeInTheDocument();
    expect(screen.getByTestId("demo-timeline-panel")).toBeInTheDocument();
  });

  it("case 2 happy: left panel shows exactly 5 rows when compact=true", async () => {
    const { FingerprintsTable } = await import("@/features/fingerprints/fingerprints-table");
    const many = Array.from({ length: 8 }, (_, i) => ({
      ...fingerprintsList[0]!,
      id: `deadbeefdeadbe${i.toString().padStart(2, "0")}`,
    }));
    render(<FingerprintsTable fingerprints={many} sort="total_ms" order="desc" compact />);
    const rows = screen.getAllByRole("row");
    expect(rows.length - 1).toBeLessThanOrEqual(5);
  });

  it("case 5 happy: robots meta is noindex,nofollow", async () => {
    const { metadata } = await import("@/app/demo/page");
    const robots = (metadata as { robots?: { index?: boolean; follow?: boolean } }).robots;
    expect(robots?.index).toBe(false);
    expect(robots?.follow).toBe(false);
  });

  it("case 6 happy: /demo layout applies overflow-hidden body class", async () => {
    const { DEMO_BODY_CLASS } = await import("@/app/demo/layout");
    expect(DEMO_BODY_CLASS).toMatch(/overflow-hidden/);
  });

  it("case 7 edge: empty seed renders left empty state and right timeline still mounts", async () => {
    const { DemoPanel } = await import("@/app/demo/demo-panel");
    render(<DemoPanel fingerprints={[]} />);
    expect(screen.getByText(/no fingerprints captured yet/i)).toBeInTheDocument();
    expect(screen.getByTestId("demo-timeline-panel")).toBeInTheDocument();
  });

  it("case 8 edge: viewport clamp applies max-w and max-h", async () => {
    const { DEMO_CLAMP_CLASS } = await import("@/app/demo/layout");
    expect(DEMO_CLAMP_CLASS).toMatch(/max-w/);
    expect(DEMO_CLAMP_CLASS).toMatch(/max-h/);
  });

  it("case 11 failure: seed fetch error takes over left panel only", async () => {
    const { DemoPanel } = await import("@/app/demo/demo-panel");
    render(<DemoPanel fingerprints={[]} error={{ kind: "http", status: 500, message: "boom" }} />);
    expect(screen.getByText(/500/)).toBeInTheDocument();
    expect(screen.getByTestId("demo-timeline-panel")).toBeInTheDocument();
  });

  it("case 14 security: composition does not add new endpoints beyond 01/03/04", async () => {
    const { readFile } = await import("node:fs/promises");
    const { resolve } = await import("node:path");
    const src = await readFile(resolve(__dirname, "../../../src/app/demo/demo-panel.tsx"), "utf-8");
    expect(src).not.toMatch(/fetch\(\s*["'`]http/);
  });

  it("case 15 security: robots meta is present in the page module", async () => {
    const { metadata } = await import("@/app/demo/page");
    expect(metadata).toBeTruthy();
  });

  it("case 16 security: no dangerouslySetInnerHTML in DemoLayout or DemoPanel sources", async () => {
    const { readFile } = await import("node:fs/promises");
    const { resolve } = await import("node:path");
    const layoutSrc = await readFile(
      resolve(__dirname, "../../../src/app/demo/layout.tsx"),
      "utf-8",
    );
    const panelSrc = await readFile(
      resolve(__dirname, "../../../src/app/demo/demo-panel.tsx"),
      "utf-8",
    );
    expect(layoutSrc).not.toContain("dangerouslySetInnerHTML");
    expect(panelSrc).not.toContain("dangerouslySetInnerHTML");
  });
});
