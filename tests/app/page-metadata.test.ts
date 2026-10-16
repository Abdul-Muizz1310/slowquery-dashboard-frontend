/**
 * Spec 06 — each page's own metadata, as the template renders it.
 * Cases 11, 15, 18, 20.
 */

import type { Metadata } from "next";
import { afterEach, describe, expect, it } from "vitest";
import { SITE } from "@/lib/site/config";
import { server } from "../mocks/server";

const queryMetadata = async (id: string): Promise<Metadata> => {
  const { generateMetadata } = await import("@/app/queries/[id]/page");
  return generateMetadata({ params: Promise.resolve({ id }) });
};

const pages = async (): Promise<Record<string, Metadata>> => ({
  "/": (await import("@/app/page")).metadata,
  "/timeline": (await import("@/app/timeline/page")).metadata,
  "/demo": (await import("@/app/demo/page")).metadata,
  "/queries/[id]": await queryMetadata("c168fc78a2e7d01c"),
});

const requests: string[] = [];
const onRequest = ({ request }: { request: Request }) => {
  requests.push(request.url);
};

afterEach(() => {
  server.events.removeListener("request:start", onRequest);
  requests.length = 0;
});

describe("spec 06 — page titles", () => {
  it("case 11 happy: the home page keeps the default title and sets the only canonical", async () => {
    expect((await import("@/app/page")).metadata).toEqual({ alternates: { canonical: "/" } });
  });

  it("case 11 happy: /timeline is titled by its h1", async () => {
    expect((await import("@/app/timeline/page")).metadata.title).toBe("live p95 timeline");
  });

  it("case 11 happy: /demo is titled by its nav label, without the old site suffix", async () => {
    expect((await import("@/app/demo/page")).metadata.title).toBe("demo");
  });

  it("case 11 happy: /queries/[id] is titled by the first 8 characters of the id", async () => {
    expect((await queryMetadata("c168fc78a2e7d01c")).title).toBe("query c168fc78");
  });
});

describe("spec 06 — page metadata never overrides the root's share tags", () => {
  it("case 15 edge: no page sets openGraph or twitter; only the home page sets alternates", async () => {
    for (const [route, metadata] of Object.entries(await pages())) {
      expect(metadata, route).not.toHaveProperty("openGraph");
      expect(metadata, route).not.toHaveProperty("twitter");
      if (route !== "/") expect(metadata, route).not.toHaveProperty("alternates");
    }
  });
});

describe("spec 06 — /queries/[id] metadata", () => {
  it("case 18 failure: makes no request, so a cold backend cannot delay the head", async () => {
    server.events.on("request:start", onRequest);
    await queryMetadata("c168fc78a2e7d01c");
    expect(requests).toEqual([]);
  });

  it("case 18 failure: titles an id the page will 404 on, without validating it", async () => {
    server.events.on("request:start", onRequest);
    expect((await queryMetadata("not-a-hex-id")).title).toBe("query not-a-he");
    expect(requests).toEqual([]);
  });
});

describe("spec 06 — indexing", () => {
  it("case 20 security: only /demo is noindex (spec 05); the dashboard pages are indexable", async () => {
    const robots = Object.fromEntries(
      Object.entries(await pages()).map(([route, metadata]) => [route, metadata.robots]),
    );
    expect(robots).toEqual({
      "/": undefined,
      "/timeline": undefined,
      "/demo": { index: false, follow: false },
      "/queries/[id]": undefined,
    });
  });

  it("case 8 failure: no sitemap route is a noindex page", async () => {
    const all = await pages();
    for (const route of SITE.routes.sitemap) {
      expect(all[route]?.robots, route).not.toMatchObject({ index: false });
    }
  });
});
