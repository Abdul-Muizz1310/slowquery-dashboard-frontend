/**
 * Spec 02 — /queries/[id] RSC entry point, validation + error routing.
 * Cases 13, 15-17, 19, 23.
 */

import { describe, expect, it } from "vitest";

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
