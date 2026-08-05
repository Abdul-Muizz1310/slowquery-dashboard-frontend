import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Packages that must move in lockstep.
 *
 * Both of these are pinned exactly in package.json, and dependabot opens one PR
 * per package by default — so it will happily raise one half of a pair and leave
 * the other behind. Neither resulting failure names the real cause:
 *
 * - react 19.2.8 against react-dom 19.2.4 broke all 19 component suites, because
 *   react-dom reaches into react internals that are only guaranteed to match
 *   within an exact version.
 * - @playwright/test 1.62.0 against playwright 1.59.1 produced "Playwright Test
 *   did not expect test() to be called here" and then "No tests found" — the
 *   runner and the test file had each loaded a different copy.
 *
 * `.github/dependabot.yml` groups each family so they are raised together. This
 * asserts the property that grouping is there to preserve, so a split still
 * fails by name if it arrives another way — a hand edit, or a group that stops
 * matching after a rename.
 */

const LOCKSTEP_FAMILIES: ReadonlyArray<readonly string[]> = [
  ["react", "react-dom"],
  ["@types/react", "@types/react-dom"],
  ["playwright", "@playwright/test"],
];

const repoRoot = resolve(__dirname, "..");

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const pkg = JSON.parse(readFileSync(resolve(repoRoot, "package.json"), "utf8")) as PackageJson;
const declared: Record<string, string> = { ...pkg.dependencies, ...pkg.devDependencies };

describe("version-locked dependency families", () => {
  it.each(
    LOCKSTEP_FAMILIES.map((family) => [family.join(" + "), family] as const),
  )("%s declare the same version range", (_label, family) => {
    const present = family.filter((name) => declared[name] !== undefined);
    // Only assert on families this project actually declares; a family that is
    // absent entirely is not a violation.
    if (present.length === 0) return;
    expect(present, `${family.join(" and ")} must be declared together`).toHaveLength(
      family.length,
    );

    const ranges = new Set(present.map((name) => declared[name]));
    expect(
      ranges.size,
      `${present.map((n) => `${n}@${declared[n]}`).join(", ")} must all declare the same ` +
        "range — a split version in this family fails in a way that never names the cause",
    ).toBe(1);
  });
});
