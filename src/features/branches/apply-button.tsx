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
      className="text-xs px-3 py-1.5 rounded border border-blue-300 bg-blue-50 text-blue-900 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {label}
    </button>
  );
}
