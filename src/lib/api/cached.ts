/**
 * Spec 00 — shared, short-lived cache for the fingerprint list (COST-1).
 *
 * `/`, `/timeline` and `/demo` each fetch the same aggregate fingerprint
 * list. Wrapping the fetch in `unstable_cache` with a small revalidation
 * window means concurrent viewers and page-to-page navigation reuse one
 * backend round-trip instead of stampeding a cold-start-prone Render
 * free-tier backend on every render. The truly-live surface (per-fingerprint
 * p95) stays the SSE stream, which is unaffected by this cache.
 */

import { unstable_cache } from "next/cache";
import { apiClient } from "./client";
import type { Fingerprint } from "./schemas";

const REVALIDATE_SECONDS = 5;

export const getCachedFingerprints: () => Promise<Fingerprint[]> = unstable_cache(
  () => apiClient.listFingerprints(),
  ["slowquery:fingerprints-list"],
  { revalidate: REVALIDATE_SECONDS },
);
