/**
 * Spec 06 — the icon files Next serves from src/app/.
 * Case 9.
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SITE } from "@/lib/site/config";
import { icoSizes, pngSize } from "./image-headers";

describe("spec 06 — icon files", () => {
  it("case 9 happy: draws the nav's glyph in the site's accent", () => {
    const svg = readFileSync("src/app/icon.svg", "utf8");
    expect(svg).toContain('viewBox="0 0 64 64"');
    expect(svg).toContain(`stroke="${SITE.accent}"`);
    expect(svg).toContain('d="M8 2v12M4 6l4-4 4 4M3 10h10"');
  });

  it("case 9 happy: packs 16, 32 and 48 px frames into favicon.ico", () => {
    expect(icoSizes(readFileSync("src/app/favicon.ico"))).toEqual([16, 32, 48]);
  });

  it("case 9 happy: ships a 180 px apple touch icon", () => {
    expect(pngSize(readFileSync("src/app/apple-icon.png"))).toBe("180x180");
  });
});
