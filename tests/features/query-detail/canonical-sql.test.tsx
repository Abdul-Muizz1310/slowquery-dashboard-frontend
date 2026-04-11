/**
 * Spec 02 — CanonicalSql Monaco viewer.
 * Cases 1 (SSR fallback), 8, 9 (unicode + escape), 18 (Monaco readOnly), 22 (readOnly asserted).
 */

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

describe("spec 02 — CanonicalSql", () => {
  it("case 1 happy: SSR fallback <pre> contains the full SQL in server HTML", async () => {
    const { CanonicalSql } = await import("@/features/query-detail/canonical-sql");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const html = renderToStaticMarkup(<CanonicalSql sql={"SELECT id, user_id\nFROM orders"} />);
    expect(html).toContain("SELECT id, user_id");
    expect(html).toContain("FROM orders");
  });

  it("case 8 edge: multi-byte unicode in canonical sql renders correctly in SSR fallback", async () => {
    const { CanonicalSql } = await import("@/features/query-detail/canonical-sql");
    const { container } = render(<CanonicalSql sql={'SELECT "café" FROM tåble'} />);
    expect(container.textContent).toContain("café");
    expect(container.textContent).toContain("tåble");
  });

  it("case 9 edge: embedded </pre> is escaped by React, not interpreted", async () => {
    const { CanonicalSql } = await import("@/features/query-detail/canonical-sql");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const html = renderToStaticMarkup(<CanonicalSql sql={"SELECT 1 -- </pre> comment"} />);
    // The fallback <pre> still wraps a single text node; the embedded </pre>
    // must be escaped as &lt;/pre&gt; in the server HTML.
    expect(html).toContain("&lt;/pre&gt;");
  });

  it("case 18 / 22 security: Monaco is mounted with readOnly: true", async () => {
    const { MONACO_OPTIONS } = await import("@/features/query-detail/canonical-sql");
    expect(MONACO_OPTIONS.readOnly).toBe(true);
  });
});
