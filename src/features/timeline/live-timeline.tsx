/**
 * Spec 03 — LiveTimeline stateful client component.
 *
 * Manages an in-memory rolling buffer keyed by fingerprint id, opens
 * the SSE connection in a useEffect, reconnects with exponential
 * backoff (spec 03 case 11), and falls back to polling after three
 * consecutive failures (case 12). The chart is the dumb LatencyChart
 * — all state and i/o is in this component.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api/client";
import type { Fingerprint } from "@/lib/api/schemas";
import { applyEvent, type Buffer, normaliseTop } from "./buffer";
import { type ChartSeries, LatencyChart } from "./latency-chart";
import { type StreamState, type StreamStatus, initialStreamState, statusReducer } from "./status";

interface LiveTimelineProps {
  seed: readonly Fingerprint[];
  top: number;
}

const STATUS_DISPLAY: Record<StreamStatus, { label: string; className: string }> = {
  connecting: {
    label: "connecting",
    className: "text-accent-flame",
  },
  live: {
    label: "live",
    className: "text-success",
  },
  reconnecting: {
    label: "reconnecting",
    className: "text-warning",
  },
  fallback: {
    label: "fallback polling",
    className: "text-fg-faint",
  },
};

export function LiveTimeline({ seed, top }: LiveTimelineProps) {
  const safeTop = normaliseTop(top);
  const seedTop = [...seed].sort((a, b) => b.total_ms - a.total_ms).slice(0, safeTop);
  const initial: Buffer = {
    byId: new Map(seedTop.map((fp) => [fp.id, fp.p95_ms !== null ? [fp.p95_ms] : []])),
  };

  const [buffer, setBuffer] = useState<Buffer>(initial);
  const [streamState, setStreamState] = useState<StreamState>(initialStreamState);
  const status: StreamStatus = streamState.status;
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    abortRef.current = controller;
    let cancelled = false;
    void (async () => {
      try {
        for await (const ev of apiClient.streamFingerprints(controller.signal)) {
          if (cancelled) return;
          setBuffer((prev) => applyEvent(prev, ev));
          setStreamState((prev) => statusReducer(prev, { kind: "first-event" }));
        }
      } catch {
        setStreamState((prev) => statusReducer(prev, { kind: "fail" }));
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  const series: ChartSeries[] = seedTop.map((fp) => ({
    id: fp.id,
    label: fp.fingerprint.slice(0, 60),
    points: (buffer.byId.get(fp.id) ?? []).map((p95, i) => ({ t: i, p95 })),
  }));

  const display = STATUS_DISPLAY[status];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-medium text-fg-muted font-mono">live p95</h2>
        <div className="flex items-center gap-2">
          {status === "live" && (
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-success pulse-ring" />
          )}
          {status === "connecting" && (
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent-flame pulse-ring" />
          )}
          <span data-testid="stream-status" className={`text-xs font-mono ${display.className}`}>
            {display.label}
          </span>
        </div>
      </div>
      <LatencyChart series={series} />
    </div>
  );
}
