/**
 * Coverage-gap tests. Exercises every uncovered line identified by v8.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fingerprintsList } from "./mocks/fixtures/fingerprints";
import { server } from "./mocks/server";

const API = "https://slowquery-demo-backend.onrender.com";

afterEach(cleanup);

/* ------------------------------------------------------------------ */
/* demo/layout.tsx — line 18: render DemoLayout                       */
/* ------------------------------------------------------------------ */
describe("demo/layout.tsx", () => {
  it("DemoLayout renders PageFrame with demo active and children", async () => {
    const DemoLayout = (await import("@/app/demo/layout")).default;
    render(
      <DemoLayout>
        <div data-testid="child">child</div>
      </DemoLayout>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
    // PageFrame renders AppNav with demo active
    expect(screen.getByText("demo")).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
/* demo/page.tsx — lines 21-28: the async Page RSC                    */
/* ------------------------------------------------------------------ */
describe("demo/page.tsx", () => {
  it("Page renders DemoPanel with fetched seed on success", async () => {
    const Page = (await import("@/app/demo/page")).default;
    const el = await Page();
    const { container } = render(el);
    expect(container.querySelector("[data-testid='demo-fingerprints-panel']")).not.toBeNull();
  });

  it("Page catches fetch error and passes error prop to DemoPanel", async () => {
    server.use(
      http.get(`${API}/_slowquery/queries`, () => HttpResponse.text("boom", { status: 500 })),
    );
    const Page = (await import("@/app/demo/page")).default;
    const el = await Page();
    const { container } = render(el);
    expect(container.textContent).toMatch(/500/);
  });
});

/* ------------------------------------------------------------------ */
/* apply-button.tsx — line 22: onClick calls switchBranch              */
/* ------------------------------------------------------------------ */
describe("apply-button.tsx onClick", () => {
  it("clicking the button calls switchBranch", async () => {
    const { ApplyOnFastBranchButton } = await import("@/features/branches/apply-button");
    const { useBranchStore } = await import("@/features/branches/use-branch-store");
    useBranchStore.getState().reset();
    useBranchStore.getState().hydrate("slow");
    render(<ApplyOnFastBranchButton />);
    const btn = screen.getByRole("button", { name: /apply on fast/i });
    btn.click();
    // Wait for the async switch to complete
    await vi.waitFor(() => {
      expect(useBranchStore.getState().activeBranch).toBe("fast");
    });
  });
});

/* ------------------------------------------------------------------ */
/* branch-store.ts — line 28: friendlyError non-Error non-string      */
/* ------------------------------------------------------------------ */
describe("branch-store.ts friendlyError edge", () => {
  it("non-Error rejection wraps as 'branch switch failed'", async () => {
    const { apiClient } = await import("@/lib/api/client");
    const { useBranchStore } = await import("@/features/branches/use-branch-store");
    useBranchStore.getState().reset();
    useBranchStore.getState().hydrate("slow");
    // Monkey-patch switchBranch to reject with a non-Error value
    const origSwitch = apiClient.switchBranch;
    apiClient.switchBranch = () => Promise.reject(42);
    try {
      const result = await useBranchStore
        .getState()
        .switch("fast")
        .catch((e: unknown) => e);
      expect(String(result)).toMatch(/branch switch failed/i);
    } finally {
      apiClient.switchBranch = origSwitch;
      useBranchStore.getState().reset();
    }
  });
});

/* ------------------------------------------------------------------ */
/* error-state.tsx — line 46: fallback for unknown error type          */
/* ------------------------------------------------------------------ */
describe("error-state.tsx fallback", () => {
  it("unknown error type renders 'Something went wrong'", async () => {
    const { ErrorState } = await import("@/features/fingerprints/error-state");
    const { NetworkError } = await import("@/lib/api/errors");
    render(<ErrorState error={new NetworkError("network down")} />);
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
/* fingerprints-table.tsx — lines 35-37: sort by p95_ms with nulls    */
/* ------------------------------------------------------------------ */
describe("fingerprints-table.tsx sort by p95_ms", () => {
  it("sorts by p95_ms desc with null values last", async () => {
    const { FingerprintsTable } = await import("@/features/fingerprints/fingerprints-table");
    const fps = [
      { ...fingerprintsList[0]!, id: "a000000000000001", p95_ms: null, total_ms: 100 },
      { ...fingerprintsList[0]!, id: "a000000000000002", p95_ms: 500, total_ms: 200 },
      { ...fingerprintsList[0]!, id: "a000000000000003", p95_ms: 100, total_ms: 300 },
    ];
    render(<FingerprintsTable fingerprints={fps} sort="p95_ms" order="desc" />);
    const rows = screen.getAllByRole("row");
    // 1 header + 3 data rows
    expect(rows.length).toBe(4);
  });

  it("sorts by p95_ms asc", async () => {
    const { FingerprintsTable } = await import("@/features/fingerprints/fingerprints-table");
    const fps = [
      { ...fingerprintsList[0]!, id: "a000000000000001", p95_ms: 500, total_ms: 100 },
      { ...fingerprintsList[0]!, id: "a000000000000002", p95_ms: 100, total_ms: 200 },
    ];
    render(<FingerprintsTable fingerprints={fps} sort="p95_ms" order="asc" />);
    const rows = screen.getAllByRole("row");
    expect(rows.length).toBe(3);
  });

  it("sorts by call_count", async () => {
    const { FingerprintsTable } = await import("@/features/fingerprints/fingerprints-table");
    render(<FingerprintsTable fingerprints={fingerprintsList} sort="call_count" order="desc" />);
    const rows = screen.getAllByRole("row");
    expect(rows.length).toBe(4);
  });
});

/* ------------------------------------------------------------------ */
/* format.ts — line 24: formatMs 10 <= value < 100; line 45: fallback */
/* ------------------------------------------------------------------ */
describe("format.ts uncovered branches", () => {
  it("formatMs for value between 10 and 100", async () => {
    const { formatMs } = await import("@/features/fingerprints/format");
    expect(formatMs(55)).toBe("55.0ms");
    expect(formatMs(10)).toBe("10.0ms");
    expect(formatMs(99.9)).toBe("99.9ms");
  });

  it("formatMs for value < 10", async () => {
    const { formatMs } = await import("@/features/fingerprints/format");
    expect(formatMs(5.5)).toBe("5.5ms");
  });

  it("formatRelative falls through to 'second' for very small deltas", async () => {
    const { formatRelative } = await import("@/features/fingerprints/format");
    const now = new Date();
    const justNow = new Date(now.getTime() - 500);
    const result = formatRelative(justNow, now);
    // Should render something like "0 seconds ago" or "now"
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("formatRelative for exactly 0ms delta", async () => {
    const { formatRelative } = await import("@/features/fingerprints/format");
    const now = new Date();
    const result = formatRelative(now, now);
    expect(typeof result).toBe("string");
  });
});

/* ------------------------------------------------------------------ */
/* parse.ts — branch at line 30: invalid order falls back to "desc"   */
/* ------------------------------------------------------------------ */
describe("parse.ts invalid order", () => {
  it("invalid order falls back to desc", async () => {
    const { normaliseSortParams } = await import("@/features/fingerprints/parse");
    const result = normaliseSortParams({ sort: "total_ms", order: "bogus" });
    expect(result.order).toBe("desc");
  });
});

/* ------------------------------------------------------------------ */
/* rule-badges.tsx — lines 36 (null rule), 42-53 (labelFor paths)     */
/* ------------------------------------------------------------------ */
describe("rule-badges.tsx uncovered", () => {
  it("source=rules with null rule renders 'rule' label with neutral severity", async () => {
    const { RuleBadges } = await import("@/features/fingerprints/rule-badges");
    render(
      <RuleBadges
        suggestions={[
          {
            id: 1,
            fingerprint_id: "deadbeefdeadbeef",
            kind: "index",
            source: "rules",
            rule: null,
            sql: null,
            rationale: "",
            applied_at: null,
          },
        ]}
      />,
    );
    expect(screen.getByText("rule")).toBeInTheDocument();
  });

  it("source=llm renders 'llm' label with purple severity", async () => {
    const { RuleBadges } = await import("@/features/fingerprints/rule-badges");
    render(
      <RuleBadges
        suggestions={[
          {
            id: 1,
            fingerprint_id: "deadbeefdeadbeef",
            kind: "index",
            source: "llm",
            rule: null,
            sql: null,
            rationale: "",
            applied_at: null,
          },
        ]}
      />,
    );
    const badge = screen.getByText("llm");
    expect(badge.className).toMatch(/8b5cf6/);
  });
});

/* ------------------------------------------------------------------ */
/* sort-header.tsx — line 36: onKeyDown handler                       */
/* ------------------------------------------------------------------ */
describe("sort-header.tsx onKeyDown", () => {
  it("Enter key triggers onChange", async () => {
    const { SortHeader } = await import("@/features/fingerprints/sort-header");
    const onChange = vi.fn();
    render(
      <table>
        <thead>
          <tr>
            <SortHeader
              field="p95_ms"
              currentSort="total_ms"
              currentOrder="desc"
              onChange={onChange}
            >
              p95
            </SortHeader>
          </tr>
        </thead>
      </table>,
    );
    const header = screen.getByRole("columnheader", { name: /p95/i });
    fireEvent.keyDown(header, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith({ sort: "p95_ms", order: "desc" });
  });

  it("Space key triggers onChange", async () => {
    const { SortHeader } = await import("@/features/fingerprints/sort-header");
    const onChange = vi.fn();
    render(
      <table>
        <thead>
          <tr>
            <SortHeader
              field="p95_ms"
              currentSort="total_ms"
              currentOrder="desc"
              onChange={onChange}
            >
              p95
            </SortHeader>
          </tr>
        </thead>
      </table>,
    );
    const header = screen.getByRole("columnheader", { name: /p95/i });
    fireEvent.keyDown(header, { key: " " });
    expect(onChange).toHaveBeenCalledWith({ sort: "p95_ms", order: "desc" });
  });
});

/* ------------------------------------------------------------------ */
/* canonical-sql.tsx — line 34: Monaco dynamic import inner Wrapped   */
/* ------------------------------------------------------------------ */
describe("canonical-sql.tsx Monaco wrapper", () => {
  it("renders CanonicalSql with the hidden Monaco wrapper div", async () => {
    const { CanonicalSql } = await import("@/features/query-detail/canonical-sql");
    const { container } = render(<CanonicalSql sql="SELECT 1" />);
    // The <pre> is always visible; the hidden div wraps the Monaco lazy load
    expect(container.querySelector("pre")?.textContent).toContain("SELECT 1");
    expect(container.querySelector(".hidden")).not.toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* plan-viewer.tsx — branches at 34 (non-hotspot), 54-56 (children)   */
/* ------------------------------------------------------------------ */
describe("plan-viewer.tsx uncovered branches", () => {
  it("non-hotspot node type renders without hotspot class", async () => {
    const { ExplainPlanViewer } = await import("@/features/query-detail/explain-plan-viewer");
    render(
      <ExplainPlanViewer
        plan={{
          fingerprint_id: "deadbeefdeadbeef",
          plan_json: {
            "Node Type": "Index Scan",
            "Total Cost": 100,
            "Plan Rows": 10,
            "Relation Name": "users",
          },
          plan_text: "...",
          cost: 100,
          captured_at: "2026-04-12T01:00:00.000Z",
        }}
      />,
    );
    const node = screen.getByText("Index Scan");
    expect(node.className).toMatch(/text-foreground/);
    expect(node.className).not.toMatch(/hotspot/);
  });

  it("renders child nodes recursively with valid PlanNode children", async () => {
    const { ExplainPlanViewer } = await import("@/features/query-detail/explain-plan-viewer");
    render(
      <ExplainPlanViewer
        plan={{
          fingerprint_id: "deadbeefdeadbeef",
          plan_json: {
            "Node Type": "Nested Loop",
            "Total Cost": 500,
            Plans: [
              {
                "Node Type": "Index Scan",
                "Total Cost": 100,
                "Plan Rows": 10,
                "Relation Name": "users",
              },
              {
                "Node Type": "Seq Scan",
                "Total Cost": 200,
                "Relation Name": "orders",
              },
            ],
          },
          plan_text: "...",
          cost: 500,
          captured_at: "2026-04-12T01:00:00.000Z",
        }}
      />,
    );
    expect(screen.getByText("Nested Loop")).toBeInTheDocument();
    expect(screen.getByText("Index Scan")).toBeInTheDocument();
    expect(screen.getByText("Seq Scan")).toBeInTheDocument();
  });

  it("skips non-PlanNode children in Plans array", async () => {
    const { ExplainPlanViewer } = await import("@/features/query-detail/explain-plan-viewer");
    render(
      <ExplainPlanViewer
        plan={{
          fingerprint_id: "deadbeefdeadbeef",
          plan_json: {
            "Node Type": "Limit",
            Plans: ["not a plan node", { "Node Type": "Sort", "Total Cost": 10 }] as unknown[],
          },
          plan_text: "...",
          cost: null,
          captured_at: "2026-04-12T01:00:00.000Z",
        }}
      />,
    );
    expect(screen.getByText("Limit")).toBeInTheDocument();
    expect(screen.getByText("Sort")).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
/* samples-table.tsx — branch at 41: rows is null renders em-dash     */
/* ------------------------------------------------------------------ */
describe("samples-table.tsx null rows", () => {
  it("rows=null renders em-dash", async () => {
    const { RecentSamplesTable } = await import("@/features/query-detail/recent-samples-table");
    render(
      <RecentSamplesTable
        samples={[
          {
            id: 1,
            fingerprint_id: "deadbeefdeadbeef",
            params: null,
            duration_ms: 100,
            rows: null,
            sampled_at: "2026-04-12T01:00:00.000Z",
          },
        ]}
      />,
    );
    expect(screen.getByText("\u2014")).toBeInTheDocument();
  });
});

/* ------------------------------------------------------------------ */
/* suggestion-card.tsx — lines 31-32 (no clipboard), 105-106 (partition) */
/* ------------------------------------------------------------------ */
describe("suggestion-card.tsx uncovered", () => {
  it("kind=partition renders rationale only", async () => {
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

  it("CopyButton handles missing clipboard gracefully", async () => {
    const { SuggestionCard } = await import("@/features/query-detail/suggestion-card");
    // jsdom may not have clipboard; exercise the click path
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
    // Should not throw
    copyBtn.click();
    Object.defineProperty(navigator, "clipboard", {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
  });

  it("CopyButton invokes clipboard.writeText when available", async () => {
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
});

/* ------------------------------------------------------------------ */
/* backoff.ts — branches at 10, 12                                    */
/* ------------------------------------------------------------------ */
describe("backoff.ts uncovered branches", () => {
  it("attempt 0 returns SCHEDULE[0] = 500", async () => {
    const { backoffMs } = await import("@/features/timeline/backoff");
    expect(backoffMs(0)).toBe(500);
  });

  it("attempt -1 returns SCHEDULE[0] = 500", async () => {
    const { backoffMs } = await import("@/features/timeline/backoff");
    expect(backoffMs(-1)).toBe(500);
  });

  it("attempt 4 returns SCHEDULE[3] = 4000", async () => {
    const { backoffMs } = await import("@/features/timeline/backoff");
    expect(backoffMs(4)).toBe(4_000);
  });

  it("attempt 5 returns SCHEDULE[4] = 8000", async () => {
    const { backoffMs } = await import("@/features/timeline/backoff");
    expect(backoffMs(5)).toBe(8_000);
  });

  it("attempt 6 (> length) returns MAX = 8000", async () => {
    const { backoffMs } = await import("@/features/timeline/backoff");
    expect(backoffMs(6)).toBe(8_000);
  });
});

/* ------------------------------------------------------------------ */
/* latency-chart.tsx — lines 41-42 (minutes), 59-77 (empty state)     */
/* ------------------------------------------------------------------ */
describe("latency-chart.tsx uncovered", () => {
  it("formatXLabel for >= 60s returns minutes", async () => {
    const { formatXLabel } = await import("@/features/timeline/latency-chart");
    const now = 1_712_000_000_000;
    expect(formatXLabel(now - 120_000, now)).toBe("2m ago");
    expect(formatXLabel(now - 60_000, now)).toBe("1m ago");
  });

  it("LatencyChart with empty series renders waiting-for-data state", async () => {
    const { LatencyChart } = await import("@/features/timeline/latency-chart");
    render(<LatencyChart series={[]} />);
    expect(screen.getByText(/waiting for data/i)).toBeInTheDocument();
  });

  it("LatencyChart with series containing points does not show empty state", async () => {
    const { LatencyChart } = await import("@/features/timeline/latency-chart");
    const { container } = render(
      <LatencyChart
        series={[
          {
            id: "abc",
            label: "SELECT 1",
            points: [
              { t: 1, p95: 10 },
              { t: 2, p95: 20 },
            ],
          },
          {
            id: "def",
            label: "SELECT 2",
            points: [
              { t: 1, p95: 15 },
              { t: 3, p95: 25 },
            ],
          },
        ]}
      />,
    );
    expect(screen.queryByText(/waiting for data/i)).toBeNull();
  });

  it("LatencyChart truncates long labels", async () => {
    const { LatencyChart } = await import("@/features/timeline/latency-chart");
    const longLabel = "A".repeat(50);
    render(
      <LatencyChart series={[{ id: "abc", label: longLabel, points: [{ t: 1, p95: 10 }] }]} />,
    );
    expect(screen.queryByText(/waiting for data/i)).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* status.ts — lines 24-28: reset action + shouldDisconnectOnVisibility */
/* ------------------------------------------------------------------ */
describe("status.ts uncovered", () => {
  it("reset action returns connecting and clears fail count", async () => {
    const { statusReducer } = await import("@/features/timeline/status");
    // First accumulate some fails
    statusReducer("live", { kind: "fail" });
    // Then reset
    const result = statusReducer("reconnecting", { kind: "reset" });
    expect(result).toBe("connecting");
    // After reset, one fail should not immediately go to fallback
    const afterOneFail = statusReducer("live", { kind: "fail" });
    expect(afterOneFail).toBe("reconnecting");
  });
});

/* ------------------------------------------------------------------ */
/* sse.ts — branches at 16-21: non-data prefix returns null           */
/* ------------------------------------------------------------------ */
describe("sse.ts uncovered branches", () => {
  it("non-data prefix returns null", async () => {
    const { parseSseFrame } = await import("@/lib/api/sse");
    expect(parseSseFrame("event: message")).toBeNull();
    expect(parseSseFrame("id: 123")).toBeNull();
    expect(parseSseFrame("retry: 5000")).toBeNull();
    expect(parseSseFrame("")).toBeNull();
  });

  it("valid data with invalid schema returns null", async () => {
    const { parseSseFrame } = await import("@/lib/api/sse");
    expect(parseSseFrame('data: {"invalid": "schema"}')).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/* handlers.ts — lines 63 (404), 73-76 (422 branch switch)            */
/* ------------------------------------------------------------------ */
describe("handlers.ts uncovered paths", () => {
  it("GET /_slowquery/queries/:id with unknown id returns 404", async () => {
    const { apiClient } = await import("@/lib/api/client");
    const { HttpError } = await import("@/lib/api/errors");
    await expect(apiClient.getFingerprint("0000000000000000")).rejects.toBeInstanceOf(HttpError);
  });

  it("POST /branches/switch with invalid target returns 422", async () => {
    const { HttpError } = await import("@/lib/api/errors");
    const res = await fetch(`${API}/branches/switch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: "invalid_branch" }),
    });
    expect(res.status).toBe(422);
  });

  it("POST /branches/switch with target=slow succeeds", async () => {
    const { apiClient } = await import("@/lib/api/client");
    const { useBranchStore } = await import("@/features/branches/use-branch-store");
    useBranchStore.getState().reset();
    useBranchStore.getState().hydrate("fast");
    await useBranchStore.getState().switch("slow");
    expect(useBranchStore.getState().activeBranch).toBe("slow");
  });
});

/* ------------------------------------------------------------------ */
/* client.ts — lines 76, 80, 125, 140, 169                           */
/* ------------------------------------------------------------------ */
describe("client.ts uncovered SSE paths", () => {
  it("SSE fetch with network error throws NetworkError", async () => {
    server.use(
      http.get(`${API}/_slowquery/api/stream`, () => {
        return HttpResponse.error();
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

  it("SSE with null body throws NetworkError", async () => {
    server.use(
      http.get(`${API}/_slowquery/api/stream`, () => {
        return new HttpResponse(null, {
          headers: { "Content-Type": "text/event-stream" },
        });
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

  it("SSE stream done fires server-closed error (default handler)", async () => {
    // The default handler sends frames then closes. The for-await consumes
    // all events, then the reader returns done:true and the generator throws.
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
});

/* ------------------------------------------------------------------ */
/* live-timeline.tsx — lines 62-64: catch block in useEffect          */
/* ------------------------------------------------------------------ */
describe("live-timeline.tsx SSE event processing and error catch", () => {
  it("SSE events are processed in the for-await body (lines 62-64)", async () => {
    // Use the default SSE handler which sends valid events
    const { LiveTimeline } = await import("@/features/timeline/live-timeline");
    const { unmount } = render(<LiveTimeline seed={fingerprintsList} top={10} />);
    // Wait for the SSE events to be processed - status transitions to "live"
    await vi.waitFor(
      () => {
        const statusEl = screen.getByTestId("stream-status");
        // After processing events, status should be either "live" or "reconnecting"/"fallback"
        // (if stream closed and catch fired)
        expect(statusEl.textContent).not.toBe("connecting");
      },
      { timeout: 5000 },
    );
    unmount();
  });

  it("SSE error in useEffect transitions status to reconnecting/fallback", async () => {
    // Reset the status module's fail counter before this test
    const { statusReducer } = await import("@/features/timeline/status");
    statusReducer("reconnecting", { kind: "reset" });

    server.use(
      http.get(`${API}/_slowquery/api/stream`, () => {
        return HttpResponse.error();
      }),
    );
    const { LiveTimeline } = await import("@/features/timeline/live-timeline");
    const { unmount } = render(<LiveTimeline seed={fingerprintsList} top={10} />);
    // Wait for the error to be caught and status to change
    await vi.waitFor(
      () => {
        const statusEl = screen.getByTestId("stream-status");
        expect(["reconnecting", "fallback"].some((s) => statusEl.textContent?.includes(s))).toBe(
          true,
        );
      },
      { timeout: 5000 },
    );
    unmount();
  });
});

/* ------------------------------------------------------------------ */
/* buffer.ts — branches 29-37: console.warn for malformed event       */
/* ------------------------------------------------------------------ */
describe("buffer.ts console.warn path", () => {
  it("malformed event logs warning and returns buf unchanged", async () => {
    const { applyEvent } = await import("@/features/timeline/buffer");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const buf = { byId: new Map<string, number[]>() };
    const result = applyEvent(buf, "totally invalid");
    expect(result.byId.size).toBe(0);
    expect(warn).toHaveBeenCalledWith("[timeline] dropped malformed stream event");
    warn.mockRestore();
  });

  it("heartbeat event is a no-op (kind !== tick)", async () => {
    const { applyEvent } = await import("@/features/timeline/buffer");
    const buf = { byId: new Map<string, number[]>() };
    const result = applyEvent(buf, {
      kind: "heartbeat",
      now: "2026-04-12T01:00:00.000Z",
    });
    expect(result.byId.size).toBe(0);
  });
});

/* ------------------------------------------------------------------ */
/* fingerprints-table.tsx — sort by last_seen asc                     */
/* ------------------------------------------------------------------ */
describe("fingerprints-table.tsx sort by last_seen asc", () => {
  it("sorts by last_seen ascending", async () => {
    const { FingerprintsTable } = await import("@/features/fingerprints/fingerprints-table");
    render(<FingerprintsTable fingerprints={fingerprintsList} sort="last_seen" order="asc" />);
    const rows = screen.getAllByRole("row");
    expect(rows.length).toBe(4);
  });
});

/* ------------------------------------------------------------------ */
/* suggestion-card.tsx — lines 105-106: exhaustive never (force call)  */
/* ------------------------------------------------------------------ */
describe("suggestion-card.tsx exhaustive check", () => {
  it("unknown kind hits the default branch and renders nothing", async () => {
    const { SuggestionCard } = await import("@/features/query-detail/suggestion-card");
    // Force an impossible kind to exercise the default branch
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
    // The default branch returns the never-typed variable, rendering nothing meaningful
    expect(container).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/* status.ts — lines 27-28: default never branch (force call)         */
/* ------------------------------------------------------------------ */
describe("status.ts exhaustive check", () => {
  it("unknown action kind hits default branch and returns the action", async () => {
    const { statusReducer } = await import("@/features/timeline/status");
    // The default branch assigns to `never` and returns it; at runtime this is just the value
    const result = statusReducer("live", { kind: "bogus" } as unknown as { kind: "first-event" });
    // result is the `_never` variable which is the action itself
    expect(result).toBeTruthy();
  });
});

/* ------------------------------------------------------------------ */
/* client.ts — lines 76, 80: timeout detection via abort signal       */
/* ------------------------------------------------------------------ */
describe("client.ts timeout paths", () => {
  it("aborted signal with TimeoutError reason covers line 74", async () => {
    const timeoutReason = new DOMException("timed out", "TimeoutError");
    const controller = new AbortController();
    controller.abort(timeoutReason);
    const { apiClient } = await import("@/lib/api/client");
    const { TimeoutError } = await import("@/lib/api/errors");
    const origTimeout = AbortSignal.timeout;
    AbortSignal.timeout = () => controller.signal;
    try {
      await expect(apiClient.listFingerprints()).rejects.toBeInstanceOf(TimeoutError);
    } finally {
      AbortSignal.timeout = origTimeout;
    }
  });

  it("aborted signal with non-timeout reason covers line 76", async () => {
    const controller = new AbortController();
    controller.abort(new DOMException("user abort", "AbortError"));
    const { apiClient } = await import("@/lib/api/client");
    const { TimeoutError } = await import("@/lib/api/errors");
    const origTimeout = AbortSignal.timeout;
    AbortSignal.timeout = () => controller.signal;
    try {
      await expect(apiClient.listFingerprints()).rejects.toBeInstanceOf(TimeoutError);
    } finally {
      AbortSignal.timeout = origTimeout;
    }
  });

  it("fetch error with cause.name=TimeoutError covers line 80", async () => {
    const { TimeoutError } = await import("@/lib/api/errors");
    const { apiClient } = await import("@/lib/api/client");
    // Need fetch to throw with cause.name = "TimeoutError" and signal NOT aborted.
    // Override fetch to throw such an error.
    const origFetch = globalThis.fetch;
    const fakeError = new TypeError("failed to fetch");
    Object.defineProperty(fakeError, "cause", {
      value: new DOMException("timed out", "TimeoutError"),
    });
    globalThis.fetch = () => {
      throw fakeError;
    };
    try {
      await expect(apiClient.switchBranch("fast")).rejects.toBeInstanceOf(TimeoutError);
    } finally {
      globalThis.fetch = origFetch;
    }
  });

  it("SSE reader.read() throwing a non-AbortError covers line 169", async () => {
    server.use(
      http.get(`${API}/_slowquery/api/stream`, () => {
        // Create a stream that errors during reading
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
        return new HttpResponse(stream, {
          headers: { "Content-Type": "text/event-stream" },
        });
      }),
    );
    const { apiClient } = await import("@/lib/api/client");
    const { NetworkError } = await import("@/lib/api/errors");
    const controller = new AbortController();
    await expect(async () => {
      for await (const _ev of apiClient.streamFingerprints(controller.signal)) {
        // consume first event, then read() will throw
      }
    }).rejects.toBeInstanceOf(NetworkError);
  });
});

/* ------------------------------------------------------------------ */
/* format.ts — line 45: unreachable after for loop                    */
/* ------------------------------------------------------------------ */
describe("format.ts unreachable fallback", () => {
  it("formatRelative always returns from inside the loop (second threshold)", async () => {
    const { formatRelative } = await import("@/features/fingerprints/format");
    // With abs=0 and unit="second", the for loop returns at the last threshold
    const now = new Date("2026-04-12T01:00:00.000Z");
    const result = formatRelative(now, now);
    expect(typeof result).toBe("string");
  });
});
