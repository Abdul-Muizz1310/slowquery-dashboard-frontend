/**
 * Spec 01 — FingerprintsTable + EmptyState. Pure presentational
 * component, server-rendered, prop-driven, unit-testable.
 */

import Link from "next/link";
import type { Fingerprint, Suggestion } from "@/lib/api/schemas";
import { formatCount, formatMs, formatRelative } from "./format";
import { RuleBadges } from "./rule-badges";
import type { SortField, SortOrder } from "./sort-header";

interface FingerprintsTableProps {
  fingerprints: readonly Fingerprint[];
  sort: SortField;
  order: SortOrder;
  suggestionsByFingerprint?: Readonly<Record<string, readonly Suggestion[]>>;
  compact?: boolean;
}

function compareNullsLast(a: number | null, b: number | null, order: SortOrder): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return order === "desc" ? b - a : a - b;
}

function sortFingerprints(
  fingerprints: readonly Fingerprint[],
  sort: SortField,
  order: SortOrder,
): Fingerprint[] {
  const copy = [...fingerprints];
  copy.sort((a, b) => {
    if (sort === "last_seen") {
      const av = new Date(a.last_seen).getTime();
      const bv = new Date(b.last_seen).getTime();
      return order === "desc" ? bv - av : av - bv;
    }
    const av: number | null = a[sort];
    const bv: number | null = b[sort];
    return compareNullsLast(av, bv, order);
  });
  return copy;
}

export function FingerprintsTable({
  fingerprints,
  sort,
  order,
  suggestionsByFingerprint,
  compact,
}: FingerprintsTableProps) {
  if (fingerprints.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-surface/50 p-6 text-sm text-fg-muted">
        <p className="font-mono font-medium text-foreground">No fingerprints captured yet</p>
        <p className="mt-1 font-mono">
          Run some traffic against the demo backend at{" "}
          <code className="rounded border border-border bg-surface-hover px-1 py-0.5 text-xs text-accent-flame">
            /users
          </code>
          ,{" "}
          <code className="rounded border border-border bg-surface-hover px-1 py-0.5 text-xs text-accent-flame">
            /orders
          </code>
          , or{" "}
          <code className="rounded border border-border bg-surface-hover px-1 py-0.5 text-xs text-accent-flame">
            /users/&#123;id&#125;/orders
          </code>{" "}
          to seed fingerprints.
        </p>
      </div>
    );
  }
  const sorted = sortFingerprints(fingerprints, sort, order);
  const limited = compact ? sorted.slice(0, 5) : sorted;
  return (
    <table className="w-full text-sm border-collapse font-mono">
      <thead className="border-b border-border text-left text-[10px] uppercase tracking-[0.15em] text-fg-faint">
        <tr>
          <th scope="col" className="px-3 py-2">
            fingerprint
          </th>
          <th scope="col" className="px-3 py-2 text-right">
            calls
          </th>
          <th scope="col" className="px-3 py-2 text-right">
            total
          </th>
          <th scope="col" className="px-3 py-2 text-right">
            p50
          </th>
          <th scope="col" className="px-3 py-2 text-right">
            p95
          </th>
          <th scope="col" className="px-3 py-2 text-right">
            p99
          </th>
          <th scope="col" className="px-3 py-2">
            last seen
          </th>
          <th scope="col" className="px-3 py-2">
            rules
          </th>
        </tr>
      </thead>
      <tbody>
        {limited.map((fp) => {
          const suggestions = suggestionsByFingerprint?.[fp.id] ?? [];
          return (
            <tr
              key={fp.id}
              className="border-b border-border/50 transition-colors hover:bg-surface-hover"
            >
              <td className="px-3 py-2 max-w-xs">
                <Link
                  href={`/queries/${fp.id}`}
                  className="text-accent-flame hover:underline text-xs truncate block"
                >
                  <code>{fp.fingerprint}</code>
                </Link>
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-foreground">
                {formatCount(fp.call_count)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-foreground">{fp.total_ms}</td>
              <td className="px-3 py-2 text-right tabular-nums text-fg-muted">
                {formatMsCell(fp.p50_ms)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-accent-flame">
                {formatMsCell(fp.p95_ms)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-fg-muted">
                {formatMsCell(fp.p99_ms)}
              </td>
              <td className="px-3 py-2 text-fg-faint text-xs">
                {formatRelative(new Date(fp.last_seen))}
              </td>
              <td className="px-3 py-2">
                <RuleBadges suggestions={suggestions} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function formatMsCell(value: number | null): string {
  if (value === null) return "—";
  return formatMs(value);
}
