/**
 * Spec 02 — CanonicalSql viewer.
 * Cases 1 (server-rendered <pre>), 8, 9 (unicode + escape).
 *
 * The Monaco readOnly cases (18/22) were deleted with the editor itself:
 * it was mounted in a permanently hidden div and never visible (audit
 * OPT-1). The visible, XSS-safe <pre> is the only SQL surface now.
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
    // The <pre> wraps a single text node; the embedded </pre>
    // must be escaped as &lt;/pre&gt; in the server HTML.
    expect(html).toContain("&lt;/pre&gt;");
  });
});
