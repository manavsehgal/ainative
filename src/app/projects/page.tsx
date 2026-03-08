import { db } from "@/lib/db";
import { projects, tasks } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { ProjectList } from "@/components/projects/project-list";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const result = await db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      status: projects.status,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      taskCount: sql<number>`(SELECT COUNT(*) FROM tasks WHERE tasks.project_id = ${projects.id})`.as("task_count"),
    })
    .from(projects)
    .orderBy(projects.createdAt);

  return (
    <div className="p-6">
      <ProjectList initialProjects={result} />
    </div>
  );
}
