"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Workflow, Loader2 } from "lucide-react";
import { workflowStatusVariant, patternLabels } from "@/lib/constants/status-colors";

export interface WorkflowKanbanItem {
  type: "workflow";
  id: string;
  name: string;
  status: string;
  pattern: string;
  projectName?: string;
  stepProgress: { current: number; total: number };
  currentStepName?: string;
  createdAt: string;
}

interface WorkflowKanbanCardProps {
  workflow: WorkflowKanbanItem;
}

export function WorkflowKanbanCard({ workflow }: WorkflowKanbanCardProps) {
  const isActive = workflow.status === "active";
  const isFailed = workflow.status === "failed";
  const progressPct =
    workflow.stepProgress.total > 0
      ? (workflow.stepProgress.current / workflow.stepProgress.total) * 100
      : 0;

  return (
    <Link href={`/workflows/${workflow.id}`} className="block">
      <Card
        role="button"
        aria-label={`${workflow.name}, ${patternLabels[workflow.pattern] ?? workflow.pattern}, ${workflow.status}`}
        className={`surface-card cursor-pointer transition-shadow hover:shadow-md group overflow-hidden py-0 gap-0 border-l-4 ${
          isFailed ? "border-l-destructive" : "border-l-primary"
        }`}
      >
        <div className="p-3">
          <div className="flex items-start gap-2">
            <Workflow
              className={`mt-0.5 h-4 w-4 shrink-0 ${
                isFailed ? "text-destructive" : "text-primary"
              }`}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium line-clamp-2">{workflow.name}</p>
              {workflow.projectName && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {workflow.projectName}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1.5">
                <Badge variant="outline" className="text-xs gap-1">
                  {patternLabels[workflow.pattern] ?? workflow.pattern}
                </Badge>
                {workflow.stepProgress.total > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {workflow.stepProgress.current}/{workflow.stepProgress.total}
                  </span>
                )}
              </div>

              {/* Progress bar */}
              {workflow.stepProgress.total > 0 && (
                <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isFailed ? "bg-destructive" : "bg-primary"
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              )}

              {/* Current step indicator */}
              {isActive && workflow.currentStepName && (
                <div className="flex items-center gap-1 mt-1.5">
                  <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
                  <span className="text-xs text-muted-foreground truncate">
                    {workflow.currentStepName}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status strip */}
        <div className="flex items-center h-7 px-3 border-t border-border/30 transition-colors">
          <Badge
            variant={workflowStatusVariant[workflow.status] ?? "secondary"}
            className="text-[11px] h-5"
          >
            {workflow.status}
          </Badge>
          <div className="flex-1" />
          <span className="text-[11px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
            View →
          </span>
        </div>
      </Card>
    </Link>
  );
}
