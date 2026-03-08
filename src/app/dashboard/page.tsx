import { Suspense } from "react";
import { db } from "@/lib/db";
import { tasks, projects } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { SkeletonBoard } from "@/components/tasks/skeleton-board";

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

  return <KanbanBoard initialTasks={allTasks as any} projects={allProjects} />;
}

export default function DashboardPage() {
  return (
    <div className="p-6">
      <Suspense fallback={<SkeletonBoard />}>
        <BoardContent />
      </Suspense>
    </div>
  );
}
