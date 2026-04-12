/**
 * Spec 05 — DemoPanel composition. Reuses the existing fingerprints
 * + timeline + branch components in a chromeless 2-column grid.
 *
 * No new endpoints, no new schemas — only new layout glue.
 */

import { TerminalWindow } from "@/components/terminal/TerminalWindow";
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
        <h1 className="font-mono text-sm font-semibold tracking-wide text-foreground">
          slowquery<span className="text-accent-flame">.dashboard</span>
          <span className="text-fg-faint"> · demo</span>
        </h1>
        <div className="flex gap-2 items-center">
          <BranchIndicator />
          <ApplyOnFastBranchButton />
        </div>
      </header>
      <section data-testid="demo-fingerprints-panel" className="overflow-auto">
        {error ? (
          <TerminalWindow title="error" statusDot="red" statusLabel="failed">
            <p className="font-mono text-xs text-fg-muted">
              Backend returned {error.status}: {error.message}
            </p>
          </TerminalWindow>
        ) : (
          <TerminalWindow title="query_fingerprints" statusDot="flame" statusLabel="live">
            <FingerprintsTable fingerprints={fingerprints} sort="total_ms" order="desc" compact />
          </TerminalWindow>
        )}
      </section>
      <section data-testid="demo-timeline-panel">
        <TerminalWindow title="p95_timeline" statusDot="flame" statusLabel="live">
          <LiveTimeline seed={fingerprints} top={5} />
        </TerminalWindow>
      </section>
    </div>
  );
}
