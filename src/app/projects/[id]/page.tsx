import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { projects, tasks } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { COLUMN_ORDER } from "@/lib/constants/task-status";
import { PageShell } from "@/components/shared/page-shell";
import { ProjectDetailClient } from "@/components/projects/project-detail";
import { Sparkline } from "@/components/charts/sparkline";
import { getProjectCompletionTrend } from "@/lib/queries/chart-data";

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
    .select()
    .from(tasks)
    .where(eq(tasks.projectId, id))
    .orderBy(tasks.priority, tasks.createdAt);

  // Status breakdown
  const statusCounts: Record<string, number> = {};
  for (const status of COLUMN_ORDER) {
    statusCounts[status] = projectTasks.filter((t) => t.status === status).length;
  }

  const completionTrend = await getProjectCompletionTrend(id, 14);
  const totalTasks = projectTasks.length;

  const serializedTasks = projectTasks.map((t) => ({
    ...t,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

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

      <ProjectDetailClient tasks={serializedTasks} projectId={id} />
    </PageShell>
  );
}
