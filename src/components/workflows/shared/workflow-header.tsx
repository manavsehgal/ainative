"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardHeader, CardTitle } from "@/components/ui/card";
import {
  Play,
  Pencil,
  Copy,
  RotateCcw,
  Trash2,
  FolderKanban,
} from "lucide-react";
import { workflowStatusVariant, patternLabels } from "@/lib/constants/status-colors";
import { IconCircle, getWorkflowIconFromName } from "@/lib/constants/card-icons";
import type { WorkflowStatusResponse } from "@/lib/workflows/types";

/**
 * Pattern-agnostic header card for the workflow detail page. Renders the
 * workflow name, pattern label, project/run badges, status badge, and the
 * action buttons (Execute, Edit, Clone, Re-run, Delete). Each subview passes
 * callbacks and the narrowed-arm `data` object.
 *
 * This component is deliberately read-only with respect to polling state —
 * subviews own their own `executing` state so the Execute button can show
 * the "Starting..." label without a round-trip through the router.
 */
export function WorkflowHeader({
  data,
  executing,
  canExecute,
  onExecute,
  onRerun,
  onDelete,
}: {
  data: WorkflowStatusResponse;
  executing: boolean;
  /** Subviews decide when Execute makes sense (e.g. loop workflows hide it in favour of the loop's own start/pause controls). */
  canExecute: boolean;
  onExecute: () => void;
  onRerun: () => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const hasDefinition = !!data.definition;

  return (
    <CardHeader>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <IconCircle
            icon={getWorkflowIconFromName(data.name, data.pattern).icon}
            colors={getWorkflowIconFromName(data.name, data.pattern).colors}
          />
          <div>
            <CardTitle>{data.name}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {patternLabels[data.pattern] ?? data.pattern}
            </p>
            <div className="flex items-center gap-2 mt-1">
              {data.projectId && (
                <Badge
                  variant="outline"
                  className="text-xs cursor-pointer hover:bg-accent gap-1"
                  onClick={() => router.push(`/projects/${data.projectId}`)}
                >
                  <FolderKanban className="h-3 w-3" />
                  Project
                </Badge>
              )}
              {data.runNumber != null && data.runNumber > 0 && (
                <Badge variant="outline" className="text-xs font-normal">
                  Run #{data.runNumber}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={workflowStatusVariant[data.status] ?? "secondary"}>
            {data.status}
          </Badge>

          {canExecute && (data.status === "draft" || data.status === "paused") && (
            <Button size="sm" onClick={onExecute} disabled={executing}>
              <Play className="h-3 w-3 mr-1" />
              {executing ? "Starting..." : "Execute"}
            </Button>
          )}

          {["draft", "completed", "failed"].includes(data.status) && hasDefinition && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/workflows/${data.id}/edit`)}
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
              Edit
            </Button>
          )}

          {hasDefinition && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/workflows/${data.id}/edit?clone=true`)}
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" />
              Clone
            </Button>
          )}

          {(data.status === "completed" || data.status === "failed") && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRerun}
              disabled={executing}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Re-run
            </Button>
          )}

          {data.status !== "active" && (
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Delete
            </Button>
          )}
        </div>
      </div>
    </CardHeader>
  );
}
