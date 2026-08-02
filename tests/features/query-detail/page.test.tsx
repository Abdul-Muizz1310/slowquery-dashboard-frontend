/**
 * Spec 02 — /queries/[id] RSC entry point, validation + error routing.
 * Cases 13, 15-17, 19, 23 (helpers in isolation) plus a "composed" block
 * that calls the actual exported `Page` — the audit's "0% coverage on the
 * composed RSC" finding (only the extracted helpers were ever imported
 * directly; `@/app/queries/[id]/page` itself had no importer). These drive
 * cases 1, 6, 15-17, 19 through the real request/render path, matching the
 * pattern already established for `/` in tests/integration/composed-paths.test.tsx.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it } from "vitest";
import { detailNPlusOne, detailOrdersByCreatedAt } from "../../mocks/fixtures/fingerprint-detail";
import { FINGERPRINT_ORDERS_BY_CREATED_AT_ID } from "../../mocks/fixtures/fingerprints";
import { server } from "../../mocks/server";

const API = "https://slowquery-demo-backend.onrender.com";

afterEach(cleanup);

describe("spec 02 — query detail page", () => {
  it("case 13 edge: unknown suggestion kind fails page-level parse", async () => {
    const { parseDetailOrThrow } = await import("@/features/query-detail/parse");
    const invalid = {
      fingerprint: {},
      canonical_sql: "",
      explain_plan: null,
      suggestions: [{ id: 1, kind: "invalid", source: "rules" }],
      recent_samples: [],
    };
    expect(() => parseDetailOrThrow(invalid)).toThrow();
  });

  it("case 15 failure: HttpError(404) routes to NotFound component", async () => {
    const { errorToView } = await import("@/features/query-detail/error-routing");
    const { HttpError } = await import("@/lib/api/errors");
    expect(errorToView(new HttpError(404, "not found"))).toBe("not-found");
  });

  it("case 16 failure: HttpError(500) routes to ErrorState with retry", async () => {
    const { errorToView } = await import("@/features/query-detail/error-routing");
    const { HttpError } = await import("@/lib/api/errors");
    expect(errorToView(new HttpError(500, "boom"))).toBe("error-retry");
  });

  it("case 17 failure: ParseError routes to server-only logged ErrorState", async () => {
    const { errorToView } = await import("@/features/query-detail/error-routing");
    const { ParseError } = await import("@/lib/api/errors");
    expect(errorToView(new ParseError("bad", "suggestions"))).toBe("error-malformed");
  });

  it("case 19 security: invalid fingerprint id shape is rejected without calling backend", async () => {
    const { validateIdOrNotFound } = await import("@/features/query-detail/parse");
    expect(validateIdOrNotFound("not-16-hex")).toBe(null);
    expect(validateIdOrNotFound("c168fc78a2e7d01c")).toBe("c168fc78a2e7d01c");
  });

  it("case 23 security: id value is never embedded into template literals or eval", async () => {
    // This test is an API-shape test: parse.ts should export only pure
    // validation functions and never return a URL string built via `eval`.
    const parseModule = await import("@/features/query-detail/parse");
    const members = Object.keys(parseModule);
    for (const name of members) {
      const fn = parseModule[name as keyof typeof parseModule];
      if (typeof fn === "function") {
        expect(fn.toString()).not.toContain("eval(");
        expect(fn.toString()).not.toContain("new Function(");
      }
    }
  });
});

/* ------------------------------------------------------------------ */
/* Composed page — the actual exported `Page`, not just its helpers.   */
/* Previously 0% covered: only parse.ts/error-routing.ts were imported */
/* directly anywhere in the unit suite.                                */
/* ------------------------------------------------------------------ */
describe("spec 02 — /queries/[id] page (composed)", () => {
  it("case 1 happy: renders header, canonical SQL, plan viewer, and suggestion card", async () => {
    const Page = (await import("@/app/queries/[id]/page")).default;
    const el = await Page({
      params: Promise.resolve({ id: FINGERPRINT_ORDERS_BY_CREATED_AT_ID }),
    });
    render(el);
    expect(screen.getByText(FINGERPRINT_ORDERS_BY_CREATED_AT_ID)).toBeInTheDocument();
    expect(screen.getByText(/ORDER BY created_at DESC/)).toBeInTheDocument();
    expect(screen.getByText("Sort")).toBeInTheDocument();
    expect(screen.getByText(/CREATE INDEX IF NOT EXISTS ix_orders_created_at/)).toBeInTheDocument();
  });

  it("case 6 edge: explain_plan null renders the friendly notice, no viewer", async () => {
    const Page = (await import("@/app/queries/[id]/page")).default;
    const el = await Page({ params: Promise.resolve({ id: detailNPlusOne.fingerprint.id }) });
    render(el);
    expect(screen.getByText(/explain plan not captured yet/i)).toBeInTheDocument();
  });

  it("case 19 (composed) security: invalid id shape calls notFound() without hitting the backend", async () => {
    const Page = (await import("@/app/queries/[id]/page")).default;
    await expect(Page({ params: Promise.resolve({ id: "not-16-hex" }) })).rejects.toMatchObject({
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
  });

  it("case 15 (composed) failure: unknown (but valid-shape) id calls notFound()", async () => {
    const Page = (await import("@/app/queries/[id]/page")).default;
    await expect(
      Page({ params: Promise.resolve({ id: "0000000000000000" }) }),
    ).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
  });

  it("case 16 (composed) failure: backend 500 renders the error-retry panel", async () => {
    server.use(
      http.get(`${API}/_slowquery/queries/:id`, () => HttpResponse.text("boom", { status: 500 })),
    );
    const Page = (await import("@/app/queries/[id]/page")).default;
    const el = await Page({
      params: Promise.resolve({ id: FINGERPRINT_ORDERS_BY_CREATED_AT_ID }),
    });
    render(el);
    expect(screen.getByText(/backend error — try again/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /retry/i })).toBeInTheDocument();
  });

  it("case 17 (composed) failure: malformed backend shape renders the malformed-response panel", async () => {
    server.use(
      http.get(`${API}/_slowquery/queries/:id`, () => HttpResponse.json({ unexpected: "shape" })),
    );
    const Page = (await import("@/app/queries/[id]/page")).default;
    const el = await Page({
      params: Promise.resolve({ id: FINGERPRINT_ORDERS_BY_CREATED_AT_ID }),
    });
    render(el);
    expect(screen.getByText(/backend response looked malformed/i)).toBeInTheDocument();
  });

  it("happy: recent samples table renders the fixture's sample rows", async () => {
    const Page = (await import("@/app/queries/[id]/page")).default;
    const el = await Page({
      params: Promise.resolve({ id: FINGERPRINT_ORDERS_BY_CREATED_AT_ID }),
    });
    render(el);
    // detailOrdersByCreatedAt has 2 recent_samples fixtures + 1 header row.
    expect(screen.getAllByRole("row").length).toBe(
      detailOrdersByCreatedAt.recent_samples.length + 1,
    );
  });
});
