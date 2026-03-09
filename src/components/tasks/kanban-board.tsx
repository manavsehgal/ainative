"use client";

import { useId, useState, useCallback, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
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
import { KanbanColumn } from "./kanban-column";
import { TaskCard, type TaskItem } from "./task-card";
import { TaskDetailPanel } from "./task-detail-panel";
import { TaskCreatePanel } from "./task-create-panel";
import { EmptyBoard } from "./empty-board";
import { COLUMN_ORDER, isValidDragTransition, type TaskStatus } from "@/lib/constants/task-status";

interface KanbanBoardProps {
  initialTasks: TaskItem[];
  projects: { id: string; name: string }[];
}

export function KanbanBoard({ initialTasks, projects }: KanbanBoardProps) {
  const dndId = useId();
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);
  const [activeTask, setActiveTask] = useState<TaskItem | null>(null);
  const [detailTask, setDetailTask] = useState<TaskItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [inlineCreateOpen, setInlineCreateOpen] = useState(false);

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

  // I4: Deep link from monitor — open task detail panel
  useEffect(() => {
    const taskId = searchParams.get("task");
    if (taskId) {
      const task = tasks.find((t) => t.id === taskId);
      if (task) {
        setDetailTask(task);
        setDetailOpen(true);
      }
    }
  }, [searchParams, tasks]);

  // Filter tasks by project and status
  const filteredTasks = tasks.filter((t) => {
    if (projectFilter !== "all" && t.projectId !== projectFilter) return false;
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    return true;
  });

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

    if (!isValidDragTransition(task.status as TaskStatus, targetStatus)) return;

    // Optimistic update
    const prevTasks = [...tasks];
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: targetStatus } : t))
    );

    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: targetStatus }),
      });
      if (!res.ok) setTasks(prevTasks);
    } catch {
      setTasks(prevTasks);
    }
  }

  function handleTaskClick(task: TaskItem) {
    setDetailTask(task);
    setDetailOpen(true);
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

  if (tasks.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <div className="flex items-center gap-3">
            {filterBar}
            <TaskCreatePanel projects={projects} onCreated={refresh} />
          </div>
        </div>
        <EmptyBoard />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-3">
          {filterBar}
          <TaskCreatePanel projects={projects} onCreated={refresh} />
        </div>
      </div>
      <DndContext
        id={dndId}
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="relative">
          {canScrollLeft && (
            <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
          )}
          {canScrollRight && (
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
          )}
          <div
            ref={scrollRef}
            onScroll={updateScrollIndicators}
            className="flex gap-4 overflow-x-auto pb-4"
            role="region"
            aria-label="Kanban board"
          >
            {COLUMN_ORDER.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                tasks={groupedTasks[status]}
                onTaskClick={handleTaskClick}
                onAddTask={status === "planned" ? () => setInlineCreateOpen(true) : undefined}
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
      <TaskDetailPanel
        task={detailTask}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdated={refresh}
      />
      <TaskCreatePanel
        projects={projects}
        onCreated={refresh}
        open={inlineCreateOpen}
        onOpenChange={setInlineCreateOpen}
      />
    </div>
  );
}
