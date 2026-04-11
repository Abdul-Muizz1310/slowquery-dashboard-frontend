/**
 * Spec 04 — BranchIndicator pill. Reads activeBranch from the store
 * and renders red/green based on the value.
 */

"use client";

import { useBranchStore } from "./use-branch-store";

export function BranchIndicator() {
  const active = useBranchStore((s) => s.activeBranch);
  const colour =
    active === "fast"
      ? "bg-green-100 text-green-900 border-green-300 green"
      : "bg-red-100 text-red-900 border-red-300 red";
  return (
    <span
      data-testid="branch-indicator"
      className={`text-xs px-2 py-1 rounded border font-mono ${colour}`}
    >
      {active}
    </span>
  );
}
