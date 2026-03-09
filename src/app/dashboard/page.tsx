import { Suspense } from "react";
import { db } from "@/lib/db";
import { tasks, projects } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { SkeletonBoard } from "@/components/tasks/skeleton-board";
import type { TaskItem } from "@/components/tasks/task-card";

export const dynamic = "force-dynamic";

async function BoardContent() {
  const allTasks = await db
    .select()
    .from(tasks)
    .orderBy(tasks.priority, desc(tasks.createdAt));

  const allProjects = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .orderBy(projects.name);

  // Build project name lookup for task cards
  const projectMap = new Map(allProjects.map((p) => [p.id, p.name]));

  // Serialize Date objects for client component consumption
  const serializedTasks: TaskItem[] = allTasks.map((t) => ({
    ...t,
    projectName: t.projectId ? projectMap.get(t.projectId) ?? undefined : undefined,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  return <KanbanBoard initialTasks={serializedTasks} projects={allProjects} />;
}

export default function DashboardPage() {
  return (
    <div className="gradient-morning-sky min-h-screen p-6">
      <Suspense fallback={<SkeletonBoard />}>
        <BoardContent />
      </Suspense>
    </div>
  );
}
