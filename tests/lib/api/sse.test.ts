/**
 * Spec 00 — SSE helper used by streamFingerprints.
 * These cases exercise reconnect + abort behaviour.
 */

import { describe, expect, it } from "vitest";

describe("spec 00 — sse helper", () => {
  it("parses well-formed SSE frames into StreamEvent values", async () => {
    const { parseSseFrame } = await import("@/lib/api/sse");
    const frame = 'data: {"kind":"heartbeat","now":"2026-04-12T01:00:00.000Z"}\n\n';
    const parsed = parseSseFrame(frame);
    expect(parsed?.kind).toBe("heartbeat");
  });

  it("returns null on a malformed frame (caller skips)", async () => {
    const { parseSseFrame } = await import("@/lib/api/sse");
    const frame = "data: not-json\n\n";
    expect(parseSseFrame(frame)).toBeNull();
  });

  it("abort signal closes the iterator promptly", async () => {
    const { apiClient } = await import("@/lib/api/client");
    const controller = new AbortController();
    controller.abort();
    const events: unknown[] = [];
    for await (const ev of apiClient.streamFingerprints(controller.signal)) {
      events.push(ev);
    }
    expect(events).toEqual([]);
  });
});
