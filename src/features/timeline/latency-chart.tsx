/**
 * Spec 03 — LatencyChart pure Recharts wrapper. Dumb component:
 * receives series as props, renders the lines, ignores everything
 * else. The errorOverlay prop is shown over the chart without
 * unmounting the existing data so a transient backend error doesn't
 * blank the page.
 */

"use client";

import { CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from "recharts";

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
  errorOverlay?: { status: number; message: string };
}

export function formatXLabel(timestamp: number, now: number): string {
  const seconds = Math.round((now - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m ago`;
}

const COLOURS = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#9333ea", "#0d9488"];

export function LatencyChart({ series, errorOverlay }: LatencyChartProps) {
  // Build a wide row per timestamp so multiple series can share the X axis.
  const rows = mergeSeries(series);
  return (
    <div className="relative w-full max-w-4xl">
      <LineChart
        width={800}
        height={320}
        data={rows}
        margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="t" tickFormatter={(v) => `${Math.round((Date.now() - v) / 1000)}s`} />
        <YAxis />
        <Tooltip />
        <Legend />
        {series.map((s, i) => (
          <Line
            key={s.id}
            type="monotone"
            dataKey={s.id}
            name={s.label}
            stroke={COLOURS[i % COLOURS.length]}
            dot={false}
          />
        ))}
      </LineChart>
      {errorOverlay && (
        <div className="absolute top-2 right-2 rounded border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-900">
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
