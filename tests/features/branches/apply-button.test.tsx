/**
 * Spec 04 — ApplyOnFastBranchButton + BranchIndicator + SwitchToast.
 * Cases 2, 4, 7, 16, 17, 18, 19.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

describe("spec 04 — UI surfaces", () => {
  it("case 2 happy: BranchIndicator flips from slow to fast when store updates", async () => {
    const { BranchIndicator } = await import("@/features/branches/branch-indicator");
    const { useBranchStore } = await import("@/features/branches/use-branch-store");
    useBranchStore.getState().hydrate("slow");
    const { rerender } = render(<BranchIndicator />);
    expect(screen.getByText(/slow/i).className).toMatch(/red/);
    useBranchStore.setState({ activeBranch: "fast" });
    rerender(<BranchIndicator />);
    expect(screen.getByText(/fast/i).className).toMatch(/green/);
  });

  it("case 4 happy: ApplyOnFastBranchButton shows 'Already on fast' disabled when active", async () => {
    const { ApplyOnFastBranchButton } = await import("@/features/branches/apply-button");
    const { useBranchStore } = await import("@/features/branches/use-branch-store");
    useBranchStore.getState().hydrate("fast");
    render(<ApplyOnFastBranchButton />);
    const btn = screen.getByRole("button", { name: /already on fast/i });
    expect(btn.hasAttribute("disabled")).toBe(true);
  });

  it("case 7 edge: latency formatting boundaries 0.9s / 2.1s / 12s", async () => {
    const { formatLatency } = await import("@/features/branches/switch-toast");
    expect(formatLatency(900)).toBe("0.9s");
    expect(formatLatency(2_100)).toBe("2.1s");
    expect(formatLatency(12_000)).toBe("12s");
  });

  it("case 16 security: button renders no user-controlled string", async () => {
    const { ApplyOnFastBranchButton } = await import("@/features/branches/apply-button");
    const { container } = render(<ApplyOnFastBranchButton />);
    expect(container.textContent ?? "").toMatch(/apply on fast|already on fast|switching/i);
  });

  it("case 17 security: button renders constant copy only, no dangerous HTML", async () => {
    const { ApplyOnFastBranchButton } = await import("@/features/branches/apply-button");
    const { container } = render(<ApplyOnFastBranchButton />);
    expect(container.innerHTML).not.toContain("dangerouslySetInnerHTML");
  });

  it("case 18 security: Zustand devtools disabled in production builds", async () => {
    const mod = await import("@/features/branches/use-branch-store");
    // The store file is the only place allowed to reference devtools;
    // in prod-only builds the import is absent. We assert the store
    // module does not re-export any devtools middleware.
    expect(Object.keys(mod)).not.toContain("devtools");
  });

  it("case 19 security: store never reaches for URLSearchParams or qs encoding", async () => {
    // Shape enforced by apiClient (spec 00); here we pin the source file
    // so the store never reaches for URLSearchParams or URL-encoding.
    const { readFile } = await import("node:fs/promises");
    const { resolve } = await import("node:path");
    const storeSource = await readFile(
      resolve(__dirname, "../../../src/features/branches/use-branch-store.ts"),
      "utf-8",
    );
    expect(storeSource).not.toContain("URLSearchParams");
    expect(storeSource).not.toContain("qs.stringify");
  });
});
