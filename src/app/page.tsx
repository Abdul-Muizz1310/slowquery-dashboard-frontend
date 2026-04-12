import { PageFrame } from "@/components/terminal/PageFrame";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";
import { ErrorState } from "@/features/fingerprints/error-state";
import { FingerprintsTable } from "@/features/fingerprints/fingerprints-table";
import { normaliseSortParams } from "@/features/fingerprints/parse";
import { apiClient } from "@/lib/api/client";
import type { ApiError } from "@/lib/api/errors";
import { ConfigError, HttpError, NetworkError, ParseError, TimeoutError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

function isApiError(value: unknown): value is ApiError {
  return (
    value instanceof ConfigError ||
    value instanceof NetworkError ||
    value instanceof TimeoutError ||
    value instanceof HttpError ||
    value instanceof ParseError
  );
}

export default async function Page({ searchParams }: PageProps) {
  const { sort, order } = normaliseSortParams(await searchParams);
  let result: Awaited<ReturnType<typeof apiClient.listFingerprints>> | null = null;
  let error: ApiError | null = null;
  try {
    result = await apiClient.listFingerprints();
  } catch (err) {
    if (isApiError(err)) {
      error = err;
    } else {
      throw err;
    }
  }

  const count = result?.length ?? 0;

  return (
    <PageFrame
      active="home"
      statusLeft="slowquery.dashboard ~/"
      statusRight={
        <>
          <span className="tabular-nums">{count} fingerprints</span>
          <span className="text-fg-faint">·</span>
          <span>
            backend <span className="text-success">OK</span>
          </span>
        </>
      }
    >
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-mono text-3xl font-semibold leading-tight tracking-tight text-foreground md:text-4xl">
            catch{" "}
            <span className="relative text-accent-flame">
              slow
              <span className="absolute -bottom-1 left-0 h-[3px] w-full bg-accent-flame/60 shadow-[0_0_12px_rgb(249_115_22_/_0.8)]" />
            </span>{" "}
            queries.
          </h1>
          <p className="max-w-xl font-mono text-sm leading-relaxed text-fg-muted">
            live fingerprints from{" "}
            <code className="rounded border border-border bg-surface-hover px-1 py-0.5 text-accent-flame">
              slowquery-demo-backend
            </code>
            . click any row to see the EXPLAIN plan + index suggestions.
          </p>
        </div>

        <TerminalWindow
          title="query_fingerprints"
          statusDot={count > 0 ? "flame" : "off"}
          statusLabel={count > 0 ? "live" : "empty"}
          strong
        >
          {error ? (
            <ErrorState error={error} />
          ) : (
            <FingerprintsTable fingerprints={result ?? []} sort={sort} order={order} />
          )}
        </TerminalWindow>
      </div>
    </PageFrame>
  );
}
