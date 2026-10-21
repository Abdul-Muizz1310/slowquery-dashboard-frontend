/**
 * MSW request handlers covering every slowquery-demo-backend endpoint
 * the dashboard consumes, twice (spec 07): at the backend's URL, where the
 * RSC pages' signed server client calls (process.env.NEXT_PUBLIC_API_URL,
 * pinned by tests/setup.ts), and at the same-origin proxy prefix
 * `PROXY` (jsdom's origin + /api/backend), where the browser client calls.
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
/** The browser client's base: the page's own origin under /api/backend. */
export const PROXY = "http://localhost:3000/api/backend";

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

const handlersFor = (API: string) => [
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

/**
 * Spec 07 guards, ahead of the routes (a resolver that returns nothing falls
 * through): the backend answers 401 to a call without a compact-JWS
 * X-Platform-Token, as the real one does, and the proxy refuses a browser
 * call that carries one, since only the proxy signs. Every composed page and
 * feature test therefore proves its calls took the right path.
 */
const isCompactJws = (value: string | null) => value !== null && value.split(".").length === 3;

const backendRequiresToken = http.all(`${API}/*`, ({ request }) => {
  if (!isCompactJws(request.headers.get("x-platform-token"))) {
    return HttpResponse.json({ detail: "missing_platform_token" }, { status: 401 });
  }
  return undefined;
});

const proxyRefusesBrowserTokens = http.all(`${PROXY}/*`, ({ request }) => {
  if (request.headers.has("x-platform-token")) {
    return HttpResponse.json({ error: "the browser never signs" }, { status: 400 });
  }
  return undefined;
});

export const handlers = [
  backendRequiresToken,
  proxyRefusesBrowserTokens,
  ...handlersFor(API),
  ...handlersFor(PROXY),
];
