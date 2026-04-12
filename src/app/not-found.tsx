import { PageFrame } from "@/components/terminal/PageFrame";
import { TerminalWindow } from "@/components/terminal/TerminalWindow";

export default function NotFound() {
  return (
    <PageFrame
      statusLeft="slowquery.dashboard ~/404"
      statusRight={<span className="text-error">not found</span>}
    >
      <div className="flex flex-col items-center justify-center gap-6 pt-20">
        <TerminalWindow title="404" statusDot="red" statusLabel="not found">
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <div className="font-mono text-6xl font-bold text-accent-flame">404</div>
            <p className="font-mono text-sm text-fg-muted">this page could not be found.</p>
            <a href="/" className="mt-2 font-mono text-xs text-accent-flame hover:underline">
              ← back to fingerprints
            </a>
          </div>
        </TerminalWindow>
      </div>
    </PageFrame>
  );
}
