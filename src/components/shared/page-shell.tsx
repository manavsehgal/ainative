import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageShellProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  filters?: ReactNode;
  detailPane?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Full-bleed mode skips the surface-page-shell wrapper (for pages with custom layout) */
  fullBleed?: boolean;
}

/**
 * PageShell — consistent page anatomy for all routes.
 *
 * Layout:
 *   ┌──────────────────────────────────┬─────────────┐
 *   │  Title + Actions                 │             │
 *   │  Filters                         │  DetailPane │
 *   │  Content (children)              │  (420px)    │
 *   └──────────────────────────────────┴─────────────┘
 *
 * When `detailPane` is provided, content area uses CSS grid with a 420px right rail.
 * On mobile (<1024px), the detail pane should be rendered as a Sheet overlay
 * by the parent — PageShell only handles the desktop grid layout.
 */
export function PageShell({
  title,
  description,
  actions,
  filters,
  detailPane,
  children,
  className,
  fullBleed = false,
}: PageShellProps) {
  const content = (
    <>
      {/* Title row */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 mt-2 sm:mt-0">{actions}</div>
        )}
      </div>

      {/* Filter row */}
      {filters && <div className="mt-4">{filters}</div>}

      {/* Content + optional detail pane */}
      {detailPane ? (
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_420px]">
          <div className="min-w-0">{children}</div>
          <aside className="hidden lg:block">
            <div className="sticky top-6">{detailPane}</div>
          </aside>
        </div>
      ) : (
        <div className="mt-6">{children}</div>
      )}
    </>
  );

  if (fullBleed) {
    return (
      <div className={cn("bg-background min-h-screen p-4 sm:p-6", className)}>
        {content}
      </div>
    );
  }

  return (
    <div className={cn("bg-background min-h-screen p-4 sm:p-6", className)}>
      <div className="surface-page-shell rounded-xl p-5 sm:p-6">
        {content}
      </div>
    </div>
  );
}
