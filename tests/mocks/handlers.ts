/**
 * MSW request handlers covering every slowquery-demo-backend endpoint
 * the dashboard consumes. The base URL is read from
 * process.env.NEXT_PUBLIC_API_URL which tests/setup.ts pins to the
 * Render URL before MSW boots.
 */

import { HttpResponse, http } from "msw";
import { detailsById } from "./fixtures/fingerprint-detail";
import { fingerprintsList } from "./fixtures/fingerprints";
import {
  branchSwitchedToFast,
  heartbeat,
  tickOrdersCreatedAt,
  tickUsersOrders,
} from "./fixtures/stream-events";
import { switchToFastOk, switchToSlowOk } from "./fixtures/switch-response";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://slowquery-demo-backend.onrender.com";

function sseFrame(payload: string): string {
  return `data: ${payload}\n\n`;
}

const sseFrames = [
  sseFrame(JSON.stringify(tickOrdersCreatedAt)),
  // a deliberately malformed frame in the middle, asserts the iterator
  // stays open and skips it (spec 00 case 21).
  sseFrame("not-json"),
  sseFrame(JSON.stringify(tickUsersOrders)),
  sseFrame(JSON.stringify(heartbeat)),
  sseFrame(JSON.stringify(branchSwitchedToFast)),
];

export const handlers = [
  http.get(`${API}/_slowquery/api/stream`, () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        for (const frame of sseFrames) {
          controller.enqueue(encoder.encode(frame));
        }
        controller.close();
      },
    });
    return new HttpResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }),

  http.get(`${API}/_slowquery/queries`, () => {
    return HttpResponse.json(fingerprintsList);
  }),

  http.get(`${API}/_slowquery/queries/:id`, ({ params }) => {
    const id = typeof params.id === "string" ? params.id : "";
    const detail = detailsById[id];
    if (!detail) {
      return HttpResponse.json({ detail: "not found" }, { status: 404 });
    }
    return HttpResponse.json(detail);
  }),

  http.post(`${API}/branches/switch`, async ({ request }) => {
    const body = (await request.json()) as { target?: unknown };
    if (body.target === "fast") {
      return HttpResponse.json(switchToFastOk);
    }
    if (body.target === "slow") {
      return HttpResponse.json(switchToSlowOk);
    }
    return HttpResponse.json({ detail: "invalid target" }, { status: 422 });
  }),
];
