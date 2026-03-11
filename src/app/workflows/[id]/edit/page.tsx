import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { projects, workflows } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { WorkflowFormView } from "@/components/workflows/workflow-form-view";
import { listProfiles } from "@/lib/agents/profiles/registry";

export const dynamic = "force-dynamic";

export default async function EditWorkflowPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ clone?: string }>;
}) {
  const { id } = await params;
  const { clone } = await searchParams;

  const [workflow] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, id));

  if (!workflow) notFound();

  const allProjects = await db
    .select({ id: projects.id, name: projects.name })
    .from(projects)
    .orderBy(projects.name);

  const profiles = listProfiles().map((p) => ({ id: p.id, name: p.name }));

  const workflowData = {
    id: workflow.id,
    name: workflow.name,
    projectId: workflow.projectId,
    definition: workflow.definition,
  };

  return (
    <div className="gradient-ocean-mist min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        <Link href={clone === "true" ? "/workflows" : `/workflows/${id}`}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-1" />
            {clone === "true" ? "Back to Workflows" : "Back to Workflow"}
          </Button>
        </Link>
        <WorkflowFormView
          workflow={workflowData}
          projects={allProjects}
          profiles={profiles}
          clone={clone === "true"}
        />
      </div>
    </div>
  );
}
