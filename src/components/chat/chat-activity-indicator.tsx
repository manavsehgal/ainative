"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TaskStatus {
  id: string;
  title: string;
  status: string;
}

interface ChatActivityIndicatorProps {
  taskIds: string[];
}

export function ChatActivityIndicator({ taskIds }: ChatActivityIndicatorProps) {
  const [taskStatuses, setTaskStatuses] = useState<Map<string, TaskStatus>>(new Map());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (taskIds.length === 0) return;

    const fetchStatuses = async () => {
      const updates = new Map(taskStatuses);
      for (const id of taskIds) {
        try {
          const res = await fetch(`/api/tasks/${id}`);
          if (res.ok) {
            const task = await res.json();
            updates.set(id, { id: task.id, title: task.title, status: task.status });
          }
        } catch {
          // Skip failed fetches
        }
      }
      setTaskStatuses(updates);
    };

    fetchStatuses();

    // Poll every 5s for running tasks
    intervalRef.current = setInterval(() => {
      const hasRunning = Array.from(taskStatuses.values()).some(
        (t) => t.status === "running" || t.status === "queued"
      );
      if (hasRunning || taskStatuses.size < taskIds.length) {
        fetchStatuses();
      }
    }, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskIds.join(",")]);

  if (taskStatuses.size === 0) return null;

  const running = Array.from(taskStatuses.values()).filter(
    (t) => t.status === "running" || t.status === "queued"
  );
  const completed = Array.from(taskStatuses.values()).filter(
    (t) => t.status === "completed"
  );
  const failed = Array.from(taskStatuses.values()).filter(
    (t) => t.status === "failed"
  );

  return (
    <div className="border-t border-border px-4 py-2 flex items-center gap-2 text-xs text-muted-foreground">
      {running.length > 0 && (
        <Badge variant="default" className="gap-1.5 text-xs">
          <Loader2 className="h-3 w-3 animate-spin" />
          {running.length} task{running.length !== 1 ? "s" : ""} running
        </Badge>
      )}
      {completed.length > 0 && (
        <Badge variant="secondary" className="gap-1.5 text-xs">
          <CheckCircle2 className="h-3 w-3" />
          {completed.length} completed
        </Badge>
      )}
      {failed.length > 0 && (
        <Badge variant="destructive" className="gap-1.5 text-xs">
          <XCircle className="h-3 w-3" />
          {failed.length} failed
        </Badge>
      )}
    </div>
  );
}
