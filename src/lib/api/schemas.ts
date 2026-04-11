/**
 * Spec 00 — Zod schemas for every backend response shape.
 *
 * The contract pinned here mirrors:
 *   - slowquery-demo-backend/src/slowquery_demo/schemas/branches.py
 *   - slowquery-demo-backend/alembic/versions/0001_initial.py (the
 *     query_fingerprints / query_samples / explain_plans / suggestions
 *     bookkeeping tables)
 *
 * Closed enums are deliberate: a backend drift on `kind` or `source`
 * becomes a ParseError, never a silent type hole. Free-text rule names
 * stay open so the library's rule set can grow without breaking us.
 */

import { z } from "zod";

export const BranchNameSchema = z.enum(["slow", "fast"]);
export type BranchName = z.infer<typeof BranchNameSchema>;

const NumericNullable = z.union([z.number(), z.null()]);
const TimestampString = z.string().min(1);

export const FingerprintSchema = z.object({
  id: z.string().min(1),
  fingerprint: z.string(),
  first_seen: TimestampString,
  last_seen: TimestampString,
  call_count: z.number().int().nonnegative(),
  total_ms: z.number().int().nonnegative(),
  p50_ms: NumericNullable,
  p95_ms: NumericNullable,
  p99_ms: NumericNullable,
  max_ms: NumericNullable,
});
export type Fingerprint = z.infer<typeof FingerprintSchema>;

export const SuggestionKindSchema = z.enum(["index", "rewrite", "denormalize", "partition"]);
export type SuggestionKind = z.infer<typeof SuggestionKindSchema>;

export const SuggestionSourceSchema = z.enum(["rules", "llm"]);
export type SuggestionSource = z.infer<typeof SuggestionSourceSchema>;

export const SuggestionSchema = z.object({
  id: z.number().int(),
  fingerprint_id: z.string().min(1),
  kind: SuggestionKindSchema,
  source: SuggestionSourceSchema,
  rule: z.string().nullable().optional(),
  sql: z.string().nullable(),
  rationale: z.string(),
  applied_at: TimestampString.nullable(),
});
export type Suggestion = z.infer<typeof SuggestionSchema>;

export const ExplainPlanSchema = z.object({
  fingerprint_id: z.string().min(1),
  plan_json: z.record(z.string(), z.unknown()),
  plan_text: z.string(),
  cost: NumericNullable,
  captured_at: TimestampString,
});
export type ExplainPlan = z.infer<typeof ExplainPlanSchema>;

export const QuerySampleSchema = z.object({
  id: z.number().int(),
  fingerprint_id: z.string().min(1),
  params: z.unknown().nullable(),
  duration_ms: z.number(),
  rows: z.number().int().nullable(),
  sampled_at: TimestampString,
});
export type QuerySample = z.infer<typeof QuerySampleSchema>;

export const FingerprintDetailSchema = z.object({
  fingerprint: FingerprintSchema,
  canonical_sql: z.string(),
  explain_plan: ExplainPlanSchema.nullable(),
  suggestions: z.array(SuggestionSchema),
  recent_samples: z.array(QuerySampleSchema),
});
export type FingerprintDetail = z.infer<typeof FingerprintDetailSchema>;

export const StreamEventSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("tick"),
    fingerprint_id: z.string().regex(/^[a-f0-9]{16}$/),
    p95_ms: z.number().finite(),
    sampled_at: TimestampString,
  }),
  z.object({
    kind: z.literal("heartbeat"),
    now: TimestampString,
  }),
  z.object({
    kind: z.literal("branch_switched"),
    active: BranchNameSchema,
    switched_at: TimestampString,
  }),
]);
export type StreamEvent = z.infer<typeof StreamEventSchema>;

export const SwitchBranchRequestSchema = z.object({
  target: BranchNameSchema,
});
export type SwitchBranchRequest = z.infer<typeof SwitchBranchRequestSchema>;

const RawSwitchBranchResponseSchema = z.object({
  active: BranchNameSchema,
  switched_at: TimestampString,
  latency_ms: z.number().int().nonnegative(),
});

export const SwitchBranchResponseSchema = RawSwitchBranchResponseSchema.transform((raw) => ({
  ...raw,
  switched_at: new Date(raw.switched_at),
}));
export type SwitchBranchResponse = z.infer<typeof SwitchBranchResponseSchema>;

export const FingerprintsListSchema = z.array(FingerprintSchema);
