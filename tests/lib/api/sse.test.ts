/**
 * Spec 00 — SSE helper used by streamFingerprints.
 * These cases exercise reconnect + abort behaviour.
 */

import { HttpResponse, http } from "msw";
import { describe, expect, it } from "vitest";
import { server } from "../../mocks/server";

const API = "https://slowquery-demo-backend.onrender.com";

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

  it("returns null for every non-'data:' SSE field prefix", async () => {
    const { parseSseFrame } = await import("@/lib/api/sse");
    expect(parseSseFrame("event: message")).toBeNull();
    expect(parseSseFrame("id: 123")).toBeNull();
    expect(parseSseFrame("retry: 5000")).toBeNull();
    expect(parseSseFrame("")).toBeNull();
  });

  it("returns null when the data payload is valid JSON but fails the StreamEvent schema", async () => {
    const { parseSseFrame } = await import("@/lib/api/sse");
    expect(parseSseFrame('data: {"invalid": "schema"}')).toBeNull();
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

  it("case 22 (extended): a network error while opening the stream throws NetworkError", async () => {
    server.use(http.get(`${API}/_slowquery/api/stream`, () => HttpResponse.error()));
    const { apiClient } = await import("@/lib/api/client");
    const { NetworkError } = await import("@/lib/api/errors");
    const controller = new AbortController();
    await expect(async () => {
      for await (const _ev of apiClient.streamFingerprints(controller.signal)) {
        // consume
      }
    }).rejects.toBeInstanceOf(NetworkError);
  });

  it("case 22 (extended): a null response body throws NetworkError", async () => {
    server.use(
      http.get(`${API}/_slowquery/api/stream`, () => {
        return new HttpResponse(null, { headers: { "Content-Type": "text/event-stream" } });
      }),
    );
    const { apiClient } = await import("@/lib/api/client");
    const { NetworkError } = await import("@/lib/api/errors");
    const controller = new AbortController();
    await expect(async () => {
      for await (const _ev of apiClient.streamFingerprints(controller.signal)) {
        // consume
      }
    }).rejects.toBeInstanceOf(NetworkError);
  });

  it("case 22 (extended): the stream ending (server closes cleanly) still surfaces NetworkError so the caller reconnects", async () => {
    const { apiClient } = await import("@/lib/api/client");
    const { NetworkError } = await import("@/lib/api/errors");
    const controller = new AbortController();
    const events: unknown[] = [];
    let caughtError: unknown;
    try {
      for await (const ev of apiClient.streamFingerprints(controller.signal)) {
        events.push(ev);
      }
    } catch (err) {
      caughtError = err;
    }
    expect(caughtError).toBeInstanceOf(NetworkError);
    expect(events.length).toBeGreaterThan(0);
  });

  it("case 22 (extended): the reader throwing mid-stream (non-abort) surfaces NetworkError", async () => {
    server.use(
      http.get(`${API}/_slowquery/api/stream`, () => {
        const stream = new ReadableStream<Uint8Array>({
          start(ctrl) {
            ctrl.enqueue(
              new TextEncoder().encode(
                'data: {"kind":"heartbeat","now":"2026-04-12T01:00:00.000Z"}\n\n',
              ),
            );
          },
          pull() {
            throw new TypeError("stream read error");
          },
        });
        return new HttpResponse(stream, { headers: { "Content-Type": "text/event-stream" } });
      }),
    );
    const { apiClient } = await import("@/lib/api/client");
    const { NetworkError } = await import("@/lib/api/errors");
    const controller = new AbortController();
    await expect(async () => {
      for await (const _ev of apiClient.streamFingerprints(controller.signal)) {
        // consume the heartbeat, then read() throws
      }
    }).rejects.toBeInstanceOf(NetworkError);
  });
});
