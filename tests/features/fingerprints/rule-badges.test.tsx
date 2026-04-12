/**
 * Spec 01 — RuleBadges severity colour mapping.
 * Cases 4, 5, 10.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

describe("spec 01 — RuleBadges", () => {
  it("case 4 happy: sort_without_index renders yellow badge", async () => {
    const { RuleBadges } = await import("@/features/fingerprints/rule-badges");
    render(
      <RuleBadges
        suggestions={[
          {
            id: 1,
            fingerprint_id: "deadbeefdeadbeef",
            kind: "index",
            source: "rules",
            rule: "sort_without_index",
            sql: null,
            rationale: "",
            applied_at: null,
          },
        ]}
      />,
    );
    const badge = screen.getByText(/sort_without_index/i);
    expect(badge.className).toMatch(/warning/);
  });

  it("case 5 happy: rule-sourced badge renders before llm-sourced badge", async () => {
    const { RuleBadges } = await import("@/features/fingerprints/rule-badges");
    const { container } = render(
      <RuleBadges
        suggestions={[
          {
            id: 2,
            fingerprint_id: "deadbeefdeadbeef",
            kind: "index",
            source: "llm",
            rule: null,
            sql: null,
            rationale: "",
            applied_at: null,
          },
          {
            id: 1,
            fingerprint_id: "deadbeefdeadbeef",
            kind: "index",
            source: "rules",
            rule: "seq_scan_large_table",
            sql: null,
            rationale: "",
            applied_at: null,
          },
        ]}
      />,
    );
    const text = container.textContent ?? "";
    const rulesIdx = text.indexOf("seq_scan_large_table");
    const llmIdx = text.indexOf("llm");
    expect(rulesIdx).toBeLessThan(llmIdx);
  });

  it("case 10 edge: unknown rule renders neutral badge, no error", async () => {
    const { RuleBadges } = await import("@/features/fingerprints/rule-badges");
    render(
      <RuleBadges
        suggestions={[
          {
            id: 1,
            fingerprint_id: "deadbeefdeadbeef",
            kind: "index",
            source: "rules",
            rule: "bogus_rule",
            sql: null,
            rationale: "",
            applied_at: null,
          },
        ]}
      />,
    );
    const badge = screen.getByText(/bogus_rule/);
    expect(badge.className).toMatch(/neutral/);
  });
});
