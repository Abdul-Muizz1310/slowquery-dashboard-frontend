/**
 * Spec 00 — Zod schema contracts for every API response shape.
 * Cases 8-12, 20.
 */

import { describe, expect, it } from "vitest";
import {
  detailOrdersByCreatedAt,
  detailUsersOrders,
} from "../../mocks/fixtures/fingerprint-detail";
import {
  fingerprintNPlusOne,
  fingerprintOrdersByCreatedAt,
} from "../../mocks/fixtures/fingerprints";

describe("spec 00 — schemas", () => {
  it("case 8 edge: p95_ms null parses to null, not undefined or 0", async () => {
    const { FingerprintSchema } = await import("@/lib/api/schemas");
    const parsed = FingerprintSchema.parse({ ...fingerprintOrdersByCreatedAt, p95_ms: null });
    expect(parsed.p95_ms).toBeNull();
  });

  it("case 9 edge: explain_plan null parses successfully on detail", async () => {
    const { FingerprintDetailSchema } = await import("@/lib/api/schemas");
    const parsed = FingerprintDetailSchema.parse({
      ...detailOrdersByCreatedAt,
      explain_plan: null,
    });
    expect(parsed.explain_plan).toBeNull();
  });

  it("case 10 edge: suggestions [] parses successfully", async () => {
    const { FingerprintDetailSchema } = await import("@/lib/api/schemas");
    const parsed = FingerprintDetailSchema.parse({
      ...detailUsersOrders,
      suggestions: [],
    });
    expect(parsed.suggestions).toEqual([]);
  });

  it("case 11 edge: unknown rule name on a suggestion still parses (rule is free text)", async () => {
    const { SuggestionSchema } = await import("@/lib/api/schemas");
    const parsed = SuggestionSchema.parse({
      id: 1,
      fingerprint_id: "deadbeefdeadbeef",
      kind: "index",
      source: "rules",
      rule: "some_new_unreleased_rule",
      sql: "CREATE INDEX ...;",
      rationale: "...",
      applied_at: null,
    });
    expect(parsed.rule).toBe("some_new_unreleased_rule");
  });

  it("case 12 edge: ISO timestamps with and without millis both parse", async () => {
    const { FingerprintSchema } = await import("@/lib/api/schemas");
    const a = FingerprintSchema.parse({
      ...fingerprintNPlusOne,
      first_seen: "2026-04-12T00:58:14Z",
    });
    const b = FingerprintSchema.parse({
      ...fingerprintNPlusOne,
      first_seen: "2026-04-12T00:58:14.778Z",
    });
    expect(a.first_seen).toBeDefined();
    expect(b.first_seen).toBeDefined();
  });

  it("case 20 failure: unknown suggestion kind fails parse", async () => {
    const { SuggestionSchema } = await import("@/lib/api/schemas");
    expect(() =>
      SuggestionSchema.parse({
        id: 1,
        fingerprint_id: "deadbeefdeadbeef",
        kind: "bogus_kind",
        source: "rules",
        rule: null,
        sql: null,
        rationale: "...",
        applied_at: null,
      }),
    ).toThrow();
  });

  it("case 20b security: unknown suggestion source fails parse", async () => {
    const { SuggestionSchema } = await import("@/lib/api/schemas");
    expect(() =>
      SuggestionSchema.parse({
        id: 1,
        fingerprint_id: "deadbeefdeadbeef",
        kind: "index",
        source: "scraped_from_stackoverflow",
        rule: null,
        sql: "...",
        rationale: "...",
        applied_at: null,
      }),
    ).toThrow();
  });
});
