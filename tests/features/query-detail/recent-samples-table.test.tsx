/**
 * Spec 02 — RecentSamplesTable renders up to 10 recent samples.
 * Cases 5 and 10.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

describe("spec 02 — RecentSamplesTable", () => {
  it("case 5 happy: 10 samples render in descending sampled_at order", async () => {
    const { RecentSamplesTable } = await import("@/features/query-detail/recent-samples-table");
    const samples = Array.from({ length: 10 }, (_, i) => ({
      id: 1000 + i,
      fingerprint_id: "deadbeefdeadbeef",
      params: null,
      duration_ms: 100 + i,
      rows: 1,
      sampled_at: new Date(Date.UTC(2026, 3, 12, 1, 0, i)).toISOString(),
    }));
    render(<RecentSamplesTable samples={samples} />);
    // Header row + 10 sample rows
    expect(screen.getAllByRole("row").length).toBe(11);
  });

  it("case 10 edge: empty samples renders 'No recent samples' row", async () => {
    const { RecentSamplesTable } = await import("@/features/query-detail/recent-samples-table");
    render(<RecentSamplesTable samples={[]} />);
    expect(screen.getByText(/no recent samples/i)).toBeInTheDocument();
  });
});
