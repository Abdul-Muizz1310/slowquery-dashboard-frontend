/**
 * Spec 02 — CanonicalSql viewer.
 *
 * Renders the canonical SQL as a plain, server-rendered <pre>. This is a
 * read-only display of a short SQL string, so it deliberately does NOT pull
 * in a full code editor: the Monaco editor previously mounted here lived in
 * a permanently `display:none` div (never visible) yet still shipped a
 * multi-MB client chunk and a runtime CDN fetch on every detail-page visit
 * (audit OPT-1). If richer highlighting is wanted later, use a tiny
 * build-time highlighter (prism/shiki) rendered visibly — not an editor.
 */

interface CanonicalSqlProps {
  sql: string;
}

export function CanonicalSql({ sql }: CanonicalSqlProps) {
  return (
    <div className="rounded border border-border bg-surface/50">
      <pre className="m-0 p-3 font-mono text-xs text-foreground whitespace-pre overflow-x-auto">
        {sql}
      </pre>
    </div>
  );
}
