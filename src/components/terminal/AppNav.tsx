import Link from "next/link";
import { cn } from "@/lib/utils";

export type AppNavProps = {
  active?: "home" | "queries" | "timeline" | "demo";
};

export function AppNav({ active }: AppNavProps) {
  return (
    <nav className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-6 px-4 md:px-6">
        <Link href="/" className="flex items-center gap-2 font-mono">
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-surface text-accent-flame">
            <svg
              viewBox="0 0 16 16"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <title>slowquery</title>
              <path d="M8 2v12M4 6l4-4 4 4M3 10h10" />
            </svg>
          </span>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            slowquery
            <span className="ml-1 text-accent-flame">.dashboard</span>
          </span>
        </Link>
        <div className="flex items-center gap-5 font-mono text-xs text-fg-muted">
          {(
            [
              { href: "/", label: "queries", key: "home" },
              { href: "/timeline", label: "timeline", key: "timeline" },
              { href: "/demo", label: "demo", key: "demo" },
            ] as const
          ).map((link) => (
            <Link
              key={link.key}
              href={link.href}
              className={cn(
                active === link.key
                  ? "relative text-foreground after:absolute after:-bottom-[19px] after:left-0 after:h-[2px] after:w-full after:bg-accent-flame after:shadow-[0_0_8px_rgb(249_115_22_/_0.6)]"
                  : "transition-colors hover:text-foreground",
              )}
            >
              {link.label}
            </Link>
          ))}
          <a
            href="https://github.com/Abdul-Muizz1310/slowquery-dashboard-frontend"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            github
          </a>
          <a
            href="https://slowquery-demo-backend.onrender.com/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            api
          </a>
        </div>
      </div>
    </nav>
  );
}
