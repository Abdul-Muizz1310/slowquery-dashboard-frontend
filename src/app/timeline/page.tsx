import { PageFrame } from "@/components/terminal/PageFrame";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";
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
    // Degrades gracefully — SSE will populate when it connects.
  }

  return (
    <PageFrame
      active="timeline"
      statusLeft="slowquery.dashboard ~/timeline"
      statusRight={
        <>
          <span className="tabular-nums">top {top}</span>
          <span className="text-fg-faint">·</span>
          <span>
            sse <span className="text-accent-flame">streaming</span>
          </span>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-mono text-2xl font-semibold tracking-tight text-foreground">
            live <span className="text-accent-flame">p95</span> timeline
          </h1>
          <p className="font-mono text-sm text-fg-muted">
            real-time latency per fingerprint via SSE from the backend drainer.
          </p>
        </div>

        <TerminalWindow title="p95_timeline" statusDot="flame" statusLabel="live" strong>
          <LiveTimeline seed={seed} top={top} />
        </TerminalWindow>
      </div>
    </PageFrame>
  );
}
