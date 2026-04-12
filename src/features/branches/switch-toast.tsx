/**
 * Spec 04 — SwitchToast + formatLatency helper.
 *
 * Pure presentational component driven by a discriminated-union prop
 * so the test can render every state without touching the store.
 */

import type { BranchName } from "@/lib/api/schemas";

export function formatLatency(ms: number): string {
  if (ms < 1_000) return `${(ms / 1_000).toFixed(1)}s`;
  if (ms < 10_000) return `${(ms / 1_000).toFixed(1)}s`;
  return `${Math.round(ms / 1_000)}s`;
}

export type SwitchStatus =
  | { kind: "idle" }
  | { kind: "success"; active: BranchName; latencyMs: number }
  | { kind: "error"; message: string };

interface SwitchToastProps {
  status: SwitchStatus;
}

export function SwitchToast({ status }: SwitchToastProps) {
  if (status.kind === "idle") return null;
  if (status.kind === "success") {
    return (
      <div className="rounded border border-success/30 bg-success/10 px-3 py-2 text-xs text-success font-mono">
        Switched to {status.active} in {formatLatency(status.latencyMs)}
      </div>
    );
  }
  return (
    <div className="rounded border border-error/30 bg-error/10 px-3 py-2 text-xs text-error font-mono">
      {status.message}
    </div>
  );
}
