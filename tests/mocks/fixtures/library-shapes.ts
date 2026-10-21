/**
 * Spec 08 — the slowquery-detective 0.2 shapes of the fixture payloads.
 *
 * Derived from the 0.1-era fixtures by dropping what the library does not
 * send (suggestion id / fingerprint_id / rule, plan fingerprint_id /
 * plan_text, sample id / fingerprint_id / params / rows) and adding what it
 * does (a sample's request_id, fractional totals).
 */

import { detailsById } from "./fingerprint-detail";
import { fingerprintsList } from "./fingerprints";

type Json = Record<string, unknown>;

function librarySuggestion(s: Json): Json {
  const { id: _id, fingerprint_id: _fp, rule: _rule, ...rest } = s;
  return rest;
}

function libraryRow(fp: Json, index = 0): Json {
  const suggestions = Array.isArray(fp.suggestions) ? (fp.suggestions as Json[]) : [];
  return {
    ...fp,
    total_ms: Number(fp.total_ms) + 0.25 + index,
    suggestions: suggestions.map(librarySuggestion),
  };
}

export const libraryFingerprintsList: Json[] = fingerprintsList.map((fp, i) =>
  libraryRow(fp as unknown as Json, i),
);

export function libraryDetail(detail: Json): Json {
  const plan = detail.explain_plan as Json | null;
  const samples = (detail.recent_samples as Json[]) ?? [];
  return {
    fingerprint: libraryRow(detail.fingerprint as Json),
    canonical_sql: detail.canonical_sql,
    explain_plan:
      plan === null
        ? null
        : // EXPLAIN (FORMAT JSON)'s top-level object, as the library stores it.
          { plan_json: { Plan: plan.plan_json }, cost: plan.cost, captured_at: plan.captured_at },
    suggestions: ((detail.suggestions as Json[]) ?? []).map(librarySuggestion),
    recent_samples: samples.map((s, i) => ({
      duration_ms: s.duration_ms,
      request_id: i === 0 ? "req-e2e-1" : null,
      sampled_at: s.sampled_at,
    })),
  };
}

export const libraryDetailsById: Record<string, Json> = Object.fromEntries(
  Object.entries(detailsById).map(([id, detail]) => [id, libraryDetail(detail as Json)]),
);
