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
          className={`text-xs px-2 py-1 rounded border ${
            top === preset
              ? "border-blue-300 bg-blue-50 text-blue-900"
              : "border-zinc-300 bg-white text-zinc-700"
          }`}
        >
          {preset}
        </button>
      ))}
    </div>
  );
}
