/**
 * Spec 00 — SSE frame parser used by streamFingerprints.
 *
 * The full SSE wire format spec allows multi-line messages, named
 * events, and retry hints. We only need single-line `data: <json>\n\n`
 * frames so the parser is intentionally minimal: it pulls the json
 * payload off a frame, runs it through StreamEventSchema, and returns
 * either the parsed event or null. Callers skip nulls so a malformed
 * frame can never break the iterator.
 */

import { type StreamEvent, StreamEventSchema } from "./schemas";

export function parseSseFrame(frame: string): StreamEvent | null {
  const trimmed = frame.trim();
  if (!trimmed.startsWith("data:")) return null;
  const payload = trimmed.slice("data:".length).trim();
  try {
    const json: unknown = JSON.parse(payload);
    const result = StreamEventSchema.safeParse(json);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
