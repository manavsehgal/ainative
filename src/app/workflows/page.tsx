import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { WorkflowList } from "@/components/workflows/workflow-list";
import { WorkflowPageActions } from "@/components/workflows/workflow-page-actions";
import { PageShell } from "@/components/shared/page-shell";

export const dynamic = "force-dynamic";

export default async function WorkflowsPage() {
  const allProjects = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .orderBy(projects.name);

  return (
    <PageShell title="Workflows" actions={<WorkflowPageActions />} fullBleed>
      <WorkflowList projects={allProjects} />
    </PageShell>
  );
}
