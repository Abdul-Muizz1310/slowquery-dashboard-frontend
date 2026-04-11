/**
 * `/` — fingerprints landing page (spec 01).
 *
 * Server-rendered RSC. Fetches the live fingerprint list from the
 * backend on every request (no cache: this is a debugging dashboard
 * where stale data is worse than a slower request). On any error, an
 * ErrorState component takes over the page rather than a partial
 * render.
 */

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
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-200 px-6 py-4">
        <h1 className="text-lg font-semibold text-zinc-900">slowquery dashboard</h1>
        <p className="text-xs text-zinc-500">
          live fingerprints from <code className="font-mono">slowquery-demo-backend</code>
        </p>
      </header>
      <main className="px-6 py-6">
        {error ? (
          <ErrorState error={error} />
        ) : (
          <FingerprintsTable fingerprints={result ?? []} sort={sort} order={order} />
        )}
      </main>
    </div>
  );
}
