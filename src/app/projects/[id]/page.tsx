import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { projects, tasks } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { COLUMN_ORDER } from "@/lib/constants/task-status";
import { ProjectDetailClient } from "@/components/projects/project-detail";

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
    <div className="p-6">
      <div className="mb-6">
        <Link href="/projects">
          <Button variant="ghost" size="sm" className="mb-2">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Projects
          </Button>
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{project.name}</h1>
          <Badge variant={statusVariant[project.status] ?? "secondary"}>
            {project.status}
          </Badge>
        </div>
        {project.description && (
          <p className="text-muted-foreground mt-1">{project.description}</p>
        )}
      </div>

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

      <ProjectDetailClient tasks={serializedTasks} projectId={id} />
    </div>
  );
}
