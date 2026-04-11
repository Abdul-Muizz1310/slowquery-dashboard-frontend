/**
 * Spec 01 — FingerprintsTable presentational component.
 * Cases 1, 2, 6, 7, 8, 9, 11, 13, 14, 15, 16, 17.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fingerprintsList } from "../../mocks/fixtures/fingerprints";

afterEach(cleanup);

describe("spec 01 — FingerprintsTable", () => {
  it("case 1 happy: 3 rows sorted by total_ms desc by default", async () => {
    const { FingerprintsTable } = await import("@/features/fingerprints/fingerprints-table");
    render(<FingerprintsTable fingerprints={fingerprintsList} sort="total_ms" order="desc" />);
    const rows = screen.getAllByRole("row");
    // header + 3 data rows
    expect(rows.length).toBe(4);
    const firstDataRow = rows[1];
    expect(firstDataRow?.textContent).toContain("58120");
  });

  it("case 2 happy: clicking p95_ms header rewrites sort param", async () => {
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
    header.click();
    expect(onChange).toHaveBeenCalledWith({ sort: "p95_ms", order: "desc" });
  });

  it("case 6 edge: empty list renders EmptyState with copy", async () => {
    const { FingerprintsTable } = await import("@/features/fingerprints/fingerprints-table");
    render(<FingerprintsTable fingerprints={[]} sort="total_ms" order="desc" />);
    expect(screen.getByText(/no fingerprints captured yet/i)).toBeInTheDocument();
  });

  it("case 7 edge: p95_ms null renders as em-dash not NaNms", async () => {
    const { FingerprintsTable } = await import("@/features/fingerprints/fingerprints-table");
    render(
      <FingerprintsTable
        fingerprints={[{ ...fingerprintsList[0]!, p95_ms: null }]}
        sort="total_ms"
        order="desc"
      />,
    );
    expect(screen.queryByText(/NaN/)).toBeNull();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("case 8 edge: relative timestamps render with RelativeTimeFormat", async () => {
    const { formatRelative } = await import("@/features/fingerprints/format");
    const past = new Date(Date.now() - 8_000);
    expect(formatRelative(past)).toMatch(/8 seconds? ago/i);
  });

  it("case 9 edge: call_count 1_234_567 renders as 1.2M", async () => {
    const { formatCount } = await import("@/features/fingerprints/format");
    expect(formatCount(1_234_567)).toBe("1.2M");
  });

  it("case 11 edge: sort flip from desc to asc on re-click", async () => {
    const { SortHeader } = await import("@/features/fingerprints/sort-header");
    const onChange = vi.fn();
    render(
      <table>
        <thead>
          <tr>
            <SortHeader field="p95_ms" currentSort="p95_ms" currentOrder="desc" onChange={onChange}>
              p95
            </SortHeader>
          </tr>
        </thead>
      </table>,
    );
    screen.getByRole("columnheader", { name: /p95/i }).click();
    expect(onChange).toHaveBeenCalledWith({ sort: "p95_ms", order: "asc" });
  });

  it("case 13 failure: HttpError(500) renders ErrorState with retry", async () => {
    const { ErrorState } = await import("@/features/fingerprints/error-state");
    const { HttpError } = await import("@/lib/api/errors");
    render(<ErrorState error={new HttpError(500, "boom")} />);
    expect(screen.getByText(/500/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /retry/i })).toBeInTheDocument();
  });

  it("case 14 failure: TimeoutError renders 'Backend timed out'", async () => {
    const { ErrorState } = await import("@/features/fingerprints/error-state");
    const { TimeoutError } = await import("@/lib/api/errors");
    render(<ErrorState error={new TimeoutError("timeout")} />);
    expect(screen.getByText(/timed out/i)).toBeInTheDocument();
  });

  it("case 15 failure: ParseError renders malformed-response copy", async () => {
    const { ErrorState } = await import("@/features/fingerprints/error-state");
    const { ParseError } = await import("@/lib/api/errors");
    render(<ErrorState error={new ParseError("bad shape", "suggestions[0].kind")} />);
    expect(screen.getByText(/malformed/i)).toBeInTheDocument();
  });

  it("case 17 security: fingerprint text with <script> renders as literal text", async () => {
    const { FingerprintsTable } = await import("@/features/fingerprints/fingerprints-table");
    const hostile = {
      ...fingerprintsList[0]!,
      fingerprint: "<script>alert(1)</script>",
    };
    const { container } = render(
      <FingerprintsTable fingerprints={[hostile]} sort="total_ms" order="desc" />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
  });
});
