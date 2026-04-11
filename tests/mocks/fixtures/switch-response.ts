/**
 * Canned responses for POST /branches/switch.
 * Mirrors slowquery-demo-backend/src/slowquery_demo/schemas/branches.py.
 */

export const switchToFastOk = {
  active: "fast",
  switched_at: "2026-04-12T01:02:46.123Z",
  latency_ms: 1850,
} as const;

export const switchToSlowOk = {
  active: "slow",
  switched_at: "2026-04-12T01:03:10.450Z",
  latency_ms: 1710,
} as const;

export const switchConflict = {
  detail: "switch already in progress",
} as const;
