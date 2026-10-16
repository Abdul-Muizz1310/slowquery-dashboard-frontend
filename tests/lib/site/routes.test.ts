/**
 * Spec 06 — the manifest, robots.txt and sitemap.xml routes.
 * Cases 6, 7, 8, 20.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { SITE } from "@/lib/site/config";
import { defineSite } from "@/lib/site/define";
import { robotsFile } from "@/lib/site/metadata";
import { pngSize } from "./image-headers";

describe("spec 06 — manifest", () => {
  const m = manifest();

  it("case 6 happy: names the site and opens at the home page in the dark colours", () => {
    expect(m).toMatchObject({
      name: "slowquery",
      short_name: "slowquery",
      description: SITE.description,
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#0a0a0a",
      theme_color: "#0a0a0a",
    });
  });

  it("case 6 happy: lists any-purpose 192 and 512 icons and a maskable 512", () => {
    expect(m.icons?.map((i) => `${i.sizes} ${i.purpose}`)).toEqual([
      "192x192 any",
      "512x512 any",
      "512x512 maskable",
    ]);
  });

  it.each(m.icons ?? [])("case 6 happy: $src exists in public/ at $sizes", (icon) => {
    expect(pngSize(readFileSync(join("public", icon.src)))).toBe(icon.sizes);
  });
});

describe("spec 06 — robots and sitemap", () => {
  it("case 7 happy: allows the whole site and names the sitemap on the origin", () => {
    expect(robots()).toEqual({
      rules: [{ userAgent: "*", allow: "/" }],
      sitemap: "https://slowquery-dashboard-frontend.vercel.app/sitemap.xml",
    });
  });

  it("case 7 happy: disallows the machine endpoints a site declares", () => {
    const site = defineSite({ ...SITE, routes: { sitemap: ["/"], disallow: ["/api/", "/auth/"] } });
    expect(robotsFile(site).rules).toEqual([
      { userAgent: "*", allow: "/", disallow: ["/api/", "/auth/"] },
    ]);
  });

  it("case 8 happy: lists the sitemap routes, as absolute URLs, once each", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toEqual([
      "https://slowquery-dashboard-frontend.vercel.app/",
      "https://slowquery-dashboard-frontend.vercel.app/timeline",
    ]);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("case 20 security: robots.txt disallows nothing, so every shared link still previews", () => {
    const rules = [robots().rules].flat();
    expect(rules.every((rule) => rule.disallow === undefined)).toBe(true);
  });
});
