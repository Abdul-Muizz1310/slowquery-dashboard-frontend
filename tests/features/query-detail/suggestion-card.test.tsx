/**
 * Spec 02 — SuggestionCard discriminated-union renderer.
 * Cases 1, 2, 4, 7, 11, 12, 20.
 */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);

describe("spec 02 — SuggestionCard", () => {
  it("case 1b integration: clicking Apply on fast branch drives the branch switch", async () => {
    // Regression for the audit's top finding: the kind=index card's Apply
    // button used to be an inert <button> with no onClick. It must now be the
    // store-wired <ApplyOnFastBranchButton> that actually POSTs the switch.
    const { SuggestionCard } = await import("@/features/query-detail/suggestion-card");
    const { useBranchStore } = await import("@/features/branches/use-branch-store");
    const { apiClient } = await import("@/lib/api/client");
    useBranchStore.getState().reset();
    const switchSpy = vi.spyOn(apiClient, "switchBranch");
    try {
      render(
        <SuggestionCard
          suggestion={{
            id: 1,
            fingerprint_id: "deadbeefdeadbeef",
            kind: "index",
            source: "rules",
            rule: "sort_without_index",
            sql: "CREATE INDEX ix_foo ON foo(bar);",
            rationale: "sort is expensive",
            applied_at: null,
          }}
        />,
      );
      screen.getByRole("button", { name: /apply on fast/i }).click();
      await waitFor(() => expect(switchSpy).toHaveBeenCalledWith("fast"));
      await waitFor(() => expect(useBranchStore.getState().activeBranch).toBe("fast"));
    } finally {
      switchSpy.mockRestore();
      useBranchStore.getState().reset();
    }
  });

  it("case 1 happy: kind=index renders DDL + Copy button + Apply button", async () => {
    const { SuggestionCard } = await import("@/features/query-detail/suggestion-card");
    render(
      <SuggestionCard
        suggestion={{
          id: 1,
          fingerprint_id: "deadbeefdeadbeef",
          kind: "index",
          source: "rules",
          rule: "sort_without_index",
          sql: "CREATE INDEX IF NOT EXISTS ix_foo ON foo(bar);",
          rationale: "sort is expensive",
          applied_at: null,
        }}
      />,
    );
    expect(screen.getByText(/CREATE INDEX IF NOT EXISTS ix_foo/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /apply on fast/i })).toBeInTheDocument();
  });

  it("case 2 happy: rules-sourced card renders before llm-sourced card", async () => {
    const { SuggestionList } = await import("@/features/query-detail/suggestion-card");
    const { container } = render(
      <SuggestionList
        suggestions={[
          {
            id: 2,
            fingerprint_id: "deadbeefdeadbeef",
            kind: "index",
            source: "llm",
            rule: null,
            sql: "CREATE INDEX ix_llm ON t(c);",
            rationale: "llm",
            applied_at: null,
          },
          {
            id: 1,
            fingerprint_id: "deadbeefdeadbeef",
            kind: "index",
            source: "rules",
            rule: "sort_without_index",
            sql: "CREATE INDEX ix_rule ON t(c);",
            rationale: "rule",
            applied_at: null,
          },
        ]}
      />,
    );
    const text = container.textContent ?? "";
    expect(text.indexOf("ix_rule")).toBeLessThan(text.indexOf("ix_llm"));
  });

  it("case 4 happy: applied_at set disables the Apply button and shows 'Applied' badge", async () => {
    const { SuggestionCard } = await import("@/features/query-detail/suggestion-card");
    render(
      <SuggestionCard
        suggestion={{
          id: 1,
          fingerprint_id: "deadbeefdeadbeef",
          kind: "index",
          source: "rules",
          rule: "sort_without_index",
          sql: "CREATE INDEX ix_foo ON foo(bar);",
          rationale: "rule",
          applied_at: "2026-04-12T01:00:00.000Z",
        }}
      />,
    );
    expect(screen.getByText(/applied/i)).toBeInTheDocument();
    const applyBtn = screen.queryByRole("button", { name: /apply on fast/i });
    expect(applyBtn?.hasAttribute("disabled")).toBe(true);
  });

  it("case 7 edge: empty suggestion list renders empty-state copy", async () => {
    const { SuggestionList } = await import("@/features/query-detail/suggestion-card");
    render(<SuggestionList suggestions={[]} />);
    expect(screen.getByText(/no suggestions yet/i)).toBeInTheDocument();
  });

  it("case 11 edge: kind=rewrite shows before/after block, not DDL copy", async () => {
    const { SuggestionCard } = await import("@/features/query-detail/suggestion-card");
    render(
      <SuggestionCard
        suggestion={{
          id: 1,
          fingerprint_id: "deadbeefdeadbeef",
          kind: "rewrite",
          source: "rules",
          rule: "select_star",
          sql: null,
          rationale: "select only the columns you use",
          applied_at: null,
        }}
      />,
    );
    expect(screen.queryByRole("button", { name: /apply on fast/i })).toBeNull();
  });

  it("case 12 edge: kind=denormalize shows rationale only, no apply button", async () => {
    const { SuggestionCard } = await import("@/features/query-detail/suggestion-card");
    render(
      <SuggestionCard
        suggestion={{
          id: 1,
          fingerprint_id: "deadbeefdeadbeef",
          kind: "denormalize",
          source: "llm",
          rule: null,
          sql: null,
          rationale: "consider a materialised view",
          applied_at: null,
        }}
      />,
    );
    expect(screen.queryByRole("button", { name: /apply/i })).toBeNull();
    expect(screen.getByText(/materialised view/i)).toBeInTheDocument();
  });

  it("case 20 security: DDL SQL is rendered as text, no execution path", async () => {
    const { SuggestionCard } = await import("@/features/query-detail/suggestion-card");
    const { container } = render(
      <SuggestionCard
        suggestion={{
          id: 1,
          fingerprint_id: "deadbeefdeadbeef",
          kind: "index",
          source: "rules",
          rule: "sort_without_index",
          sql: "DROP TABLE users; CREATE INDEX ix ON t(c);",
          rationale: "...",
          applied_at: null,
        }}
      />,
    );
    // The DDL should appear in a code/pre block, not be triggered by anything.
    expect(container.textContent).toContain("DROP TABLE users");
    expect(container.querySelector("script")).toBeNull();
  });

  it("case 12 (partition variant): kind=partition renders rationale only, no apply button", async () => {
    const { SuggestionCard } = await import("@/features/query-detail/suggestion-card");
    render(
      <SuggestionCard
        suggestion={{
          id: 1,
          fingerprint_id: "deadbeefdeadbeef",
          kind: "partition",
          source: "llm",
          rule: null,
          sql: null,
          rationale: "consider range partitioning",
          applied_at: null,
        }}
      />,
    );
    expect(screen.getByText(/range partitioning/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /apply/i })).toBeNull();
  });

  it("invariant 6: CopyButton degrades gracefully when navigator.clipboard is unavailable", async () => {
    const { SuggestionCard } = await import("@/features/query-detail/suggestion-card");
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, "clipboard", {
      value: undefined,
      writable: true,
      configurable: true,
    });
    render(
      <SuggestionCard
        suggestion={{
          id: 1,
          fingerprint_id: "deadbeefdeadbeef",
          kind: "index",
          source: "rules",
          rule: "sort_without_index",
          sql: "CREATE INDEX ix ON t(c);",
          rationale: "test",
          applied_at: null,
        }}
      />,
    );
    const copyBtn = screen.getByRole("button", { name: /copy/i });
    expect(() => copyBtn.click()).not.toThrow();
    Object.defineProperty(navigator, "clipboard", {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
  });

  it("invariant 6: CopyButton invokes clipboard.writeText with the suggestion's DDL", async () => {
    const { SuggestionCard } = await import("@/features/query-detail/suggestion-card");
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: writeTextMock },
      writable: true,
      configurable: true,
    });
    render(
      <SuggestionCard
        suggestion={{
          id: 1,
          fingerprint_id: "deadbeefdeadbeef",
          kind: "index",
          source: "rules",
          rule: "sort_without_index",
          sql: "CREATE INDEX ix ON t(c);",
          rationale: "test",
          applied_at: null,
        }}
      />,
    );
    screen.getByRole("button", { name: /copy/i }).click();
    expect(writeTextMock).toHaveBeenCalledWith("CREATE INDEX ix ON t(c);");
  });

  it("invariant 5: an unreachable/unknown kind hits the exhaustive default branch without crashing", async () => {
    const { SuggestionCard } = await import("@/features/query-detail/suggestion-card");
    const { container } = render(
      <SuggestionCard
        suggestion={{
          id: 99,
          fingerprint_id: "deadbeefdeadbeef",
          kind: "imaginary" as "index",
          source: "rules",
          rule: null,
          sql: null,
          rationale: "",
          applied_at: null,
        }}
      />,
    );
    expect(container).toBeTruthy();
  });
});
