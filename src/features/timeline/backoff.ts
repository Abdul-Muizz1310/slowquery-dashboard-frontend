/**
 * Spec 03 — exponential backoff for SSE reconnect.
 * 500ms, 1s, 2s, 4s, 8s, capped at 8s.
 */

const SCHEDULE = [500, 1_000, 2_000, 4_000, 8_000] as const;
const MAX = 8_000;

export function backoffMs(attempt: number): number {
  if (attempt <= 0) return SCHEDULE[0];
  if (attempt > SCHEDULE.length) return MAX;
  return SCHEDULE[attempt - 1] ?? MAX;
}
