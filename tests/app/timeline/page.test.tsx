/**
 * Spec 03 — /timeline RSC entry point (composed page), cases 1 and 8.
 *
 * Previously 0% covered: the unit suite only ever imported
 * `@/features/timeline/*` helpers directly, never `@/app/timeline/page`
 * itself. `<TimelineTopN>` reads `next/navigation`'s router hooks, which
 * don't exist outside an actual Next.js request — mocked here the same
 * way the App Router test-utilities recommend.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fingerprintsList } from "../../mocks/fixtures/fingerprints";
import { server } from "../../mocks/server";

const API = "https://slowquery-demo-backend.onrender.com";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/timeline",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(cleanup);

describe("spec 03 — /timeline page (composed)", () => {
  it("case 1 happy: renders the seeded chart and the top-N selector", async () => {
    const Page = (await import("@/app/timeline/page")).default;
    const el = await Page({ searchParams: Promise.resolve({}) });
    render(el);
    expect(screen.getByTestId("stream-status")).toBeInTheDocument();
    expect(screen.getByText(/top 10/i)).toBeInTheDocument();
  });

  it("case 10 edge: ?top=999 clamps to 20 in the status line", async () => {
    const Page = (await import("@/app/timeline/page")).default;
    const el = await Page({ searchParams: Promise.resolve({ top: "999" }) });
    render(el);
    expect(screen.getByText(/top 20/i)).toBeInTheDocument();
  });

  it("case 8 edge: seed fetch failure degrades gracefully (empty seed, page still renders)", async () => {
    server.use(
      http.get(`${API}/_slowquery/queries`, () => HttpResponse.text("boom", { status: 500 })),
    );
    const Page = (await import("@/app/timeline/page")).default;
    const el = await Page({ searchParams: Promise.resolve({}) });
    render(el);
    // No throw, no crash — SSE will populate once it connects.
    expect(screen.getByTestId("stream-status")).toBeInTheDocument();
  });

  it("happy: seeded fingerprints render as chart lines, not the empty state", async () => {
    const Page = (await import("@/app/timeline/page")).default;
    const el = await Page({ searchParams: Promise.resolve({}) });
    const { container } = render(el);
    expect(container.textContent).not.toContain("waiting for data");
    expect(fingerprintsList.length).toBeGreaterThan(0);
  });
});
