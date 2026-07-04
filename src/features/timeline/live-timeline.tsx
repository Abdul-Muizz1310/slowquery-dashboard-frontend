/**
 * Spec 03 — LiveTimeline stateful client component.
 *
 * Manages an in-memory rolling buffer keyed by fingerprint id, opens
 * the SSE connection in a useEffect, reconnects with exponential
 * backoff (spec 03 case 11), and falls back to polling
 * `apiClient.listFingerprints()` every 2s after three consecutive
 * failures (case 12). `branch_switched` stream events and synthetic
 * branch events from `useBranchStore` both drop a <BranchMarker> on the
 * chart so the before/after of an "Apply on fast branch" click is
 * visible on the same line (spec 04 invariant 9). The chart itself is
 * the dumb LatencyChart — all state and i/o is in this component.
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useBranchStore } from "@/features/branches/use-branch-store";
import { apiClient } from "@/lib/api/client";
import type { Fingerprint } from "@/lib/api/schemas";
import { backoffMs } from "./backoff";
import { type BranchMarker, buildBranchMarker } from "./branch-marker";
import { appendPollSamples, applyEvent, type Buffer, normaliseTop } from "./buffer";
import { type ChartSeries, LatencyChart } from "./latency-chart";
import { initialStreamState, type StreamState, type StreamStatus, statusReducer } from "./status";

interface LiveTimelineProps {
  seed: readonly Fingerprint[];
  top: number;
}

const POLL_INTERVAL_MS = 2_000;

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

function seedTimestamp(iso: string): number {
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

export function LiveTimeline({ seed, top }: LiveTimelineProps) {
  const safeTop = normaliseTop(top);
  // Memoised so the sort/slice isn't recomputed on every SSE tick's
  // setState (OPT-2); keyed on the seed reference and the clamped top.
  const seedTop = useMemo(
    () => [...seed].sort((a, b) => b.total_ms - a.total_ms).slice(0, safeTop),
    [seed, safeTop],
  );

  // Lazy initialiser: the buffer starts empty and is populated by live
  // ticks / poll samples. Seed values are surfaced as a fallback point
  // per line below, so the Map is never rebuilt on re-render.
  const [buffer, setBuffer] = useState<Buffer>(() => ({ byId: new Map() }));
  const [streamState, setStreamState] = useState<StreamState>(initialStreamState);
  const [markers, setMarkers] = useState<readonly BranchMarker[]>([]);
  const status: StreamStatus = streamState.status;
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const addMarker = (marker: BranchMarker) => {
      setMarkers((prev) =>
        prev.some((m) => m.x === marker.x && m.active === marker.active) ? prev : [...prev, marker],
      );
    };

    const stopPolling = () => {
      if (pollTimer !== null) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    };

    const startPolling = () => {
      if (pollTimer !== null) return;
      pollTimer = setInterval(() => {
        void (async () => {
          try {
            const list = await apiClient.listFingerprints();
            if (cancelled) return;
            setBuffer((prev) => appendPollSamples(prev, list));
          } catch {
            // Keep polling; the chart retains the last-known data.
          }
        })();
      }, POLL_INTERVAL_MS);
    };

    const scheduleReconnect = () => {
      if (cancelled) return;
      let goFallback = false;
      setStreamState((prev) => {
        const next = statusReducer(prev, { kind: "fail" });
        if (next.status === "fallback") goFallback = true;
        return next;
      });
      if (goFallback) startPolling();
      attempt += 1;
      reconnectTimer = setTimeout(() => {
        if (cancelled) return;
        void connect();
      }, backoffMs(attempt));
    };

    const connect = async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        for await (const ev of apiClient.streamFingerprints(controller.signal)) {
          if (cancelled) return;
          // A live event means the connection recovered: reset backoff and
          // tear down any polling fallback.
          attempt = 0;
          stopPolling();
          if (ev.kind === "branch_switched") {
            addMarker(buildBranchMarker(ev));
          }
          setBuffer((prev) => applyEvent(prev, ev));
          setStreamState((prev) => statusReducer(prev, { kind: "first-event" }));
        }
        // Stream ended without an abort → treat as a drop and reconnect.
        if (!cancelled) scheduleReconnect();
      } catch {
        if (cancelled) return;
        scheduleReconnect();
      }
    };

    void connect();

    // A successful branch switch emits a synthetic event so the marker
    // renders even before the backend SSE catches up (spec 04 inv. 9).
    const unsubscribe = useBranchStore.getState().onSyntheticEvent((event) => {
      if (cancelled) return;
      addMarker({ active: event.active, x: event.switched_at.getTime() });
    });

    return () => {
      cancelled = true;
      abortRef.current?.abort();
      stopPolling();
      if (reconnectTimer !== null) clearTimeout(reconnectTimer);
      unsubscribe();
    };
  }, []);

  const series: ChartSeries[] = seedTop.map((fp) => {
    const buffered = buffer.byId.get(fp.id) ?? [];
    const points =
      buffered.length > 0
        ? buffered
        : fp.p95_ms !== null
          ? [{ t: seedTimestamp(fp.last_seen), p95: fp.p95_ms }]
          : [];
    return {
      id: fp.id,
      label: fp.fingerprint.slice(0, 60),
      points,
    };
  });

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
      <LatencyChart series={series} markers={markers} />
    </div>
  );
}
