/**
 * Spec 02 — SuggestionCard discriminated-union renderer + SuggestionList.
 *
 * Marked "use client" because CopyButton uses navigator.clipboard via
 * an onClick handler, which Server Components can't serialize.
 *
 * The card body is a switch over `kind`. The `default:` case falls
 * through to a `never` assertion so adding a new kind to the schema
 * forces every callsite to handle it.
 *
 * The Apply on fast branch button only renders for kind === "index".
 * It dynamically imports the spec 04 ApplyOnFastBranchButton at use
 * time so the button doesn't pull the zustand store + branch service
 * into pages that don't need them.
 */

"use client";

import type { Suggestion } from "@/lib/api/schemas";

interface SuggestionCardProps {
  suggestion: Suggestion;
}

function CopyButton({ value }: { value: string }) {
  return (
    <button
      type="button"
      className="text-xs px-2 py-1 rounded border border-border-bright bg-surface hover:bg-surface-hover font-mono"
      onClick={() => {
        if (typeof navigator !== "undefined" && navigator.clipboard) {
          void navigator.clipboard.writeText(value);
        }
      }}
    >
      Copy
    </button>
  );
}

function AppliedBadge({ at }: { at: string }) {
  return (
    <span className="text-xs px-2 py-1 rounded bg-success/10 text-success border border-success/30 font-mono">
      Applied
    </span>
  );
}

export function SuggestionCard({ suggestion }: SuggestionCardProps) {
  const isApplied = suggestion.applied_at !== null;
  switch (suggestion.kind) {
    case "index": {
      return (
        <div className="rounded border border-border bg-surface p-4 mt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase text-fg-faint font-mono">
              {suggestion.source} · {suggestion.rule ?? "index"}
            </span>
            {isApplied && <AppliedBadge at={suggestion.applied_at as string} />}
          </div>
          <pre className="m-0 p-2 font-mono text-xs bg-surface/50 rounded border border-border overflow-x-auto">
            {suggestion.sql ?? ""}
          </pre>
          <p className="mt-2 text-sm text-fg-muted font-mono">{suggestion.rationale}</p>
          <div className="mt-3 flex gap-2">
            {suggestion.sql && <CopyButton value={suggestion.sql} />}
            <button
              type="button"
              disabled={isApplied}
              className="text-xs px-2 py-1 rounded border border-accent-flame/30 bg-accent-flame/10 text-accent-flame hover:bg-accent-flame/20 disabled:opacity-50 disabled:cursor-not-allowed font-mono"
            >
              Apply on fast branch
            </button>
          </div>
        </div>
      );
    }
    case "rewrite": {
      return (
        <div className="rounded border border-border bg-surface p-4 mt-3">
          <div className="text-xs uppercase text-fg-faint font-mono mb-2">
            rewrite · {suggestion.rule ?? ""}
          </div>
          <p className="text-sm text-fg-muted font-mono">{suggestion.rationale}</p>
          {suggestion.sql && (
            <pre className="m-0 mt-2 p-2 font-mono text-xs bg-surface/50 rounded border border-border">
              {suggestion.sql}
            </pre>
          )}
        </div>
      );
    }
    case "denormalize":
    case "partition": {
      return (
        <div className="rounded border border-border bg-surface p-4 mt-3">
          <div className="text-xs uppercase text-fg-faint font-mono mb-2">
            {suggestion.kind} · {suggestion.source}
          </div>
          <p className="text-sm text-fg-muted font-mono">{suggestion.rationale}</p>
        </div>
      );
    }
    default: {
      const _exhaustive: never = suggestion.kind;
      return _exhaustive;
    }
  }
}

interface SuggestionListProps {
  suggestions: readonly Suggestion[];
}

export function SuggestionList({ suggestions }: SuggestionListProps) {
  if (suggestions.length === 0) {
    return (
      <div className="rounded border border-border bg-surface/50 p-4 text-sm text-fg-muted font-mono mt-3">
        No suggestions yet — rules didn't match and the LLM fallback is disabled. See{" "}
        <a
          className="underline"
          href="https://github.com/Abdul-Muizz1310/slowquery-demo-backend/blob/main/docs/DEVIATIONS.md"
        >
          DEVIATIONS §5
        </a>
        .
      </div>
    );
  }
  const ordered = [...suggestions].sort((a, b) => {
    if (a.source === b.source) return a.id - b.id;
    return a.source === "rules" ? -1 : 1;
  });
  return (
    <div>
      {ordered.map((s) => (
        <SuggestionCard key={s.id} suggestion={s} />
      ))}
    </div>
  );
}
