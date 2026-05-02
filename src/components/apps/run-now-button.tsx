"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";
import { toast } from "sonner";

interface RunNowButtonProps {
  blueprintId: string | null | undefined;
  /**
   * Defaults to a label of "Run now". Tracker uses the default; future kits
   * may pass a domain-specific label like "Synthesize now".
   */
  label?: string;
}

/**
 * Posts to the blueprint instantiate endpoint with empty variables. If the
 * blueprint declares `variables` requiring user input, the API will return
 * 400 with an error message — Phase 2 surfaces this via toast and defers
 * the inline-form sheet to Phase 3.
 *
 * Why no inputs sheet yet: the spec mentions opening a `WorkflowFormView`
 * sheet when the blueprint has declared inputs, but that path requires
 * fetching the blueprint definition client-side first. Phase 2 ships the
 * happy path (no inputs) with a clear error toast for the inputs case.
 */
export function RunNowButton({ blueprintId, label = "Run now" }: RunNowButtonProps) {
  const [pending, setPending] = useState(false);

  if (!blueprintId) return null;

  async function handleClick() {
    if (!blueprintId) return;
    setPending(true);
    try {
      const res = await fetch(`/api/blueprints/${blueprintId}/instantiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variables: {} }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? `Failed to start (${res.status})`);
        return;
      }
      toast.success("Run started");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Run failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      size="sm"
      onClick={handleClick}
      disabled={pending}
      className="gap-1.5"
    >
      <Play className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
