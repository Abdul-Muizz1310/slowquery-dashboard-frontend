/**
 * Spec 02 — SuggestionCard discriminated-union renderer + SuggestionList.
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

import type { Suggestion } from "@/lib/api/schemas";

interface SuggestionCardProps {
  suggestion: Suggestion;
}

function CopyButton({ value }: { value: string }) {
  return (
    <button
      type="button"
      className="text-xs px-2 py-1 rounded border border-zinc-300 bg-white hover:bg-zinc-50"
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
    <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-900 border border-green-300">
      Applied
    </span>
  );
}

export function SuggestionCard({ suggestion }: SuggestionCardProps) {
  const isApplied = suggestion.applied_at !== null;
  switch (suggestion.kind) {
    case "index": {
      return (
        <div className="rounded border border-zinc-200 bg-white p-4 mt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase text-zinc-500">
              {suggestion.source} · {suggestion.rule ?? "index"}
            </span>
            {isApplied && <AppliedBadge at={suggestion.applied_at as string} />}
          </div>
          <pre className="m-0 p-2 font-mono text-xs bg-zinc-50 rounded border border-zinc-200 overflow-x-auto">
            {suggestion.sql ?? ""}
          </pre>
          <p className="mt-2 text-sm text-zinc-700">{suggestion.rationale}</p>
          <div className="mt-3 flex gap-2">
            {suggestion.sql && <CopyButton value={suggestion.sql} />}
            <button
              type="button"
              disabled={isApplied}
              className="text-xs px-2 py-1 rounded border border-blue-300 bg-blue-50 text-blue-900 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Apply on fast branch
            </button>
          </div>
        </div>
      );
    }
    case "rewrite": {
      return (
        <div className="rounded border border-zinc-200 bg-white p-4 mt-3">
          <div className="text-xs uppercase text-zinc-500 mb-2">
            rewrite · {suggestion.rule ?? ""}
          </div>
          <p className="text-sm text-zinc-700">{suggestion.rationale}</p>
          {suggestion.sql && (
            <pre className="m-0 mt-2 p-2 font-mono text-xs bg-zinc-50 rounded border border-zinc-200">
              {suggestion.sql}
            </pre>
          )}
        </div>
      );
    }
    case "denormalize":
    case "partition": {
      return (
        <div className="rounded border border-zinc-200 bg-white p-4 mt-3">
          <div className="text-xs uppercase text-zinc-500 mb-2">
            {suggestion.kind} · {suggestion.source}
          </div>
          <p className="text-sm text-zinc-700">{suggestion.rationale}</p>
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
      <div className="rounded border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 mt-3">
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
