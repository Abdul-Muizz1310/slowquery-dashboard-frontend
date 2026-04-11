/**
 * Spec 01 — display formatters used by FingerprintsTable.
 *
 * Pure functions only; no React, no DOM, no environment access.
 * They live in their own module so the snapshot tests can call them
 * directly without rendering a component.
 */

const COMPACT_FORMATTER = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const RELATIVE_FORMATTER = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export function formatCount(n: number): string {
  return COMPACT_FORMATTER.format(n);
}

export function formatMs(value: number | null): string {
  if (value === null) return "—";
  if (value >= 100) return `${Math.round(value)}ms`;
  if (value >= 10) return `${value.toFixed(1)}ms`;
  return `${value.toFixed(1)}ms`;
}

const RELATIVE_THRESHOLDS: Array<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
  { unit: "year", ms: 365 * 24 * 60 * 60 * 1000 },
  { unit: "month", ms: 30 * 24 * 60 * 60 * 1000 },
  { unit: "day", ms: 24 * 60 * 60 * 1000 },
  { unit: "hour", ms: 60 * 60 * 1000 },
  { unit: "minute", ms: 60 * 1000 },
  { unit: "second", ms: 1000 },
];

export function formatRelative(date: Date, now: Date = new Date()): string {
  const deltaMs = date.getTime() - now.getTime();
  const abs = Math.abs(deltaMs);
  for (const { unit, ms } of RELATIVE_THRESHOLDS) {
    if (abs >= ms || unit === "second") {
      const value = Math.round(deltaMs / ms);
      return RELATIVE_FORMATTER.format(value, unit);
    }
  }
  return RELATIVE_FORMATTER.format(0, "second");
}
