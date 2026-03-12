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
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { KanbanColumn } from "./kanban-column";
import { TaskCard, type TaskItem } from "./task-card";
import { EmptyBoard } from "./empty-board";
import { COLUMN_ORDER, isValidDragTransition, type TaskStatus } from "@/lib/constants/task-status";

interface KanbanBoardProps {
  initialTasks: TaskItem[];
  projects: { id: string; name: string }[];
}

export function KanbanBoard({ initialTasks, projects }: KanbanBoardProps) {
  const dndId = useId();
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);
  const [activeTask, setActiveTask] = useState<TaskItem | null>(null);
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [announcement, setAnnouncement] = useState(
    `Showing ${initialTasks.length} task${initialTasks.length === 1 ? "" : "s"} on the kanban board.`
  );
  const hasAnnouncedFilters = useRef(false);

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

  function handleTaskClick(task: TaskItem) {
    router.push(`/tasks/${task.id}`);
  }

  const groupedTasks = COLUMN_ORDER.reduce(
    (acc, status) => {
      acc[status] = filteredTasks.filter((t) => t.status === status);
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
    </div>
  );

  const newTaskButton = (
    <Link href="/tasks/new">
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
                onTaskClick={handleTaskClick}
                onAddTask={status === "planned" ? () => router.push("/tasks/new") : undefined}
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
    </div>
  );
}
