/**
 * Spec 05 — /demo chromeless route.
 *
 * RSC shell that fetches the seed list once and hands off to
 * DemoPanel. robots: noindex,nofollow because this is a recording
 * surface, not crawlable content.
 */

import type { Metadata } from "next";
import { apiClient } from "@/lib/api/client";
import { DemoPanel } from "./demo-panel";

export const metadata: Metadata = {
  title: "slowquery dashboard demo",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function Page() {
  let seed: Awaited<ReturnType<typeof apiClient.listFingerprints>> = [];
  let error: { kind: "http"; status: number; message: string } | undefined;
  try {
    seed = await apiClient.listFingerprints();
  } catch (err) {
    error = { kind: "http", status: 500, message: (err as Error).message };
  }
  return <DemoPanel fingerprints={seed} error={error} />;
}
