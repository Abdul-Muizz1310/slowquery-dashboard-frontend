/**
 * Spec 06 — the root head, built from the site config.
 * Cases 3, 4, 5.
 */

import { describe, expect, it } from "vitest";
import { SITE } from "@/lib/site/config";
import { SiteConfigError } from "@/lib/site/define";
import { pageMetadata, ROOT_VIEWPORT, rootMetadata } from "@/lib/site/metadata";

describe("spec 06 — root metadata", () => {
  const metadata = rootMetadata(SITE);

  it("case 3 happy: resolves every relative URL against the production origin", () => {
    expect(String(metadata.metadataBase)).toBe("https://slowquery-dashboard-frontend.vercel.app/");
  });

  it("case 3 happy: has a default title and a template that names the site", () => {
    expect(metadata.title).toEqual({ default: SITE.title, template: "%s — slowquery" });
  });

  it("case 3 happy: describes the site and credits its author", () => {
    expect(metadata.description).toBe(SITE.description);
    expect(metadata.applicationName).toBe("slowquery");
    expect(metadata.authors).toEqual([
      { name: "Abdul-Muizz Anwar", url: "https://github.com/Abdul-Muizz1310" },
    ]);
    expect(metadata.keywords).toEqual(SITE.keywords);
  });

  it("case 3 happy: names the home-screen app and keeps the iOS status bar dark", () => {
    expect(metadata.appleWebApp).toEqual({ title: "slowquery", statusBarStyle: "black" });
  });

  it("case 3 happy: stops iOS turning numbers into phone links", () => {
    expect(metadata.formatDetection).toEqual({ telephone: false, email: false, address: false });
  });

  it("case 4 happy: leaves the Open Graph title, description and url to each page", () => {
    expect(metadata.openGraph).toEqual({ type: "website", siteName: "slowquery", locale: "en_US" });
  });

  it("case 4 happy: asks for the large Twitter card and lets Next fill the rest", () => {
    expect(metadata.twitter).toEqual({ card: "summary_large_image" });
  });

  it("case 4 happy: sets no canonical at the root, so no page claims to be the home page", () => {
    expect(metadata).not.toHaveProperty("alternates");
  });
});

describe("spec 06 — viewport", () => {
  it("case 5 happy: paints the browser chrome in the page background, dark scheme", () => {
    expect(ROOT_VIEWPORT).toEqual({ themeColor: "#0a0a0a", colorScheme: "dark" });
  });
});

describe("spec 06 — an indexable page's metadata (cases 25, 26)", () => {
  const description =
    "A description long enough for a search result and short enough not to be cut.";

  it("carries the page's title and description, and names the page itself as canonical", () => {
    expect(pageMetadata(SITE, "/x", { title: "x", description })).toEqual({
      title: "x",
      description,
      alternates: { canonical: "/x" },
    });
  });

  it("accepts a title the template takes to exactly 70 characters", () => {
    const title = "t".repeat(70 - " — slowquery".length);
    expect(pageMetadata(SITE, "/x", { title, description }).title).toBe(title);
  });

  it.each([50, 160])("accepts a description of exactly %i characters", (length) => {
    const exact = "d".repeat(length);
    expect(pageMetadata(SITE, "/x", { title: "x", description: exact }).description).toBe(exact);
  });

  const cases: [string, { title: string; description: string }, RegExp][] = [
    ["an empty title", { title: "", description }, /title/],
    [
      "a title the template takes past 70 characters",
      { title: "t".repeat(71 - " — slowquery".length), description },
      /title/,
    ],
    [
      "a description under 50 characters",
      { title: "x", description: "d".repeat(49) },
      /description/,
    ],
    [
      "a description over 160 characters",
      { title: "x", description: "d".repeat(161) },
      /description/,
    ],
  ];

  it.each(cases)("rejects %s, naming the page and the reason", (_why, page, reason) => {
    expect(() => pageMetadata(SITE, "/x", page)).toThrow(SiteConfigError);
    expect(() => pageMetadata(SITE, "/x", page)).toThrow(reason);
    expect(() => pageMetadata(SITE, "/x", page)).toThrow(/\/x/);
  });
});
