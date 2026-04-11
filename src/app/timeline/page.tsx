/**
 * `/timeline` — live p95 chart (spec 03).
 *
 * RSC shell that fetches the seed list once on the server, then hands
 * off to the LiveTimeline client component which opens the SSE
 * connection on mount.
 */

import { normaliseTop } from "@/features/timeline/buffer";
import { LiveTimeline } from "@/features/timeline/live-timeline";
import { apiClient } from "@/lib/api/client";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const topRaw = params.top !== undefined ? Number(params.top) : 10;
  const top = normaliseTop(topRaw);

  let seed: Awaited<ReturnType<typeof apiClient.listFingerprints>> = [];
  try {
    seed = await apiClient.listFingerprints();
  } catch {
    // The timeline page degrades gracefully — even with an empty seed
    // the SSE-driven LiveTimeline will populate as events arrive.
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-200 px-6 py-4">
        <a href="/" className="text-sm text-blue-700 hover:underline">
          ← back to fingerprints
        </a>
        <h1 className="mt-2 text-lg font-semibold text-zinc-900">live timeline</h1>
      </header>
      <main className="px-6 py-6">
        <LiveTimeline seed={seed} top={top} />
      </main>
    </div>
  );
}
