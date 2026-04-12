/**
 * Spec 03 — TopNSelector. Three buttons for the most useful presets.
 */

"use client";

interface TopNSelectorProps {
  top: number;
  onChange: (next: number) => void;
}

const PRESETS = [3, 5, 10] as const;

export function TopNSelector({ top, onChange }: TopNSelectorProps) {
  return (
    <div className="inline-flex gap-1">
      {PRESETS.map((preset) => (
        <button
          type="button"
          key={preset}
          onClick={() => onChange(preset)}
          className={`text-xs px-2 py-1 rounded border font-mono ${
            top === preset
              ? "border-accent-flame/30 bg-accent-flame/10 text-accent-flame"
              : "border-border-bright bg-surface text-fg-muted"
          }`}
        >
          {preset}
        </button>
      ))}
    </div>
  );
}
