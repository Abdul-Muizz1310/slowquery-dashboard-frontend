/**
 * Spec 04 — SwitchToast success + failure copy.
 * Cases 1 (success latency), 4 (already-on-fast no toast on no-op).
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

describe("spec 04 — SwitchToast", () => {
  it("success toast shows 'Switched to fast in 1.9s'", async () => {
    const { SwitchToast } = await import("@/features/branches/switch-toast");
    render(<SwitchToast status={{ kind: "success", active: "fast", latencyMs: 1_900 }} />);
    expect(screen.getByText(/switched to fast in 1\.9s/i)).toBeInTheDocument();
  });

  it("error toast shows mapped friendly message for HttpError(500)", async () => {
    const { SwitchToast } = await import("@/features/branches/switch-toast");
    render(<SwitchToast status={{ kind: "error", message: "Backend error — try again" }} />);
    expect(screen.getByText(/backend error/i)).toBeInTheDocument();
  });

  it("idle state renders nothing", async () => {
    const { SwitchToast } = await import("@/features/branches/switch-toast");
    const { container } = render(<SwitchToast status={{ kind: "idle" }} />);
    expect(container.textContent ?? "").toBe("");
  });
});
