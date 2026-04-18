"use client";

import { useState, useEffect } from "react";
import { Kanban, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type TaskView = "board" | "table";

const STORAGE_KEY = "ainative-task-view";

interface TaskViewToggleProps {
  view: TaskView;
  onViewChange: (view: TaskView) => void;
}

/**
 * Board / Table toggle for the task surface.
 * Persists preference to localStorage.
 */
export function TaskViewToggle({ view, onViewChange }: TaskViewToggleProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={view === "board" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => onViewChange("board")}
            aria-label="Board view"
          >
            <Kanban className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">Board</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={view === "table" ? "secondary" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => onViewChange("table")}
            aria-label="Table view"
          >
            <Table2 className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">Table</TooltipContent>
      </Tooltip>
    </div>
  );
}

/** Hook for persisted view preference */
export function useTaskView(): [TaskView, (v: TaskView) => void] {
  const [view, setView] = useState<TaskView>("board");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "board" || stored === "table") {
      setView(stored);
    }
  }, []);

  function setAndPersist(v: TaskView) {
    setView(v);
    localStorage.setItem(STORAGE_KEY, v);
  }

  return [view, setAndPersist];
}
