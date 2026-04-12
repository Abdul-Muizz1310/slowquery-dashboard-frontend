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
      ? "bg-success/10 text-success border-success/30 green"
      : "bg-error/10 text-error border-error/30 red";
  return (
    <span
      data-testid="branch-indicator"
      className={`text-xs px-2 py-1 rounded border font-mono ${colour}`}
    >
      {active}
    </span>
  );
}
