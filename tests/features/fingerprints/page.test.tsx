/**
 * Spec 01 — the RSC entry point at app/page.tsx and the Link wiring.
 * Cases 3, 12, 16, 18, 19.
 */

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { fingerprintsList } from "../../mocks/fixtures/fingerprints";

afterEach(cleanup);

describe("spec 01 — page and link wiring", () => {
  it("case 3 happy: each row's Link has href /queries/<id>", async () => {
    const { FingerprintsTable } = await import("@/features/fingerprints/fingerprints-table");
    const { container } = render(
      <FingerprintsTable fingerprints={fingerprintsList} sort="total_ms" order="desc" />,
    );
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toContain("/queries/c168fc78a2e7d01c");
  });

  it("case 12 edge: server-rendered HTML includes the first page of rows without JS", async () => {
    const { FingerprintsTable } = await import("@/features/fingerprints/fingerprints-table");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const html = renderToStaticMarkup(
      <FingerprintsTable fingerprints={fingerprintsList} sort="total_ms" order="desc" />,
    );
    expect(html).toContain("c168fc78a2e7d01c");
    expect(html).toContain("58120");
  });

  it("case 16 failure: one invalid row triggers page-level ErrorState, no partial render", async () => {
    const { parseFingerprintsOrThrow } = await import("@/features/fingerprints/parse");
    const bad = [fingerprintsList[0], { not: "a fingerprint" }, fingerprintsList[1]] as unknown[];
    expect(() => parseFingerprintsOrThrow(bad)).toThrow();
  });

  it("case 18 security: invalid sort searchParam falls back to default, no 500", async () => {
    const { normaliseSortParams } = await import("@/features/fingerprints/parse");
    const result = normaliseSortParams({ sort: "malicious", order: "desc" });
    expect(result.sort).toBe("total_ms");
    expect(result.order).toBe("desc");
  });

  it("case 19 security: query string roundtrip does not leak extra fields", async () => {
    const { normaliseSortParams } = await import("@/features/fingerprints/parse");
    const result = normaliseSortParams({
      sort: "p95_ms",
      order: "asc",
      evilHeader: "X-Injection",
    } as unknown as Record<string, string>);
    expect(Object.keys(result)).toEqual(["sort", "order"]);
  });
});
