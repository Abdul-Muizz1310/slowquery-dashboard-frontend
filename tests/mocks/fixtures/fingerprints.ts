/**
 * Canonical fixture payloads for GET /_slowquery/queries.
 *
 * These mirror the bookkeeping tables in
 * slowquery-demo-backend/alembic/versions/0001_initial.py (query_fingerprints).
 * Three rows: one ORDER BY without index (sort_without_index rule fires),
 * one seq scan on user_id, one N+1 suspect. The ids are deterministic so
 * tests can reference them as string literals.
 */

export const FINGERPRINT_ORDERS_BY_CREATED_AT_ID = "c168fc78a2e7d01c";
export const FINGERPRINT_USERS_ORDERS_ID = "a4b2de10ff734912";
export const FINGERPRINT_N_PLUS_ONE_ID = "e7710c3f4a8b9d21";

export const fingerprintOrdersByCreatedAt = {
  id: FINGERPRINT_ORDERS_BY_CREATED_AT_ID,
  fingerprint:
    "SELECT id, user_id, total_cents, status, created_at FROM orders ORDER BY created_at DESC, id DESC LIMIT ?",
  first_seen: "2026-04-12T00:55:12.431Z",
  last_seen: "2026-04-12T01:02:44.112Z",
  call_count: 34,
  total_ms: 58120,
  p50_ms: 1620,
  p95_ms: 2041,
  p99_ms: 2210,
  max_ms: 2240,
} as const;

export const fingerprintUsersOrders = {
  id: FINGERPRINT_USERS_ORDERS_ID,
  fingerprint: "SELECT id, user_id, total_cents, status, created_at FROM orders WHERE user_id = ?",
  first_seen: "2026-04-12T00:56:01.002Z",
  last_seen: "2026-04-12T01:02:43.984Z",
  call_count: 118,
  total_ms: 41230,
  p50_ms: 320,
  p95_ms: 612,
  p99_ms: 891,
  max_ms: 902,
} as const;

export const fingerprintNPlusOne = {
  id: FINGERPRINT_N_PLUS_ONE_ID,
  fingerprint:
    "SELECT id, order_id, product_id, qty, price_cents FROM order_items WHERE order_id = ?",
  first_seen: "2026-04-12T00:58:14.778Z",
  last_seen: "2026-04-12T01:02:44.001Z",
  call_count: 1890,
  total_ms: 22100,
  p50_ms: 11,
  p95_ms: 24,
  p99_ms: 38,
  max_ms: null,
} as const;

export const fingerprintsList = [
  fingerprintOrdersByCreatedAt,
  fingerprintUsersOrders,
  fingerprintNPlusOne,
];
