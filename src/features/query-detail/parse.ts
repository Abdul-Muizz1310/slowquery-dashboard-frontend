/**
 * Spec 02 — id validation + detail parse helpers.
 *
 * The 16-char-hex check rejects malicious shapes before any backend
 * call is issued. parseDetailOrThrow runs the wire payload through
 * the Zod schema; one bad row fails the page rather than partially
 * rendering it.
 */

import { type FingerprintDetail, FingerprintDetailSchema } from "@/lib/api/schemas";

const ID_PATTERN = /^[a-f0-9]{16}$/;

export function validateIdOrNotFound(id: string): string | null {
  return ID_PATTERN.test(id) ? id : null;
}

export function parseDetailOrThrow(input: unknown): FingerprintDetail {
  return FingerprintDetailSchema.parse(input);
}
