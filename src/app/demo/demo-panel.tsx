/**
 * Spec 05 — DemoPanel composition. Reuses the existing fingerprints
 * + timeline + branch components in a chromeless 2-column grid.
 *
 * No new endpoints, no new schemas — only new layout glue.
 */

import { ApplyOnFastBranchButton } from "@/features/branches/apply-button";
import { BranchIndicator } from "@/features/branches/branch-indicator";
import { FingerprintsTable } from "@/features/fingerprints/fingerprints-table";
import { LiveTimeline } from "@/features/timeline/live-timeline";
import type { Fingerprint } from "@/lib/api/schemas";

interface DemoPanelProps {
  fingerprints: readonly Fingerprint[];
  error?: { kind: "http"; status: number; message: string };
}

export function DemoPanel({ fingerprints, error }: DemoPanelProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 h-full">
      <header className="lg:col-span-2 flex items-center justify-between">
        <h1 className="text-sm font-semibold tracking-wide">slowquery dashboard · demo</h1>
        <div className="flex gap-2 items-center">
          <BranchIndicator />
          <ApplyOnFastBranchButton />
        </div>
      </header>
      <section
        data-testid="demo-fingerprints-panel"
        className="rounded border border-zinc-800 bg-zinc-900 p-3 overflow-auto"
      >
        {error ? (
          <div className="rounded border border-red-700 bg-red-950 p-3 text-xs text-red-200">
            <p className="font-medium">Backend returned {error.status}</p>
            <p className="mt-1">{error.message}</p>
          </div>
        ) : (
          <FingerprintsTable fingerprints={fingerprints} sort="total_ms" order="desc" compact />
        )}
      </section>
      <section
        data-testid="demo-timeline-panel"
        className="rounded border border-zinc-800 bg-zinc-900 p-3"
      >
        <LiveTimeline seed={fingerprints} top={5} />
      </section>
    </div>
  );
}
