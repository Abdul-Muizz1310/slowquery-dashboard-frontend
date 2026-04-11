/**
 * Spec 02 — RecentSamplesTable. Compact 10-row table; empty list
 * shows a friendly placeholder row.
 */

import type { QuerySample } from "@/lib/api/schemas";

interface RecentSamplesTableProps {
  samples: readonly QuerySample[];
}

export function RecentSamplesTable({ samples }: RecentSamplesTableProps) {
  if (samples.length === 0) {
    return (
      <div className="rounded border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500">
        No recent samples for this fingerprint.
      </div>
    );
  }
  const sorted = [...samples].sort((a, b) => b.sampled_at.localeCompare(a.sampled_at)).slice(0, 10);
  return (
    <table className="w-full text-xs border-collapse">
      <thead className="border-b border-zinc-200 text-left text-zinc-500 uppercase">
        <tr>
          <th scope="col" className="px-3 py-2">
            sampled at
          </th>
          <th scope="col" className="px-3 py-2 text-right">
            duration
          </th>
          <th scope="col" className="px-3 py-2 text-right">
            rows
          </th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((s) => (
          <tr key={s.id} className="border-b border-zinc-100">
            <td className="px-3 py-1.5 font-mono text-zinc-700">{s.sampled_at}</td>
            <td className="px-3 py-1.5 text-right tabular-nums">{s.duration_ms.toFixed(0)}ms</td>
            <td className="px-3 py-1.5 text-right tabular-nums">{s.rows ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
