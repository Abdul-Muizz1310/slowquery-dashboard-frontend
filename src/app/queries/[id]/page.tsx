/**
 * `/queries/[id]` — single fingerprint detail (spec 02).
 *
 * RSC shell. Fetches the detail payload, then composes the
 * presentational components from src/features/query-detail/.
 */

import { notFound } from "next/navigation";
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
      <div className="min-h-screen bg-white">
        <header className="border-b border-zinc-200 px-6 py-4">
          <a href="/" className="text-sm text-blue-700 hover:underline">
            ← back to fingerprints
          </a>
        </header>
        <main className="px-6 py-6">
          <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            <p className="font-medium">
              {view === "error-malformed"
                ? "Backend response looked malformed"
                : "Backend error — try again"}
            </p>
            <a href={`/queries/${id}`} className="mt-2 inline-block underline">
              Retry
            </a>
          </div>
        </main>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-200 px-6 py-4">
        <a href="/" className="text-sm text-blue-700 hover:underline">
          ← back to fingerprints
        </a>
        <h1 className="mt-2 font-mono text-sm text-zinc-900">{result.fingerprint.id}</h1>
        <p className="text-xs text-zinc-500">
          calls {result.fingerprint.call_count} · p50 {String(result.fingerprint.p50_ms)}ms · p95{" "}
          {String(result.fingerprint.p95_ms)}ms · p99 {String(result.fingerprint.p99_ms)}ms
        </p>
      </header>
      <main className="px-6 py-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section>
          <h2 className="text-sm font-medium text-zinc-700 mb-2">canonical sql</h2>
          <CanonicalSql sql={result.canonical_sql} />
        </section>
        <section>
          <h2 className="text-sm font-medium text-zinc-700 mb-2">explain plan</h2>
          {result.explain_plan ? (
            <ExplainPlanViewer plan={result.explain_plan} />
          ) : (
            <PlanNotAvailable />
          )}
        </section>
        <section className="lg:col-span-2">
          <h2 className="text-sm font-medium text-zinc-700 mb-2">suggestions</h2>
          <SuggestionList suggestions={result.suggestions} />
        </section>
        <section className="lg:col-span-2">
          <h2 className="text-sm font-medium text-zinc-700 mb-2">recent samples</h2>
          <RecentSamplesTable samples={result.recent_samples} />
        </section>
      </main>
    </div>
  );
}
