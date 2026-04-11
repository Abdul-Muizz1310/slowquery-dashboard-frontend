/**
 * Spec 01 — rule severity → tailwind colour mapping + RuleBadges
 * presentational component.
 *
 * The mapping is a frozen Record<string, Severity>; unknown rule names
 * fall through to "neutral". Library rule-set growth doesn't break us
 * because the rule field on Suggestion is free text (spec 00).
 */

import type { Suggestion } from "@/lib/api/schemas";

export type Severity = "red" | "yellow" | "orange" | "neutral" | "purple";

export const RULE_SEVERITY: Readonly<Record<string, Severity>> = Object.freeze({
  seq_scan_large_table: "red",
  missing_fk_index: "red",
  sort_without_index: "yellow",
  function_in_where: "yellow",
  n_plus_one: "orange",
  select_star: "neutral",
});

const SEVERITY_CLASSES: Readonly<Record<Severity, string>> = Object.freeze({
  red: "bg-red-100 text-red-900 border-red-300 px-2 py-0.5 rounded text-xs font-mono",
  yellow: "bg-yellow-100 text-yellow-900 border-yellow-300 px-2 py-0.5 rounded text-xs font-mono",
  orange: "bg-orange-100 text-orange-900 border-orange-300 px-2 py-0.5 rounded text-xs font-mono",
  neutral:
    "bg-zinc-100 text-zinc-700 border-zinc-300 px-2 py-0.5 rounded text-xs font-mono neutral",
  purple: "bg-purple-100 text-purple-900 border-purple-300 px-2 py-0.5 rounded text-xs font-mono",
});

function severityFor(suggestion: Suggestion): Severity {
  if (suggestion.source === "llm") return "purple";
  if (!suggestion.rule) return "neutral";
  return RULE_SEVERITY[suggestion.rule] ?? "neutral";
}

function labelFor(suggestion: Suggestion): string {
  if (suggestion.source === "llm") return "llm";
  return suggestion.rule ?? "rule";
}

interface RuleBadgesProps {
  suggestions: readonly Suggestion[];
}

export function RuleBadges({ suggestions }: RuleBadgesProps) {
  // Rule-sourced badges first, then LLM-sourced; stable within group.
  const ordered = [...suggestions].sort((a, b) => {
    if (a.source === b.source) return 0;
    return a.source === "rules" ? -1 : 1;
  });
  return (
    <div className="flex gap-1 flex-wrap">
      {ordered.map((s) => {
        const severity = severityFor(s);
        return (
          <span key={s.id} className={SEVERITY_CLASSES[severity]}>
            {labelFor(s)}
          </span>
        );
      })}
    </div>
  );
}
