"use client";

import { useCallback, useEffect, useState } from "react";
import type { WorkflowStatusResponse } from "@/lib/workflows/types";

/**
 * Polling hook for `GET /api/workflows/[id]/status`.
 *
 * Owns the fetch, the 3-second interval, cancellation on unmount, and
 * re-subscription when `workflowId` changes. Exposes `setData` so callers can
 * apply optimistic updates (e.g. flipping a step to "running" immediately when
 * Execute is clicked) without racing the next poll tick.
 *
 * Returns `WorkflowStatusResponse | null` — narrowing on `data.pattern` is the
 * caller's job per TDR-031. This hook intentionally does not narrow for
 * consumers; each pattern-specific subview handles its own arm.
 */
export function useWorkflowStatus(workflowId: string): {
  data: WorkflowStatusResponse | null;
  setData: (updater: (current: WorkflowStatusResponse | null) => WorkflowStatusResponse | null) => void;
  refetch: () => Promise<void>;
} {
  const [data, setDataInternal] = useState<WorkflowStatusResponse | null>(null);

  const refetch = useCallback(async () => {
    const res = await fetch(`/api/workflows/${workflowId}/status`);
    if (res.ok) {
      const json = (await res.json()) as WorkflowStatusResponse;
      setDataInternal(json);
    }
  }, [workflowId]);

  useEffect(() => {
    // Reset data when the workflowId changes so the old workflow's state
    // never briefly shows while the new one is fetching.
    setDataInternal(null);
    refetch();
    const interval = setInterval(refetch, 3000);
    return () => clearInterval(interval);
  }, [refetch]);

  const setData = useCallback(
    (updater: (current: WorkflowStatusResponse | null) => WorkflowStatusResponse | null) => {
      setDataInternal((prev) => updater(prev));
    },
    []
  );

  return { data, setData, refetch };
}
