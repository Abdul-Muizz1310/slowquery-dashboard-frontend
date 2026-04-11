/**
 * Spec 01 — friendly error state for the fingerprints route. Maps the
 * typed error union from spec 00 into one of three copy variants.
 */

import type { ApiError } from "@/lib/api/errors";
import { HttpError, ParseError, TimeoutError } from "@/lib/api/errors";

interface ErrorStateProps {
  error: ApiError;
}

export function ErrorState({ error }: ErrorStateProps) {
  if (error instanceof HttpError) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        <p className="font-medium">Backend returned {error.status}</p>
        <p className="mt-1 text-red-800">The slowquery-demo-backend responded with an error.</p>
        <a href="/" className="mt-2 inline-block underline">
          Retry
        </a>
      </div>
    );
  }
  if (error instanceof TimeoutError) {
    return (
      <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <p className="font-medium">Backend timed out</p>
        <a href="/" className="mt-2 inline-block underline">
          Retry
        </a>
      </div>
    );
  }
  if (error instanceof ParseError) {
    return (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-900">
        <p className="font-medium">Backend response looked malformed</p>
        <p className="mt-1 text-red-800">{error.path}</p>
        <a href="/" className="mt-2 inline-block underline">
          Retry
        </a>
      </div>
    );
  }
  return (
    <div className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-900">
      <p className="font-medium">Something went wrong</p>
      <a href="/" className="mt-2 inline-block underline">
        Retry
      </a>
    </div>
  );
}
