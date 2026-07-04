/**
 * Spec 03 — Top-N selector island for /timeline.
 *
 * Client island that reads the current `?top=N` from the URL and rewrites
 * it via the router on change. The RSC page reads the same `top` param to
 * re-seed <LiveTimeline>, so changing N updates the number of chart lines
 * live without a hard reload.
 */

"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { normaliseTop } from "./buffer";
import { TopNSelector } from "./top-n-selector";

export function TimelineTopN() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const topRaw = searchParams.get("top");
  const top = normaliseTop(topRaw !== null ? Number(topRaw) : 10);

  return (
    <TopNSelector
      top={top}
      onChange={(next) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("top", String(next));
        router.push(`${pathname}?${params.toString()}`);
      }}
    />
  );
}
