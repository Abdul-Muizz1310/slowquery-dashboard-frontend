/**
 * MSW request handlers covering every slowquery-demo-backend endpoint
 * the dashboard consumes. The base URL is read from
 * process.env.NEXT_PUBLIC_API_URL which tests/setup.ts pins to the
 * Render URL before MSW boots.
 */

import { HttpResponse, http } from "msw";
import { detailsById } from "./fixtures/fingerprint-detail";
import { fingerprintsList } from "./fixtures/fingerprints";
import { switchToFastOk, switchToSlowOk } from "./fixtures/switch-response";

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://slowquery-demo-backend.onrender.com";

export const handlers = [
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
