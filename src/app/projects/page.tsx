import { db } from "@/lib/db";
import { projects, tasks } from "@/lib/db/schema";
import { eq, count } from "drizzle-orm";
import { ProjectList } from "@/components/projects/project-list";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const result = await db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      workingDirectory: projects.workingDirectory,
      status: projects.status,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
      taskCount: count(tasks.id),
    })
    .from(projects)
    .leftJoin(tasks, eq(tasks.projectId, projects.id))
    .groupBy(projects.id)
    .orderBy(projects.createdAt);

  return (
    <div className="gradient-ocean-mist min-h-screen p-4 sm:p-6">
      <div className="surface-page surface-page-shell mx-auto min-h-[calc(100dvh-2rem)] max-w-6xl rounded-[30px] p-5 sm:p-6 lg:p-7">
        <ProjectList initialProjects={result} />
      </div>
    </div>
  );
}
