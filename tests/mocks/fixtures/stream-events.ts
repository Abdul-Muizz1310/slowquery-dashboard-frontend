/**
 * Canned SSE events for /_slowquery/api/stream.
 * Matches the StreamEvent discriminated union in spec 03.
 */

import { FINGERPRINT_ORDERS_BY_CREATED_AT_ID, FINGERPRINT_USERS_ORDERS_ID } from "./fingerprints";

export const tickOrdersCreatedAt = {
  kind: "tick",
  fingerprint_id: FINGERPRINT_ORDERS_BY_CREATED_AT_ID,
  p95_ms: 2045,
  sampled_at: "2026-04-12T01:02:45.000Z",
} as const;

export const tickUsersOrders = {
  kind: "tick",
  fingerprint_id: FINGERPRINT_USERS_ORDERS_ID,
  p95_ms: 615,
  sampled_at: "2026-04-12T01:02:45.250Z",
} as const;

export const heartbeat = {
  kind: "heartbeat",
  now: "2026-04-12T01:02:45.500Z",
} as const;

export const branchSwitchedToFast = {
  kind: "branch_switched",
  active: "fast",
  switched_at: "2026-04-12T01:02:46.123Z",
} as const;

export const orderedStream = [
  tickOrdersCreatedAt,
  tickUsersOrders,
  heartbeat,
  branchSwitchedToFast,
];
