import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { PageShell } from "@/components/shared/page-shell";
import { WorkflowFormView } from "@/components/workflows/workflow-form-view";
import { listProfiles } from "@/lib/agents/profiles/registry";

export const dynamic = "force-dynamic";

export default async function NewWorkflowPage() {
  const allProjects = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .orderBy(projects.name);

  const profiles = listProfiles().map((p) => ({
    id: p.id,
    name: p.name,
    supportedRuntimes: p.supportedRuntimes,
    origin: p.origin,
    scope: p.scope,
  }));

  return (
    <PageShell backHref="/workflows" backLabel="Back to Workflows">
      <WorkflowFormView projects={allProjects} profiles={profiles} />
    </PageShell>
  );
}
