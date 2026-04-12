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
  red: "bg-error/10 text-error border-error/30 px-2 py-0.5 rounded text-xs font-mono",
  yellow: "bg-warning/10 text-warning border-warning/30 px-2 py-0.5 rounded text-xs font-mono",
  orange:
    "bg-accent-flame/10 text-accent-flame border-accent-flame/30 px-2 py-0.5 rounded text-xs font-mono",
  neutral:
    "bg-surface/50 text-fg-muted border-border-bright px-2 py-0.5 rounded text-xs font-mono neutral",
  purple:
    "bg-[#8b5cf6]/10 text-[#8b5cf6] border-[#8b5cf6]/30 px-2 py-0.5 rounded text-xs font-mono",
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
