/**
 * Spec 01 — sortable column header. The only client component on the
 * fingerprints page; everything else is server-rendered.
 */

"use client";

import type { ReactNode } from "react";

export type SortField = "total_ms" | "p95_ms" | "call_count" | "last_seen";
export type SortOrder = "asc" | "desc";

interface SortHeaderProps {
  field: SortField;
  currentSort: SortField;
  currentOrder: SortOrder;
  onChange: (next: { sort: SortField; order: SortOrder }) => void;
  children: ReactNode;
}

export function SortHeader({
  field,
  currentSort,
  currentOrder,
  onChange,
  children,
}: SortHeaderProps) {
  const isActive = currentSort === field;
  const nextOrder: SortOrder = isActive && currentOrder === "desc" ? "asc" : "desc";
  return (
    <th
      scope="col"
      className="px-3 py-2 text-left font-medium text-fg-muted font-mono cursor-pointer select-none"
      onClick={() => onChange({ sort: field, order: nextOrder })}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onChange({ sort: field, order: nextOrder });
      }}
    >
      {children}
      {isActive && <span aria-hidden="true">{currentOrder === "desc" ? " ↓" : " ↑"}</span>}
    </th>
  );
}
