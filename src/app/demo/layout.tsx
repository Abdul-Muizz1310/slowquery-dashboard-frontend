/**
 * Spec 05 — demo layout. Uses the standard PageFrame shell so the
 * page has nav, status bar, and the bg-grid/scanlines background
 * like every other page. The content area is the compact two-column
 * DemoPanel composition.
 *
 * The DEMO_BODY_CLASS and DEMO_CLAMP_CLASS exports are read by the
 * spec 05 unit tests so the strings stay pinned in the source.
 */

import type { ReactNode } from "react";
import { PageFrame } from "@/components/terminal/PageFrame";

export const DEMO_BODY_CLASS = "overflow-hidden bg-background text-foreground";
export const DEMO_CLAMP_CLASS = "mx-auto w-full max-w-[1280px] max-h-[720px]";

export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <PageFrame
      active="demo"
      statusLeft="slowquery.dashboard ~/demo"
      statusRight={<span className="text-fg-faint">recording surface</span>}
    >
      <div className={DEMO_CLAMP_CLASS}>{children}</div>
    </PageFrame>
  );
}
