import { PageFrame } from "@/components/terminal/PageFrame";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";
import { normaliseTop } from "@/features/timeline/buffer";
import { LiveTimeline } from "@/features/timeline/live-timeline";
import { TimelineTopN } from "@/features/timeline/timeline-top-n";
import { getCachedFingerprints } from "@/lib/api/cached";
import type { Fingerprint } from "@/lib/api/schemas";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const topRaw = params.top !== undefined ? Number(params.top) : 10;
  const top = normaliseTop(topRaw);

  let seed: Fingerprint[] = [];
  try {
    seed = await getCachedFingerprints();
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
          <div className="flex items-start justify-between gap-4">
            <h1 className="font-mono text-2xl font-semibold tracking-tight text-foreground">
              live <span className="text-accent-flame">p95</span> timeline
            </h1>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-fg-faint">
                top
              </span>
              <TimelineTopN />
            </div>
          </div>
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
