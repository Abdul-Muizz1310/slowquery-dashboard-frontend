/**
 * Spec 03 — buildBranchMarker turns a branch_switched stream event
 * into the props the chart's <BranchMarker> consumes.
 */

import type { BranchName } from "@/lib/api/schemas";

interface BranchSwitchedEvent {
  kind: "branch_switched";
  active: BranchName;
  switched_at: string;
}

export interface BranchMarker {
  active: BranchName;
  x: number;
}

export function buildBranchMarker(event: BranchSwitchedEvent): BranchMarker {
  return {
    active: event.active,
    x: new Date(event.switched_at).getTime(),
  };
}
