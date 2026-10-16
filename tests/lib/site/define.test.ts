/**
 * Spec 06 — the site config, parsed once at module load.
 * Cases 1, 2, 12, 16, 19.
 */

import { describe, expect, it } from "vitest";
import { SITE } from "@/lib/site/config";
import { defineSite, NEVER_USE_HOSTS, SiteConfigError, type SiteInput } from "@/lib/site/define";

const valid: SiteInput = {
  name: "example",
  title: "example — a site that passes every check",
  description: "A description long enough for a search result and short enough not to be cut off.",
  url: "https://example-frontend.vercel.app",
  accent: "#f97316",
  keywords: ["example"],
  card: { comment: "a comment", headline: "catch slow queries.", highlight: "slow" },
  routes: { sitemap: ["/"], disallow: ["/api/"] },
};

type Case = [string, Record<string, unknown>, RegExp];

const rejects = (cases: Case[]) =>
  it.each(cases)("%s", (_why, patch, reason) => {
    const input = { ...valid, ...patch } as unknown as SiteInput;
    expect(() => defineSite(input)).toThrow(SiteConfigError);
    expect(() => defineSite(input)).toThrow(reason);
  });

describe("spec 06 — defineSite accepts", () => {
  it("case 1 happy: the real config, deriving its origin", () => {
    expect(SITE.url).toBe("https://slowquery-dashboard-frontend.vercel.app");
    expect(SITE.origin.href).toBe("https://slowquery-dashboard-frontend.vercel.app/");
    expect(Object.isFrozen(SITE)).toBe(true);
  });

  it("case 2 happy: a valid example config", () => {
    expect(defineSite(valid).origin.host).toBe("example-frontend.vercel.app");
  });

  it("case 12 edge: a description of exactly 160 characters (the real one is)", () => {
    expect(SITE.description).toHaveLength(160);
    expect(defineSite({ ...valid, description: "d".repeat(160) }).description).toHaveLength(160);
    expect(defineSite({ ...valid, description: "d".repeat(50) }).description).toHaveLength(50);
  });

  it("case 12 edge: a title of exactly 70 characters and a name of exactly 12", () => {
    expect(defineSite({ ...valid, title: "t".repeat(70), name: "n".repeat(12) }).name).toHaveLength(
      12,
    );
  });
});

describe("spec 06 — defineSite rejects (case 16 failure)", () => {
  rejects([
    ["a url that is not a URL", { url: "not a url" }, /not a URL/],
    ["an http origin", { url: "http://example-frontend.vercel.app" }, /https/],
    ["an origin with a path", { url: "https://example-frontend.vercel.app/app" }, /bare origin/],
    ["a trailing slash", { url: "https://example-frontend.vercel.app/" }, /bare origin/],
    ["an empty name", { name: "" }, /name/],
    ["a name over 12 characters", { name: "a-very-long-name" }, /name/],
    ["a title over 70 characters", { title: "t".repeat(71) }, /title/],
    ["a description under 50 characters", { description: "d".repeat(49) }, /description/],
    ["a description over 160 characters", { description: "d".repeat(161) }, /description/],
    ["an accent that is not #rrggbb", { accent: "#fff" }, /accent/],
    ["an empty highlight", { card: { ...valid.card, highlight: "" } }, /highlight/],
    [
      "a highlight missing from the headline",
      { card: { ...valid.card, highlight: "fast" } },
      /highlight/,
    ],
    ["a route without a leading slash", { routes: { sitemap: ["demo"], disallow: [] } }, /route/],
    [
      "a sitemap route that robots.txt disallows",
      { routes: { sitemap: ["/api/status"], disallow: ["/api/"] } },
      /disallow/,
    ],
  ]);
});

describe("spec 06 — never-use hosts (case 19 security)", () => {
  rejects(
    [...NEVER_USE_HOSTS].map((host): Case => [`${host}`, { url: `https://${host}` }, /never-use/]),
  );
});
