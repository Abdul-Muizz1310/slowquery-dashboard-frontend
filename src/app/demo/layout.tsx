/**
 * Spec 05 — chromeless layout for /demo. Hides the main site chrome,
 * clamps content to 1280x720 with letterboxing, applies dark mode
 * unconditionally for gif recordings.
 *
 * The DEMO_BODY_CLASS and DEMO_CLAMP_CLASS exports are read by the
 * spec 05 unit tests so the strings stay pinned in the source.
 */

import type { ReactNode } from "react";

export const DEMO_BODY_CLASS = "overflow-hidden bg-background text-foreground";
export const DEMO_CLAMP_CLASS = "mx-auto my-auto w-full max-w-[1280px] max-h-[720px] aspect-video";

export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`min-h-screen flex items-center justify-center ${DEMO_BODY_CLASS}`}>
      <div className={DEMO_CLAMP_CLASS}>{children}</div>
    </div>
  );
}
