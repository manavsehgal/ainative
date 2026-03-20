"use client";

import {
  createContext,
  useContext,
  useCallback,
  type ReactNode,
} from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

export type EntityType =
  | "task"
  | "workflow"
  | "document"
  | "profile"
  | "schedule"
  | "notification"
  | "event";

interface DetailPaneState {
  entityType: EntityType | null;
  entityId: string | null;
  isOpen: boolean;
  openDetail: (entityType: EntityType, id: string) => void;
  closeDetail: () => void;
}

const DetailPaneContext = createContext<DetailPaneState>({
  entityType: null,
  entityId: null,
  isOpen: false,
  openDetail: () => {},
  closeDetail: () => {},
});

/**
 * DetailPaneProvider — URL-driven state for the universal detail pane.
 *
 * Reads `?detail=<type>:<id>` from search params.
 * Mount in layout.tsx to provide detail pane state to all surfaces.
 */
export function DetailPaneProvider({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const detailParam = searchParams.get("detail");
  let entityType: EntityType | null = null;
  let entityId: string | null = null;

  if (detailParam) {
    const colonIdx = detailParam.indexOf(":");
    if (colonIdx > 0) {
      entityType = detailParam.slice(0, colonIdx) as EntityType;
      entityId = detailParam.slice(colonIdx + 1);
    } else {
      // Legacy format: just an ID, no type prefix
      entityId = detailParam;
    }
  }

  const openDetail = useCallback(
    (type: EntityType, id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("detail", `${type}:${id}`);
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname]
  );

  const closeDetail = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("detail");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }, [searchParams, router, pathname]);

  return (
    <DetailPaneContext.Provider
      value={{
        entityType,
        entityId,
        isOpen: !!entityId,
        openDetail,
        closeDetail,
      }}
    >
      {children}
    </DetailPaneContext.Provider>
  );
}

/**
 * Hook to read and manage the detail pane state.
 *
 * Usage:
 *   const { openDetail, closeDetail, entityId } = useDetailPaneContext();
 *   openDetail("task", taskId);
 */
export function useDetailPaneContext() {
  return useContext(DetailPaneContext);
}
