/**
 * Spec 02 — error routing for the /queries/[id] page. Maps the spec 00
 * typed error union into a small enum the page renderer dispatches on.
 */

import type { ApiError } from "@/lib/api/errors";
import { HttpError, ParseError } from "@/lib/api/errors";

export type ErrorView = "not-found" | "error-retry" | "error-malformed";

export function errorToView(error: ApiError): ErrorView {
  if (error instanceof HttpError && error.status === 404) return "not-found";
  if (error instanceof ParseError) return "error-malformed";
  return "error-retry";
}
