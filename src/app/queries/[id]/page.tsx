import { notFound } from "next/navigation";
import { PageFrame } from "@/components/terminal/PageFrame";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";
import { CanonicalSql } from "@/features/query-detail/canonical-sql";
import { errorToView } from "@/features/query-detail/error-routing";
import { ExplainPlanViewer, PlanNotAvailable } from "@/features/query-detail/explain-plan-viewer";
import { validateIdOrNotFound } from "@/features/query-detail/parse";
import { RecentSamplesTable } from "@/features/query-detail/recent-samples-table";
import { SuggestionList } from "@/features/query-detail/suggestion-card";
import { apiClient } from "@/lib/api/client";
import type { ApiError } from "@/lib/api/errors";
import { ConfigError, HttpError, NetworkError, ParseError, TimeoutError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
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

export default async function Page({ params }: PageProps) {
  const { id: rawId } = await params;
  const id = validateIdOrNotFound(rawId);
  if (id === null) notFound();

  let result: Awaited<ReturnType<typeof apiClient.getFingerprint>> | null = null;
  let error: ApiError | null = null;
  try {
    result = await apiClient.getFingerprint(id);
  } catch (err) {
    if (isApiError(err)) {
      error = err;
    } else {
      throw err;
    }
  }

  if (error) {
    const view = errorToView(error);
    if (view === "not-found") notFound();
    return (
      <PageFrame
        active="queries"
        statusLeft={`slowquery.dashboard ~/queries/${id}`}
        statusRight={<span className="text-error">error</span>}
      >
        <TerminalWindow title="error" statusDot="red" statusLabel="failed">
          <p className="font-mono text-sm text-fg-muted">
            {view === "error-malformed"
              ? "Backend response looked malformed"
              : "Backend error — try again"}
          </p>
          <a
            href={`/queries/${id}`}
            className="mt-3 inline-block font-mono text-xs text-accent-flame hover:underline"
          >
            retry →
          </a>
        </TerminalWindow>
      </PageFrame>
    );
  }

  if (!result) return null;

  return (
    <PageFrame
      active="queries"
      statusLeft={`slowquery.dashboard ~/queries/${result.fingerprint.id}`}
      statusRight={
        <>
          <span className="tabular-nums">p95 {String(result.fingerprint.p95_ms ?? "—")}ms</span>
          <span className="text-fg-faint">·</span>
          <span className="tabular-nums">{result.fingerprint.call_count} calls</span>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <div>
          <a href="/" className="font-mono text-xs text-accent-flame hover:underline">
            ← back to fingerprints
          </a>
          <h1 className="mt-2 font-mono text-sm text-foreground">{result.fingerprint.id}</h1>
          <p className="font-mono text-xs text-fg-muted">
            calls {result.fingerprint.call_count} · p50 {String(result.fingerprint.p50_ms)}ms · p95{" "}
            {String(result.fingerprint.p95_ms)}ms · p99 {String(result.fingerprint.p99_ms)}ms
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <TerminalWindow title="canonical_sql" statusDot="flame" statusLabel="fingerprint">
            <CanonicalSql sql={result.canonical_sql} />
          </TerminalWindow>

          <TerminalWindow
            title="explain_plan"
            statusDot={result.explain_plan ? "green" : "off"}
            statusLabel={result.explain_plan ? "captured" : "pending"}
          >
            {result.explain_plan ? (
              <ExplainPlanViewer plan={result.explain_plan} />
            ) : (
              <PlanNotAvailable />
            )}
          </TerminalWindow>
        </div>

        <TerminalWindow
          title="suggestions"
          statusDot={result.suggestions.length > 0 ? "flame" : "off"}
          statusLabel={`${result.suggestions.length} found`}
        >
          <SuggestionList suggestions={result.suggestions} />
        </TerminalWindow>

        <TerminalWindow title="recent_samples" statusDot="off" statusLabel="last 10">
          <RecentSamplesTable samples={result.recent_samples} />
        </TerminalWindow>
      </div>
    </PageFrame>
  );
}
