import { Suspense } from "react";
import { db } from "@/lib/db";
import { tasks, projects, workflows } from "@/lib/db/schema";
import { desc, isNull } from "drizzle-orm";
import { KanbanBoard } from "@/components/tasks/kanban-board";
import { SkeletonBoard } from "@/components/tasks/skeleton-board";
import type { TaskItem } from "@/components/tasks/task-card";

export const dynamic = "force-dynamic";

async function BoardContent() {
  // Only show parent/standalone tasks — hide workflow step tasks
  const allTasks = await db
    .select()
    .from(tasks)
    .where(isNull(tasks.workflowId))
    .orderBy(tasks.priority, desc(tasks.createdAt));

  const allProjects = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .orderBy(projects.name);

  // Build project name lookup for task cards
  const projectMap = new Map(allProjects.map((p) => [p.id, p.name]));

  // Look up linked workflows for parent tasks (via sourceTaskId in definition JSON)
  const allWorkflows = await db
    .select({ id: workflows.id, definition: workflows.definition, status: workflows.status })
    .from(workflows);

  const linkedWorkflowMap = new Map<string, { workflowId: string; workflowStatus: string }>();
  for (const w of allWorkflows) {
    try {
      const def = JSON.parse(w.definition);
      if (def.sourceTaskId) {
        linkedWorkflowMap.set(def.sourceTaskId, {
          workflowId: w.id,
          workflowStatus: w.status,
        });
      }
    } catch { /* skip invalid JSON */ }
  }

  // Serialize Date objects for client component consumption
  const serializedTasks: TaskItem[] = allTasks.map((t) => ({
    ...t,
    projectName: t.projectId ? projectMap.get(t.projectId) ?? undefined : undefined,
    linkedWorkflowId: linkedWorkflowMap.get(t.id)?.workflowId,
    linkedWorkflowStatus: linkedWorkflowMap.get(t.id)?.workflowStatus,
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
