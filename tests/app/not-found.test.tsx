/**
 * The global 404 route (`src/app/not-found.tsx`). Not tied to a numbered
 * spec — it's shared chrome, not a feature module — but it was previously
 * 0% covered (no test anywhere imported `@/app/not-found`).
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

describe("/app/not-found.tsx", () => {
  it("renders the 404 message with a link back to the fingerprints table", async () => {
    const NotFound = (await import("@/app/not-found")).default;
    render(<NotFound />);
    // "404" appears both as the TerminalWindow title and the big numeral.
    expect(screen.getAllByText("404").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/this page could not be found/i)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /back to fingerprints/i });
    expect(link.getAttribute("href")).toBe("/");
  });
});
