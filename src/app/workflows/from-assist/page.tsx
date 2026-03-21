import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { PageShell } from "@/components/shared/page-shell";
import { WorkflowConfirmationView } from "@/components/workflows/workflow-confirmation-view";
import { listProfiles } from "@/lib/agents/profiles/registry";

export const dynamic = "force-dynamic";

export default async function WorkflowFromAssistPage() {
  const allProjects = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .orderBy(projects.name);

  const profiles = listProfiles().map((p) => ({
    id: p.id,
    name: p.name,
  }));

  return (
    <PageShell backHref="/tasks/new?restore=1" backLabel="Back to Task">
      <WorkflowConfirmationView projects={allProjects} profiles={profiles} />
    </PageShell>
  );
}
