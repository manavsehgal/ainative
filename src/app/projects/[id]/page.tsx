import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { projects, tasks, workflows } from "@/lib/db/schema";
import { eq, count, getTableColumns } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { COLUMN_ORDER } from "@/lib/constants/task-status";
import { PageShell } from "@/components/shared/page-shell";
import { ProjectDetailClient } from "@/components/projects/project-detail";
import { Sparkline } from "@/components/charts/sparkline";
import { getProjectCompletionTrend } from "@/lib/queries/chart-data";
import { EnvironmentSummaryCard } from "@/components/environment/environment-summary-card";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id));

  if (!project) notFound();

  const projectTasks = await db
    .select({
      ...getTableColumns(tasks),
      workflowName: workflows.name,
      workflowStatus: workflows.status,
    })
    .from(tasks)
    .leftJoin(workflows, eq(tasks.workflowId, workflows.id))
    .where(eq(tasks.projectId, id))
    .orderBy(tasks.priority, tasks.createdAt);

  // Status breakdown (standalone tasks only for headline metrics)
  const statusCounts: Record<string, number> = {};
  const standaloneForCounts = projectTasks.filter((t) => !t.workflowId);
  for (const status of COLUMN_ORDER) {
    statusCounts[status] = standaloneForCounts.filter((t) => t.status === status).length;
  }

  const completionTrend = await getProjectCompletionTrend(id, 14);
  const totalTasks = standaloneForCounts.length;

  const standaloneTasks = projectTasks.filter((t) => !t.workflowId);
  const workflowTasks = projectTasks.filter((t) => t.workflowId);

  const serializedTasks = projectTasks.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    workflowName: t.workflowName ?? null,
    workflowStatus: t.workflowStatus ?? null,
  }));

  const standaloneCount = standaloneTasks.length;
  const workflowCount = workflowTasks.length;
  const workflowGroupCount = new Set(workflowTasks.map((t) => t.workflowId)).size;

  const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
    active: "default",
    paused: "secondary",
    completed: "outline",
  };

  return (
    <PageShell
      backHref="/projects"
      backLabel="Back to Projects"
      title={project.name}
      description={project.description ?? undefined}
      actions={
        <Badge variant={statusVariant[project.status] ?? "secondary"}>
          {project.status}
        </Badge>
      }
    >
      {/* Status breakdown */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-6">
        {COLUMN_ORDER.map((status) => (
          <Card key={status}>
            <CardHeader className="pb-1 pt-3 px-3">
              <CardTitle className="text-xs font-medium text-muted-foreground capitalize">
                {status}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <div className="text-xl font-bold">{statusCounts[status]}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Stacked status bar + completion sparkline */}
      {totalTasks > 0 && (
        <div className="mb-6 space-y-3">
          <div className="flex h-1.5 rounded-full overflow-hidden" role="img" aria-label="Task status distribution">
            {COLUMN_ORDER.map((status) => {
              const pct = (statusCounts[status] / totalTasks) * 100;
              if (pct === 0) return null;
              const statusColors: Record<string, string> = {
                planned: "var(--muted-foreground)",
                queued: "var(--chart-4)",
                running: "var(--chart-1)",
                completed: "var(--chart-2)",
                failed: "var(--destructive)",
              };
              return (
                <div
                  key={status}
                  style={{ width: `${pct}%`, backgroundColor: statusColors[status] ?? "var(--muted)" }}
                  title={`${status}: ${statusCounts[status]}`}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground shrink-0">14-day completions</span>
            <Sparkline
              data={completionTrend}
              width={200}
              height={24}
              color="var(--chart-2)"
              label="14-day completion trend"
              className="flex-1"
            />
          </div>
        </div>
      )}

      {/* Environment summary */}
      {project.workingDirectory && (
        <div className="mb-6">
          <EnvironmentSummaryCard
            projectId={id}
            workingDirectory={project.workingDirectory}
          />
        </div>
      )}

      {/* Task count summary */}
      {(standaloneCount > 0 || workflowCount > 0) && (
        <p className="text-xs text-muted-foreground mb-4">
          {standaloneCount} standalone task{standaloneCount !== 1 ? "s" : ""}
          {workflowCount > 0 && (
            <> &middot; {workflowCount} workflow task{workflowCount !== 1 ? "s" : ""} across {workflowGroupCount} workflow{workflowGroupCount !== 1 ? "s" : ""}</>
          )}
        </p>
      )}

      <ProjectDetailClient tasks={serializedTasks} projectId={id} />
    </PageShell>
  );
}
