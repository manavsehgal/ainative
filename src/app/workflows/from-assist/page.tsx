import Link from "next/link";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
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
    <div className="gradient-ocean-mist min-h-screen p-6">
      <div>
        <Link href="/tasks/new?restore=1">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Task
          </Button>
        </Link>
        <WorkflowConfirmationView projects={allProjects} profiles={profiles} />
      </div>
    </div>
  );
}
