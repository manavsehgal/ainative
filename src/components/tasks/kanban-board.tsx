"use client";

import { useId, useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { KanbanColumn } from "./kanban-column";
import { TaskCard, type TaskItem } from "./task-card";
import { TaskEditDialog } from "./task-edit-dialog";
import { EmptyBoard } from "./empty-board";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { COLUMN_ORDER, isValidDragTransition, type TaskStatus } from "@/lib/constants/task-status";
import { usePersistedState } from "@/hooks/use-persisted-state";

type SortOrder = "priority" | "created-desc" | "created-asc" | "title-asc";

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
  { value: "priority", label: "Priority" },
  { value: "created-desc", label: "Newest first" },
  { value: "created-asc", label: "Oldest first" },
  { value: "title-asc", label: "Title A-Z" },
];

export function compareTasks(a: TaskItem, b: TaskItem, order: SortOrder): number {
  switch (order) {
    case "priority":
      return a.priority - b.priority;
    case "created-desc":
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    case "created-asc":
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    case "title-asc":
      return a.title.localeCompare(b.title);
  }
}

interface KanbanBoardProps {
  initialTasks: TaskItem[];
  projects: { id: string; name: string }[];
}

export function KanbanBoard({ initialTasks, projects }: KanbanBoardProps) {
  const dndId = useId();
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    if (typeof window === "undefined") return initialTasks;
    const raw = sessionStorage.getItem("deletedTask");
    if (!raw) return initialTasks;
    try {
      const deleted = JSON.parse(raw) as TaskItem;
      if (initialTasks.some((t) => t.id === deleted.id)) return initialTasks;
      return [...initialTasks, deleted];
    } catch {
      return initialTasks;
    }
  });
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
  const [activeTask, setActiveTask] = useState<TaskItem | null>(null);
  const [projectFilter, setProjectFilter] = usePersistedState("stagent-project-filter", "all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOrder, setSortOrder] = usePersistedState<SortOrder>("stagent-sort-order", "priority");
  const [announcement, setAnnouncement] = useState(
    `Showing ${initialTasks.length} task${initialTasks.length === 1 ? "" : "s"} on the kanban board.`
  );
  const hasAnnouncedFilters = useRef(false);

  // Edit dialog
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);

  // Bulk delete confirmation
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[] | null>(null);

  // I5: Scroll indicators
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollIndicators = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateScrollIndicators();
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateScrollIndicators);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateScrollIndicators, tasks]);

  // Reset stale project filter (e.g. project was deleted between sessions)
  useEffect(() => {
    if (projectFilter !== "all" && !projects.some((p) => p.id === projectFilter)) {
      setProjectFilter("all");
    }
  }, [projectFilter, projects, setProjectFilter]);

  // Ghost card exit animation
  useEffect(() => {
    const raw = sessionStorage.getItem("deletedTask");
    if (!raw) return;
    sessionStorage.removeItem("deletedTask");
    try {
      const deleted = JSON.parse(raw) as TaskItem;
      requestAnimationFrame(() => {
        setExitingIds(new Set([deleted.id]));
        setTimeout(() => {
          setTasks((prev) => prev.filter((t) => t.id !== deleted.id));
          setExitingIds(new Set());
        }, 500);
      });
    } catch {
      // invalid data — ignore
    }
  }, []);

  // Filter tasks by project and status
  const filteredTasks = tasks.filter((t) => {
    if (projectFilter !== "all" && t.projectId !== projectFilter) return false;
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    return true;
  });

  useEffect(() => {
    if (!hasAnnouncedFilters.current) {
      hasAnnouncedFilters.current = true;
      return;
    }

    const projectName =
      projectFilter === "all"
        ? "all projects"
        : projects.find((project) => project.id === projectFilter)?.name ?? "the selected project";
    const statusName = statusFilter === "all" ? "all statuses" : statusFilter;
    setAnnouncement(
      `Showing ${filteredTasks.length} task${filteredTasks.length === 1 ? "" : "s"} for ${projectName} with ${statusName}.`
    );
  }, [filteredTasks.length, projectFilter, projects, statusFilter]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const refresh = useCallback(async () => {
    const res = await fetch("/api/tasks");
    if (res.ok) setTasks(await res.json());
  }, []);

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const task = tasks.find((t) => t.id === active.id);
    if (!task) return;

    const targetStatus = over.id as TaskStatus;
    if (task.status === targetStatus) return;

    if (!isValidDragTransition(task.status as TaskStatus, targetStatus)) {
      setAnnouncement(`Cannot move ${task.title} from ${task.status} to ${targetStatus}.`);
      return;
    }

    // Optimistic update
    const prevTasks = [...tasks];
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: targetStatus } : t))
    );
    setAnnouncement(`Moved ${task.title} to ${targetStatus}.`);

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });
      if (!res.ok) {
        setTasks(prevTasks);
        setAnnouncement(`Move failed. ${task.title} returned to ${task.status}.`);
      }
    } catch {
      setTasks(prevTasks);
      setAnnouncement(`Move failed. ${task.title} returned to ${task.status}.`);
    }
  }

  // Single task delete
  const handleDeleteTask = useCallback(async (taskId: string) => {
    const prevTasks = tasks;
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Task deleted");
        setAnnouncement("Task deleted.");
      } else if (res.status === 404) {
        // Already gone — keep optimistic removal
        toast.success("Task deleted");
      } else {
        setTasks(prevTasks);
        toast.error("Failed to delete task");
      }
    } catch {
      setTasks(prevTasks);
      toast.error("Failed to delete task");
    }
  }, [tasks]);

  // Bulk delete — triggered after modal confirmation
  const handleBulkDeleteConfirm = useCallback(async () => {
    if (!bulkDeleteIds) return;
    const ids = bulkDeleteIds;
    setBulkDeleteIds(null);

    const prevTasks = tasks;
    setTasks((prev) => prev.filter((t) => !ids.includes(t.id)));

    const results = await Promise.allSettled(
      ids.map((id) => fetch(`/api/tasks/${id}`, { method: "DELETE" }))
    );

    const failed = results.filter(
      (r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok && r.value.status !== 404)
    );

    if (failed.length === 0) {
      toast.success(`Deleted ${ids.length} task${ids.length === 1 ? "" : "s"}`);
      setAnnouncement(`Deleted ${ids.length} tasks.`);
    } else if (failed.length < ids.length) {
      const succeeded = ids.length - failed.length;
      toast.error(`Deleted ${succeeded}/${ids.length}, ${failed.length} failed`);
      // Refresh to get accurate state
      refresh();
    } else {
      setTasks(prevTasks);
      toast.error("Failed to delete tasks");
    }
  }, [bulkDeleteIds, tasks, refresh]);

  // Bulk status change
  const handleBulkStatusChange = useCallback(async (taskIds: string[], newStatus: TaskStatus) => {
    const prevTasks = tasks;
    setTasks((prev) =>
      prev.map((t) => (taskIds.includes(t.id) ? { ...t, status: newStatus } : t))
    );
    setAnnouncement(`Moving ${taskIds.length} tasks to ${newStatus}.`);

    const results = await Promise.allSettled(
      taskIds.map((id) =>
        fetch(`/api/tasks/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        })
      )
    );

    const failed = results.filter(
      (r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok)
    );

    if (failed.length === 0) {
      toast.success(`${taskIds.length} task${taskIds.length === 1 ? "" : "s"} moved to ${newStatus}`);
    } else {
      toast.error(`${failed.length} of ${taskIds.length} updates failed`);
      refresh(); // Refresh to reconcile
    }
  }, [tasks, refresh]);

  function handleTaskClick(task: TaskItem) {
    router.push(`/tasks/${task.id}`);
  }

  const sortedTasks = [...filteredTasks].sort((a, b) => compareTasks(a, b, sortOrder));

  const groupedTasks = COLUMN_ORDER.reduce(
    (acc, status) => {
      acc[status] = sortedTasks.filter((t) => t.status === status);
      return acc;
    },
    {} as Record<TaskStatus, TaskItem[]>
  );

  const filterBar = (
    <div className="flex items-center gap-2">
      {projects.length > 0 && (
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-[150px]">
          <SelectValue placeholder="All statuses" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          {COLUMN_ORDER.map((s) => (
            <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as SortOrder)}>
        <SelectTrigger className="w-[150px]">
          <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 shrink-0" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const newTaskHref = projectFilter !== "all"
    ? `/tasks/new?project=${projectFilter}`
    : "/tasks/new";

  const newTaskButton = (
    <Link href={newTaskHref}>
      <Button>
        <Plus className="h-4 w-4 mr-2" />
        New Task
      </Button>
    </Link>
  );

  if (tasks.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="flex items-center gap-3">
            {filterBar}
            {newTaskButton}
          </div>
        </div>
        <EmptyBoard />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-3">
          {filterBar}
          {newTaskButton}
        </div>
      </div>
      <p id={`${dndId}-announcements`} className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      <DndContext
        id={dndId}
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="relative">
          <button
            type="button"
            aria-label="Scroll left"
            onClick={() => scrollRef.current?.scrollBy({ left: -280, behavior: "smooth" })}
            className={`surface-control absolute left-1 top-0 z-20 h-8 w-8 rounded-full flex items-center justify-center transition-opacity duration-200 cursor-pointer hover:bg-accent/50 ${canScrollLeft ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          >
            <ChevronLeft className="h-4 w-4 text-foreground" />
          </button>
          <button
            type="button"
            aria-label="Scroll right"
            onClick={() => scrollRef.current?.scrollBy({ left: 280, behavior: "smooth" })}
            className={`surface-control absolute right-1 top-0 z-20 h-8 w-8 rounded-full flex items-center justify-center transition-opacity duration-200 cursor-pointer hover:bg-accent/50 ${canScrollRight ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          >
            <ChevronRight className="h-4 w-4 text-foreground" />
          </button>
          <div
            ref={scrollRef}
            onScroll={updateScrollIndicators}
            className="flex gap-4 overflow-x-auto pb-4"
            role="region"
            aria-label="Kanban board"
            aria-describedby={`${dndId}-announcements`}
          >
            {COLUMN_ORDER.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                tasks={groupedTasks[status]}
                exitingIds={exitingIds}
                onTaskClick={handleTaskClick}
                onAddTask={status === "planned" ? () => router.push("/tasks/new") : undefined}
                onDeleteTask={handleDeleteTask}
                onEditTask={setEditingTask}
                onBulkDelete={(ids) => setBulkDeleteIds(ids)}
                onBulkStatusChange={handleBulkStatusChange}
              />
            ))}
          </div>
        </div>
        <DragOverlay>
          {activeTask ? (
            <div className="w-64">
              <TaskCard task={activeTask} onClick={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Bulk delete confirmation modal */}
      <ConfirmDialog
        open={bulkDeleteIds !== null}
        onOpenChange={(open) => { if (!open) setBulkDeleteIds(null); }}
        title={`Delete ${bulkDeleteIds?.length ?? 0} task${(bulkDeleteIds?.length ?? 0) === 1 ? "" : "s"}?`}
        description="This action cannot be undone. All selected tasks will be permanently deleted."
        confirmLabel="Delete"
        destructive
        onConfirm={handleBulkDeleteConfirm}
      />

      {/* Task edit dialog */}
      <TaskEditDialog
        task={editingTask}
        open={!!editingTask}
        onOpenChange={(open) => { if (!open) setEditingTask(null); }}
        onUpdated={refresh}
      />
    </div>
  );
}
