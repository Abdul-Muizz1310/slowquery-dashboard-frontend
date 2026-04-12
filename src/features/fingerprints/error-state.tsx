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
      <div className="rounded border border-error/30 bg-error/10 p-4 text-sm text-error font-mono">
        <p className="font-medium">Backend returned {error.status}</p>
        <p className="mt-1 text-error">The slowquery-demo-backend responded with an error.</p>
        <a href="/" className="mt-2 inline-block underline">
          Retry
        </a>
      </div>
    );
  }
  if (error instanceof TimeoutError) {
    return (
      <div className="rounded border border-warning/30 bg-warning/10 p-4 text-sm text-warning font-mono">
        <p className="font-medium">Backend timed out</p>
        <a href="/" className="mt-2 inline-block underline">
          Retry
        </a>
      </div>
    );
  }
  if (error instanceof ParseError) {
    return (
      <div className="rounded border border-error/30 bg-error/10 p-4 text-sm text-error font-mono">
        <p className="font-medium">Backend response looked malformed</p>
        <p className="mt-1 text-error">{error.path}</p>
        <a href="/" className="mt-2 inline-block underline">
          Retry
        </a>
      </div>
    );
  }
  return (
    <div className="rounded border border-error/30 bg-error/10 p-4 text-sm text-error font-mono">
      <p className="font-medium">Something went wrong</p>
      <a href="/" className="mt-2 inline-block underline">
        Retry
      </a>
    </div>
  );
}
