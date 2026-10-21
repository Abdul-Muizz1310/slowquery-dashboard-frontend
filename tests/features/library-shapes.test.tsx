/**
 * Spec 08 — the slowquery-detective 0.2 response shapes, parsed and rendered.
 * Cases S1-S7 and S9 (S8 is the E2E suite against the mock backend).
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { detailOrdersByCreatedAt } from "../mocks/fixtures/fingerprint-detail";
import { fingerprintsList } from "../mocks/fixtures/fingerprints";
import {
  libraryDetail,
  libraryDetailsById,
  libraryFingerprintsList,
} from "../mocks/fixtures/library-shapes";

afterEach(cleanup);

const FP = "c168fc78a2e7d01c";

describe("spec 08 — schemas accept both shapes", () => {
  it("S1 a library QueryRow list parses", async () => {
    const { FingerprintsListSchema } = await import("@/lib/api/schemas");
    const parsed = FingerprintsListSchema.parse(libraryFingerprintsList);
    expect(parsed).toHaveLength(libraryFingerprintsList.length);
    expect(Number.isInteger(parsed[0]?.total_ms)).toBe(false);
    expect(parsed[0]?.suggestions?.[0]?.id).toBeUndefined();
  });

  it("S2 a library QueryDetail parses", async () => {
    const { FingerprintDetailSchema } = await import("@/lib/api/schemas");
    const parsed = FingerprintDetailSchema.parse(libraryDetailsById[FP]);
    expect(parsed.explain_plan?.plan_text).toBeUndefined();
    expect(parsed.recent_samples[0]?.request_id).toBe("req-e2e-1");
    expect(parsed.recent_samples[0]?.rows).toBeUndefined();
  });

  it("S3 the 0.1-era list and detail still parse", async () => {
    const { FingerprintDetailSchema, FingerprintsListSchema } = await import("@/lib/api/schemas");
    expect(FingerprintsListSchema.parse(fingerprintsList)).toHaveLength(fingerprintsList.length);
    expect(FingerprintDetailSchema.parse(detailOrdersByCreatedAt).suggestions[0]?.id).toBe(501);
  });

  it("S4 closed enums and invariants still reject drift", async () => {
    const { FingerprintDetailSchema, FingerprintsListSchema } = await import("@/lib/api/schemas");
    const row = libraryFingerprintsList[0] as Record<string, unknown>;
    const badKind = [
      {
        ...row,
        suggestions: [
          { kind: "teleport", source: "rules", sql: null, rationale: "", applied_at: null },
        ],
      },
    ];
    expect(() => FingerprintsListSchema.parse(badKind)).toThrow();
    expect(() => FingerprintsListSchema.parse([{ ...row, total_ms: -1 }])).toThrow();
    const detail = libraryDetailsById[FP] as Record<string, unknown>;
    const plan = detail.explain_plan as Record<string, unknown>;
    expect(() =>
      FingerprintDetailSchema.parse({ ...detail, explain_plan: { ...plan, plan_json: undefined } }),
    ).toThrow();
  });
});

describe("spec 08 — rendering never needs a 0.1-only field", () => {
  it("S5 the table rounds a fractional total_ms and renders badges without ids", async () => {
    const { FingerprintsListSchema } = await import("@/lib/api/schemas");
    const { FingerprintsTable } = await import("@/features/fingerprints/fingerprints-table");
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const rows = FingerprintsListSchema.parse([
      {
        ...(libraryFingerprintsList[0] as Record<string, unknown>),
        total_ms: 34301.62,
        suggestions: [
          {
            kind: "index",
            source: "rules",
            sql: "CREATE INDEX a ON t(x);",
            rationale: "a",
            applied_at: null,
          },
          { kind: "rewrite", source: "llm", sql: null, rationale: "b", applied_at: null },
        ],
      },
    ]);
    render(<FingerprintsTable fingerprints={rows} sort="total_ms" order="desc" />);
    const dataRow = screen.getAllByRole("row")[1];
    expect(dataRow?.textContent).toContain("34302");
    expect(dataRow?.textContent).not.toContain("34301.62");
    const keyWarnings = errors.mock.calls.flat().join(" ");
    expect(keyWarnings).not.toMatch(/unique "key"/);
    errors.mockRestore();
  });

  it("S6 suggestions: rules first, list order kept within a source when there is no id", async () => {
    const { FingerprintDetailSchema } = await import("@/lib/api/schemas");
    const { SuggestionList } = await import("@/features/query-detail/suggestion-card");
    const detail = FingerprintDetailSchema.parse({
      ...(libraryDetailsById[FP] as Record<string, unknown>),
      suggestions: [
        {
          kind: "rewrite",
          source: "llm",
          sql: null,
          rationale: "llm first in the list",
          applied_at: null,
        },
        {
          kind: "index",
          source: "rules",
          sql: "CREATE INDEX b ON t(y);",
          rationale: "rule b",
          applied_at: null,
        },
        {
          kind: "index",
          source: "rules",
          sql: "CREATE INDEX a ON t(x);",
          rationale: "rule a",
          applied_at: null,
        },
      ],
    });
    const { container } = render(<SuggestionList suggestions={detail.suggestions} />);
    const text = container.textContent ?? "";
    expect(text.indexOf("rule b")).toBeLessThan(text.indexOf("rule a"));
    expect(text.indexOf("rule a")).toBeLessThan(text.indexOf("llm first in the list"));
  });

  it("S7 recent samples render without id or rows", async () => {
    const { FingerprintDetailSchema } = await import("@/lib/api/schemas");
    const { RecentSamplesTable } = await import("@/features/query-detail/recent-samples-table");
    const detail = FingerprintDetailSchema.parse(libraryDetailsById[FP]);
    render(<RecentSamplesTable samples={detail.recent_samples} />);
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(1 + detail.recent_samples.length);
    expect(rows[1]?.textContent).toContain("—");
  });

  it("S9 a plan stored as EXPLAIN's top-level object renders as a tree", async () => {
    const { FingerprintDetailSchema } = await import("@/lib/api/schemas");
    const { ExplainPlanViewer } = await import("@/features/query-detail/explain-plan-viewer");
    const detail = FingerprintDetailSchema.parse(libraryDetail(detailOrdersByCreatedAt));
    if (!detail.explain_plan) throw new Error("fixture has a plan");
    const { container } = render(<ExplainPlanViewer plan={detail.explain_plan} />);
    expect(container.querySelector("pre")).toBeNull();
    expect(container.textContent).toContain("Seq Scan");
  });
});
