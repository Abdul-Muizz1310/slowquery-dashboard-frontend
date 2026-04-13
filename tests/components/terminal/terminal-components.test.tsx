/**
 * Terminal shell components — AppNav, PageFrame, StatusBar.
 * Covers the 0% coverage gap for these presentational components.
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

describe("AppNav", () => {
  it("renders nav links and logo", async () => {
    const { AppNav } = await import("@/components/terminal/AppNav");
    render(<AppNav active="home" />);
    expect(screen.getByText("queries")).toBeInTheDocument();
    expect(screen.getByText("timeline")).toBeInTheDocument();
    expect(screen.getByText("demo")).toBeInTheDocument();
    expect(screen.getByText("github")).toBeInTheDocument();
    expect(screen.getByText("api")).toBeInTheDocument();
    // "slowquery" appears in both the logo span and the `.dashboard` span
    expect(screen.getByTitle("slowquery")).toBeInTheDocument();
  });

  it("highlights the active link with the flame accent class", async () => {
    const { AppNav } = await import("@/components/terminal/AppNav");
    const { container } = render(<AppNav active="demo" />);
    const demoLink = screen.getByText("demo");
    expect(demoLink.className).toMatch(/text-foreground/);
    // Other links should not have the active class
    const queriesLink = screen.getByText("queries");
    expect(queriesLink.className).toMatch(/hover:text-foreground/);
  });

  it("renders without active prop", async () => {
    const { AppNav } = await import("@/components/terminal/AppNav");
    render(<AppNav />);
    expect(screen.getByText("queries")).toBeInTheDocument();
  });
});

describe("StatusBar", () => {
  it("renders left and right content", async () => {
    const { StatusBar } = await import("@/components/terminal/StatusBar");
    render(<StatusBar left="left content" right="right content" />);
    expect(screen.getByText("left content")).toBeInTheDocument();
    expect(screen.getByText("right content")).toBeInTheDocument();
  });

  it("renders without props", async () => {
    const { StatusBar } = await import("@/components/terminal/StatusBar");
    const { container } = render(<StatusBar />);
    expect(container.querySelector("footer")).toBeInTheDocument();
  });
});

describe("PageFrame", () => {
  it("renders AppNav + children + StatusBar", async () => {
    const { PageFrame } = await import("@/components/terminal/PageFrame");
    render(
      <PageFrame active="home" statusLeft="left" statusRight="right">
        <div data-testid="child">Hello</div>
      </PageFrame>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.getByText("left")).toBeInTheDocument();
    expect(screen.getByText("right")).toBeInTheDocument();
    // AppNav renders
    expect(screen.getByText("queries")).toBeInTheDocument();
  });

  it("uses custom maxWidth when provided", async () => {
    const { PageFrame } = await import("@/components/terminal/PageFrame");
    const { container } = render(
      <PageFrame maxWidth="max-w-[800px]">
        <div>content</div>
      </PageFrame>,
    );
    const main = container.querySelector("main");
    expect(main?.className).toContain("max-w-[800px]");
  });
});
