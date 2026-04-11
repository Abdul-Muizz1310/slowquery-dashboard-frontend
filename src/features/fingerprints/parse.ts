/**
 * Spec 01 — search-param normalisation + a strict parse helper.
 *
 * Both functions are pure — used by the / RSC at request time and by
 * the unit tests directly.
 */

import { type Fingerprint, FingerprintsListSchema } from "@/lib/api/schemas";
import type { SortField, SortOrder } from "./sort-header";

const SORT_FIELDS: ReadonlySet<SortField> = new Set([
  "total_ms",
  "p95_ms",
  "call_count",
  "last_seen",
]);
const SORT_ORDERS: ReadonlySet<SortOrder> = new Set(["asc", "desc"]);

interface NormalisedSort {
  sort: SortField;
  order: SortOrder;
}

export function normaliseSortParams(
  searchParams: Record<string, string | undefined>,
): NormalisedSort {
  const sort = SORT_FIELDS.has(searchParams.sort as SortField)
    ? (searchParams.sort as SortField)
    : "total_ms";
  const order = SORT_ORDERS.has(searchParams.order as SortOrder)
    ? (searchParams.order as SortOrder)
    : "desc";
  return { sort, order };
}

export function parseFingerprintsOrThrow(input: unknown): Fingerprint[] {
  return FingerprintsListSchema.parse(input);
}
