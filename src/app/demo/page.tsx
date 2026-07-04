/**
 * Spec 05 — /demo chromeless route.
 *
 * RSC shell that fetches the seed list once and hands off to
 * DemoPanel. robots: noindex,nofollow because this is a recording
 * surface, not crawlable content.
 */

import type { Metadata } from "next";
import { getCachedFingerprints } from "@/lib/api/cached";
import type { Fingerprint } from "@/lib/api/schemas";
import { DemoPanel } from "./demo-panel";

export const metadata: Metadata = {
  title: "slowquery dashboard demo",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function Page() {
  let seed: Fingerprint[] = [];
  let error: { kind: "http"; status: number; message: string } | undefined;
  try {
    seed = await getCachedFingerprints();
  } catch (err) {
    error = { kind: "http", status: 500, message: (err as Error).message };
  }
  return <DemoPanel fingerprints={seed} error={error} />;
}
