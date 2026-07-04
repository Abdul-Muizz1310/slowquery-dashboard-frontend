/**
 * Spec 03 — LatencyChart pure Recharts wrapper. Dumb component:
 * receives series as props, renders the lines, ignores everything
 * else. The errorOverlay prop is shown over the chart without
 * unmounting the existing data so a transient backend error doesn't
 * blank the page.
 */

"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { BranchMarker } from "./branch-marker";

export interface ChartPoint {
  t: number;
  p95: number;
}

export interface ChartSeries {
  id: string;
  label: string;
  points: readonly ChartPoint[];
}

interface LatencyChartProps {
  series: readonly ChartSeries[];
  markers?: readonly BranchMarker[];
  errorOverlay?: { status: number; message: string };
}

export function formatXLabel(timestamp: number, now: number): string {
  const seconds = Math.round((now - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m ago`;
}

const COLOURS = ["#f97316", "#ef4444", "#22c55e", "#3b82f6", "#f59e0b", "#8b5cf6"];

export function LatencyChart({ series, markers, errorOverlay }: LatencyChartProps) {
  const rows = mergeSeries(series);
  const hasData = rows.length > 0;
  // `t` values are real Unix-ms timestamps (see buffer.ts TimePoint), so
  // the tick label is an accurate "Ns ago" via the shared formatter rather
  // than raw epoch arithmetic on an array index.
  const now = Date.now();

  return (
    <div className="relative w-full">
      {hasData ? (
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis
              dataKey="t"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(v: number) => formatXLabel(v, now)}
              stroke="var(--fg-faint)"
              tick={{ fill: "var(--fg-faint)", fontSize: 11 }}
            />
            <YAxis
              stroke="var(--fg-faint)"
              tick={{ fill: "var(--fg-faint)", fontSize: 11 }}
              tickFormatter={(v) => `${v}ms`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border-bright)",
                borderRadius: 8,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--foreground)",
              }}
              /* v8 ignore start -- only invoked on mouse hover; untestable in jsdom */
              labelFormatter={(v) => `point ${v}`}
              /* v8 ignore stop */
            />
            <Legend
              wrapperStyle={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--fg-muted)",
              }}
            />
            {series.map((s, i) => (
              <Line
                key={s.id}
                type="monotone"
                dataKey={s.id}
                name={s.label.length > 40 ? `${s.label.slice(0, 37)}...` : s.label}
                stroke={COLOURS[i % COLOURS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            ))}
            {(markers ?? []).map((m) => (
              <ReferenceLine
                key={`${m.active}-${m.x}`}
                x={m.x}
                stroke={m.active === "fast" ? "var(--success)" : "var(--error)"}
                strokeDasharray="4 2"
                label={{
                  value: `→ ${m.active}`,
                  position: "top",
                  fill: m.active === "fast" ? "var(--success)" : "var(--error)",
                  fontSize: 10,
                }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex items-center justify-center h-[320px] rounded-lg border border-border/50 bg-surface/30">
          <div className="text-center">
            <div className="font-mono text-lg text-fg-faint">~</div>
            <p className="font-mono text-xs text-fg-faint mt-2">waiting for data</p>
            <p className="font-mono text-[10px] text-fg-faint mt-1">
              fingerprints will appear here as the backend captures queries
            </p>
          </div>
        </div>
      )}
      {errorOverlay && (
        <div className="absolute top-2 right-2 rounded border border-error/30 bg-error/10 px-3 py-1 text-xs text-error font-mono">
          <span className="font-mono">{errorOverlay.status}</span> {errorOverlay.message}
        </div>
      )}
    </div>
  );
}

interface WideRow {
  t: number;
  [seriesId: string]: number;
}

function mergeSeries(series: readonly ChartSeries[]): WideRow[] {
  const tSet = new Set<number>();
  for (const s of series) {
    for (const p of s.points) tSet.add(p.t);
  }
  const ts = Array.from(tSet).sort((a, b) => a - b);
  return ts.map((t) => {
    const row: WideRow = { t };
    for (const s of series) {
      const point = s.points.find((p) => p.t === t);
      if (point) row[s.id] = point.p95;
    }
    return row;
  });
}
