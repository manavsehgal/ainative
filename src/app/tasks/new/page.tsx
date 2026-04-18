import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { PageShell } from "@/components/shared/page-shell";
import { TaskCreatePanel } from "@/components/tasks/task-create-panel";

export const dynamic = "force-dynamic";

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const params = await searchParams;
  const allProjects = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .orderBy(projects.name);

  return (
    <PageShell backHref="/tasks" backLabel="Back to Tasks">
      <TaskCreatePanel
        projects={allProjects}
        defaultProjectId={params.project}
      />
    </PageShell>
  );
}
