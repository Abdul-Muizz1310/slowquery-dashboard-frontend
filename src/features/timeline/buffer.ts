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

import { type StreamEvent, StreamEventSchema } from "@/lib/api/schemas";

const MAX_POINTS = 60;
const HEX_ID = /^[a-f0-9]{16}$/;

export interface Buffer {
  byId: Map<string, number[]>;
}

interface BufferWithGreyed extends Buffer {
  greyed: Set<string>;
  greyedAt: Map<string, number>;
}

export function applyEvent(buf: Buffer, ev: unknown): Buffer {
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
  const series = [...(next.get(event.fingerprint_id) ?? []), event.p95_ms];
  if (series.length > MAX_POINTS) {
    series.splice(0, series.length - MAX_POINTS);
  }
  next.set(event.fingerprint_id, series);
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
