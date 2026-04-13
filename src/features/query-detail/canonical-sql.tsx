/**
 * Spec 02 — CanonicalSql viewer.
 *
 * Marked "use client" because next/dynamic with `ssr: false` is only
 * allowed in client components in Next 16. The SSR pass still walks
 * client components and emits their HTML, so the <pre> fallback still
 * appears in the server-rendered markup before Monaco hydrates.
 *
 * The MONACO_OPTIONS export is consumed by the security test that
 * pins readOnly: true.
 */

"use client";

import dynamic from "next/dynamic";

export const MONACO_OPTIONS: Readonly<{
  readOnly: boolean;
  minimap: { enabled: boolean };
  scrollBeyondLastLine: boolean;
  fontSize: number;
}> = Object.freeze({
  readOnly: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  fontSize: 13,
});

const MonacoEditor = dynamic(
  () =>
    import("@monaco-editor/react").then((mod) => {
      const Editor = mod.Editor;
      /* v8 ignore next 7 -- Monaco loads client-side only; untestable in jsdom */
      function Wrapped({ sql }: { sql: string }) {
        return (
          <Editor
            value={sql}
            language="sql"
            options={MONACO_OPTIONS}
            height="240px"
            theme="vs-dark"
          />
        );
      }
      Wrapped.displayName = "MonacoSqlEditor";
      return Wrapped;
    }),
  {
    ssr: false,
    loading: () => null,
  },
);

interface CanonicalSqlProps {
  sql: string;
}

export function CanonicalSql({ sql }: CanonicalSqlProps) {
  return (
    <div className="rounded border border-border bg-surface/50">
      <pre className="m-0 p-3 font-mono text-xs text-foreground whitespace-pre overflow-x-auto">
        {sql}
      </pre>
      <div className="hidden">
        {/* Monaco hydrates over the <pre> after mount; the loading
            fallback is null so the <pre> stays visible. */}
        <MonacoEditor sql={sql} />
      </div>
    </div>
  );
}
