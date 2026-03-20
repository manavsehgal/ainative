"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ReactNode } from "react";

interface DetailPaneProps {
  /** The ID of the entity to display (reads from `?detail=` param if omitted) */
  entityId?: string | null;
  /** Title shown in the pane header */
  title: string;
  /** Optional description below the title */
  description?: string;
  /** Header actions (e.g., edit button, status chip) */
  headerActions?: ReactNode;
  /** The detail content */
  children: ReactNode;
}

/**
 * DetailPane — URL-driven right-rail panel for entity detail views.
 *
 * Desktop (≥1024px): renders inline as a sticky side panel.
 * Mobile (<1024px): renders as a bottom Sheet overlay.
 *
 * Opening: navigate to `?detail=<id>` to open.
 * Closing: removes the `detail` search param.
 */
export function DetailPane({
  title,
  description,
  headerActions,
  children,
}: DetailPaneProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const detailId = searchParams.get("detail");

  function close() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("detail");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  if (!detailId) return null;

  // Mobile: Sheet overlay
  if (isMobile) {
    return (
      <Sheet open={!!detailId} onOpenChange={(open) => !open && close()}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] rounded-t-xl"
        >
          <SheetHeader className="px-6 pt-6">
            <div className="flex items-center justify-between">
              <SheetTitle>{title}</SheetTitle>
              {headerActions}
            </div>
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
          <div className="px-6 pb-6 overflow-y-auto">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: inline panel
  return (
    <div className="surface-panel rounded-xl overflow-hidden">
      <div className="flex items-center justify-between border-b border-border p-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold truncate">{title}</h2>
          {description && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          {headerActions}
          <Button
            variant="ghost"
            size="icon"
            onClick={close}
            aria-label="Close detail pane"
            className="h-7 w-7"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="p-4 overflow-y-auto max-h-[calc(100vh-10rem)]">
        {children}
      </div>
    </div>
  );
}

/**
 * Hook to read and manage the detail pane state from URL search params.
 */
export function useDetailPane() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const detailId = searchParams.get("detail");

  function openDetail(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("detail", id);
    router.push(`${pathname}?${params.toString()}`);
  }

  function closeDetail() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("detail");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return { detailId, openDetail, closeDetail, isOpen: !!detailId };
}
