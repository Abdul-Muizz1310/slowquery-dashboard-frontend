/**
 * Spec 01 — FingerprintsTable + EmptyState. Pure presentational
 * component, server-rendered, prop-driven, unit-testable.
 *
 * The fingerprint detail (which carries suggestions for the rule
 * badges) lives one fetch away — for the table view we just show the
 * fingerprint id / latency / call counts. Suggestions for the badge
 * column are passed in via the optional `suggestionsByFingerprint`
 * prop so the page composition layer can join the two queries server
 * side without coupling the table to the api client.
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
      <div className="rounded border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600">
        <p className="font-medium text-zinc-800">No fingerprints captured yet</p>
        <p className="mt-1">
          Run some traffic against the demo backend at{" "}
          <code className="font-mono text-xs">/users</code>,{" "}
          <code className="font-mono text-xs">/orders</code>, or{" "}
          <code className="font-mono text-xs">/users/&#123;id&#125;/orders</code> to seed
          fingerprints.
        </p>
      </div>
    );
  }
  const sorted = sortFingerprints(fingerprints, sort, order);
  const limited = compact ? sorted.slice(0, 5) : sorted;
  return (
    <table className="w-full text-sm border-collapse">
      <thead className="border-b border-zinc-200 text-left text-xs uppercase text-zinc-500">
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
            <tr key={fp.id} className="border-b border-zinc-100 hover:bg-zinc-50">
              <td className="px-3 py-2">
                <Link
                  href={`/queries/${fp.id}`}
                  className="text-blue-700 hover:underline font-mono text-xs"
                >
                  <code>{fp.fingerprint}</code>
                </Link>
              </td>
              <td className="px-3 py-2 text-right tabular-nums">{formatCount(fp.call_count)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{fp.total_ms}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatMsCell(fp.p50_ms)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatMsCell(fp.p95_ms)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatMsCell(fp.p99_ms)}</td>
              <td className="px-3 py-2 text-zinc-500 text-xs">
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
