/**
 * Spec 04 — ApplyOnFastBranchButton. Reads switchInFlight + activeBranch
 * from the zustand store and dispatches a switch on click.
 */

"use client";

import { useBranchStore } from "./use-branch-store";

export function ApplyOnFastBranchButton() {
  const active = useBranchStore((s) => s.activeBranch);
  const inFlight = useBranchStore((s) => s.switchInFlight);
  const switchBranch = useBranchStore((s) => s.switch);

  const isFast = active === "fast";
  const label = inFlight ? "Switching…" : isFast ? "Already on fast" : "Apply on fast branch";
  return (
    <button
      type="button"
      disabled={inFlight || isFast}
      onClick={() => {
        void switchBranch("fast");
      }}
      className="text-xs px-3 py-1.5 rounded border border-accent-flame/30 bg-accent-flame/10 text-accent-flame hover:bg-accent-flame/20 disabled:opacity-50 disabled:cursor-not-allowed font-mono"
    >
      {label}
    </button>
  );
}
