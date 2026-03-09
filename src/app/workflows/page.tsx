import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { WorkflowList } from "@/components/workflows/workflow-list";

export const dynamic = "force-dynamic";

export default async function WorkflowsPage() {
  const allProjects = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .orderBy(projects.name);

  return (
    <div className="p-6">
      <WorkflowList projects={allProjects} />
    </div>
  );
}
