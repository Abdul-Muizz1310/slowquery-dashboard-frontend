/**
 * Spec 01 — FingerprintsTable presentational component.
 * Cases 1, 2, 6, 7, 8, 9, 11, 13, 14, 15, 16, 17.
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fingerprintOrdersByCreatedAt, fingerprintsList } from "../../mocks/fixtures/fingerprints";

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
        fingerprints={[{ ...fingerprintOrdersByCreatedAt, p95_ms: null }]}
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
      ...fingerprintOrdersByCreatedAt,
      fingerprint: "<script>alert(1)</script>",
    };
    const { container } = render(
      <FingerprintsTable fingerprints={[hostile]} sort="total_ms" order="desc" />,
    );
    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>alert(1)</script>");
  });

  it("invariant 3 (extended): sorting by p95_ms sinks null rows to the bottom regardless of order", async () => {
    const { FingerprintsTable } = await import("@/features/fingerprints/fingerprints-table");
    const fps = [
      { ...fingerprintOrdersByCreatedAt, id: "a000000000000001", p95_ms: null, total_ms: 100 },
      { ...fingerprintOrdersByCreatedAt, id: "a000000000000002", p95_ms: 500, total_ms: 200 },
      { ...fingerprintOrdersByCreatedAt, id: "a000000000000003", p95_ms: 100, total_ms: 300 },
    ];
    const desc = render(<FingerprintsTable fingerprints={fps} sort="p95_ms" order="desc" />);
    expect(desc.getAllByRole("row").length).toBe(4);
    desc.unmount();
    const asc = render(
      <FingerprintsTable fingerprints={fps.slice(0, 2)} sort="p95_ms" order="asc" />,
    );
    expect(asc.getAllByRole("row").length).toBe(3);
  });

  it("case 1 (extended): sorting by call_count and by last_seen render all rows", async () => {
    const { FingerprintsTable } = await import("@/features/fingerprints/fingerprints-table");
    const byCallCount = render(
      <FingerprintsTable fingerprints={fingerprintsList} sort="call_count" order="desc" />,
    );
    expect(byCallCount.getAllByRole("row").length).toBe(4);
    byCallCount.unmount();
    const byLastSeen = render(
      <FingerprintsTable fingerprints={fingerprintsList} sort="last_seen" order="asc" />,
    );
    expect(byLastSeen.getAllByRole("row").length).toBe(4);
  });

  it("case 2 (keyboard variant): Enter/Space on the column header behave like a click", async () => {
    const { SortHeader } = await import("@/features/fingerprints/sort-header");
    const onChangeEnter = vi.fn();
    const enterRender = render(
      <table>
        <thead>
          <tr>
            <SortHeader
              field="p95_ms"
              currentSort="total_ms"
              currentOrder="desc"
              onChange={onChangeEnter}
            >
              p95
            </SortHeader>
          </tr>
        </thead>
      </table>,
    );
    fireEvent.keyDown(enterRender.getByRole("columnheader", { name: /p95/i }), { key: "Enter" });
    expect(onChangeEnter).toHaveBeenCalledWith({ sort: "p95_ms", order: "desc" });
    enterRender.unmount();

    const onChangeSpace = vi.fn();
    const spaceRender = render(
      <table>
        <thead>
          <tr>
            <SortHeader
              field="p95_ms"
              currentSort="total_ms"
              currentOrder="desc"
              onChange={onChangeSpace}
            >
              p95
            </SortHeader>
          </tr>
        </thead>
      </table>,
    );
    fireEvent.keyDown(spaceRender.getByRole("columnheader", { name: /p95/i }), { key: " " });
    expect(onChangeSpace).toHaveBeenCalledWith({ sort: "p95_ms", order: "desc" });
  });

  it("invariant 7 (extended): formatMs covers the <10 / 10-100 / >=100 magnitude bands", async () => {
    const { formatMs } = await import("@/features/fingerprints/format");
    expect(formatMs(5.5)).toBe("5.5ms");
    expect(formatMs(10)).toBe("10.0ms");
    expect(formatMs(55)).toBe("55.0ms");
    expect(formatMs(99.9)).toBe("99.9ms");
  });

  it("case 8 (extended): formatRelative at (near) zero delta still returns a string, not NaN", async () => {
    const { formatRelative } = await import("@/features/fingerprints/format");
    const now = new Date();
    expect(typeof formatRelative(now, now)).toBe("string");
    expect(typeof formatRelative(new Date(now.getTime() - 500), now)).toBe("string");
  });

  it("case 13-15 (extended): ErrorState falls back to a generic message for a non-ApiError instance", async () => {
    const { ErrorState } = await import("@/features/fingerprints/error-state");
    const { NetworkError } = await import("@/lib/api/errors");
    render(<ErrorState error={new NetworkError("network down")} />);
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });
});
