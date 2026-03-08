"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Play, Square, RotateCcw, ArrowRight } from "lucide-react";
import type { TaskItem } from "./task-card";

interface TaskDetailPanelProps {
  task: TaskItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

const statusColors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  planned: "secondary",
  queued: "outline",
  running: "default",
  completed: "default",
  failed: "destructive",
  cancelled: "secondary",
};

const priorityLabels: Record<number, string> = {
  0: "P0 - Critical",
  1: "P1 - High",
  2: "P2 - Medium",
  3: "P3 - Low",
};

export function TaskDetailPanel({
  task,
  open,
  onOpenChange,
  onUpdated,
}: TaskDetailPanelProps) {
  const [loading, setLoading] = useState(false);

  if (!task) return null;

  async function handleStatusChange(newStatus: string) {
    if (!task) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        onOpenChange(false);
        onUpdated();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleExecute() {
    if (!task) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/execute`, {
        method: "POST",
      });
      if (res.ok) {
        onOpenChange(false);
        onUpdated();
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCancel() {
    if (!task) return;
    setLoading(true);
    try {
      await fetch(`/api/tasks/${task.id}/cancel`, { method: "POST" });
      onOpenChange(false);
      onUpdated();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle className="text-left">{task.title}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant={statusColors[task.status] ?? "secondary"}>
              {task.status}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {priorityLabels[task.priority] ?? `P${task.priority}`}
            </span>
          </div>

          {task.description && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-1">Description</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {task.description}
                </p>
              </div>
            </>
          )}

          {task.assignedAgent && (
            <div>
              <h4 className="text-sm font-medium mb-1">Agent</h4>
              <p className="text-sm text-muted-foreground">{task.assignedAgent}</p>
            </div>
          )}

          <Separator />

          <div className="flex gap-2 flex-wrap">
            {task.status === "planned" && (
              <Button size="sm" onClick={() => handleStatusChange("queued")} disabled={loading}>
                <ArrowRight className="h-3.5 w-3.5 mr-1" />
                Queue
              </Button>
            )}
            {task.status === "queued" && (
              <Button size="sm" onClick={handleExecute} disabled={loading}>
                <Play className="h-3.5 w-3.5 mr-1" />
                Run
              </Button>
            )}
            {task.status === "running" && (
              <Button size="sm" variant="destructive" onClick={handleCancel} disabled={loading}>
                <Square className="h-3.5 w-3.5 mr-1" />
                Cancel
              </Button>
            )}
            {(task.status === "failed" || task.status === "cancelled") && (
              <Button size="sm" onClick={() => handleStatusChange("queued")} disabled={loading}>
                <RotateCcw className="h-3.5 w-3.5 mr-1" />
                Retry
              </Button>
            )}
          </div>

          {(task as any).result && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-1">
                  {task.status === "failed" ? "Error" : "Result"}
                </h4>
                <pre className="text-xs text-muted-foreground bg-muted p-3 rounded-md overflow-auto max-h-60 whitespace-pre-wrap">
                  {(task as any).result}
                </pre>
              </div>
            </>
          )}

          <div className="text-xs text-muted-foreground">
            <p>Created: {new Date(task.createdAt).toLocaleString()}</p>
            <p>Updated: {new Date(task.updatedAt).toLocaleString()}</p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
