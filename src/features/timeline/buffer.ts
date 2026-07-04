/**
 * Spec 03 — rolling buffer + top-N tracking + stream-event application.
 *
 * Pure functions, exhaustively unit-tested. The buffer is keyed by
 * fingerprint id and capped at 60 points per line. Events with NaN
 * latency or invalid id shapes are silently dropped (the api client
 * already runs Zod parse on the live wire, but defensive checks here
 * mean a malformed test fixture or a bypass can never poison the
 * chart state).
 */

import type { Fingerprint } from "@/lib/api/schemas";
import { type StreamEvent, StreamEventSchema } from "@/lib/api/schemas";

const MAX_POINTS = 60;
const HEX_ID = /^[a-f0-9]{16}$/;

/**
 * One sample on a fingerprint's p95 line. `t` is a real Unix-ms timestamp
 * (the event's `sampled_at`, or receipt time for poll samples) so the
 * chart X-axis can render an accurate "Ns ago" label — never an array
 * index masquerading as an epoch value.
 */
export interface TimePoint {
  t: number;
  p95: number;
}

export interface Buffer {
  byId: Map<string, TimePoint[]>;
}

interface BufferWithGreyed extends Buffer {
  greyed: Set<string>;
  greyedAt: Map<string, number>;
}

function pushCapped(existing: readonly TimePoint[], point: TimePoint): TimePoint[] {
  const series = [...existing, point];
  if (series.length > MAX_POINTS) {
    series.splice(0, series.length - MAX_POINTS);
  }
  return series;
}

function toTimestamp(iso: string, fallbackMs: number): number {
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : fallbackMs;
}

export function applyEvent(buf: Buffer, ev: unknown, nowMs: number = Date.now()): Buffer {
  const parsed = StreamEventSchema.safeParse(ev);
  if (!parsed.success) {
    if (typeof console !== "undefined") {
      console.warn("[timeline] dropped malformed stream event");
    }
    return buf;
  }
  const event = parsed.data;
  if (event.kind !== "tick") return buf;
  if (!HEX_ID.test(event.fingerprint_id)) return buf;
  if (!Number.isFinite(event.p95_ms)) return buf;
  const next = new Map(buf.byId);
  const point: TimePoint = { t: toTimestamp(event.sampled_at, nowMs), p95: event.p95_ms };
  next.set(event.fingerprint_id, pushCapped(next.get(event.fingerprint_id) ?? [], point));
  return { byId: next };
}

/**
 * Polling fallback (spec 03 invariant 3): fold a freshly polled fingerprint
 * list into the buffer, appending the current p95 for each line at `nowMs`.
 * Fingerprints with a null p95 (percentiles not yet computed) are skipped.
 */
export function appendPollSamples(
  buf: Buffer,
  fingerprints: readonly Fingerprint[],
  nowMs: number = Date.now(),
): Buffer {
  const next = new Map(buf.byId);
  for (const fp of fingerprints) {
    if (fp.p95_ms === null || !Number.isFinite(fp.p95_ms)) continue;
    next.set(fp.id, pushCapped(next.get(fp.id) ?? [], { t: nowMs, p95: fp.p95_ms }));
  }
  return { byId: next };
}

const REMOVE_AFTER_MS = 10_000;

export function trackTopN(
  buf: Buffer | BufferWithGreyed,
  topIds: readonly string[],
  nowMs: number,
): BufferWithGreyed {
  const topSet = new Set(topIds);
  const greyed = new Set<string>();
  const prevGreyedAt =
    "greyedAt" in buf && buf.greyedAt instanceof Map ? buf.greyedAt : new Map<string, number>();
  const greyedAt = new Map<string, number>();
  const nextById = new Map(buf.byId);

  for (const id of buf.byId.keys()) {
    if (!topSet.has(id)) {
      greyed.add(id);
      const firstSeenGrey = prevGreyedAt.get(id) ?? nowMs;
      greyedAt.set(id, firstSeenGrey);
      if (nowMs - firstSeenGrey >= REMOVE_AFTER_MS) {
        nextById.delete(id);
        greyed.delete(id);
        greyedAt.delete(id);
      }
    }
  }
  return { byId: nextById, greyed, greyedAt };
}

const DEFAULT_TOP = 10;
const TOP_MIN = 1;
const TOP_MAX = 20;

export function normaliseTop(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_TOP;
  const rounded = Math.round(value);
  if (rounded < TOP_MIN) return TOP_MIN;
  if (rounded > TOP_MAX) return TOP_MAX;
  return rounded;
}

export type { StreamEvent };
