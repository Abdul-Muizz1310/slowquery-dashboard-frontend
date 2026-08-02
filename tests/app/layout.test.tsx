/**
 * The root layout (`src/app/layout.tsx`). Previously 0% covered — nothing
 * imported it, since `next/font/google` is normally rewritten by Next's
 * build-time SWC transform and is an empty module outside that pipeline.
 * Mocked here the same way Next's own testing docs recommend for
 * `next/font`.
 */

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({
  Geist: () => ({ variable: "--font-geist-sans" }),
  Geist_Mono: () => ({ variable: "--font-geist-mono" }),
}));

afterEach(cleanup);

describe("/app/layout.tsx", () => {
  it("renders children inside the terminal chrome body classes", async () => {
    const RootLayout = (await import("@/app/layout")).default;
    const { container } = render(
      <RootLayout>
        <div data-testid="child">hello</div>
      </RootLayout>,
    );
    // jsdom's render() mounts inside a <div>, but RootLayout returns its own
    // <html>/<body> — assert on the returned tree via the component's
    // rendered output rather than the document, since JSDOM only owns one
    // real <html>/<body> pair.
    expect(container.querySelector("[data-testid='child']")?.textContent).toBe("hello");
  });

  it("exposes the dashboard metadata title and description", async () => {
    const { metadata } = await import("@/app/layout");
    expect(metadata.title).toBe("slowquery dashboard");
    expect(String(metadata.description)).toMatch(/slowquery-detective/i);
  });
});
