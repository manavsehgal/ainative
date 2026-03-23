import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { workflows, projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { PageShell } from "@/components/shared/page-shell";
import { WorkflowStatusView } from "@/components/workflows/workflow-status-view";
import { Badge } from "@/components/ui/badge";
import { FolderKanban } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function WorkflowDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [workflow] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, id));

  if (!workflow) notFound();

  // Fetch project name for back-link
  let projectName: string | null = null;
  if (workflow.projectId) {
    const [project] = await db
      .select({ name: projects.name })
      .from(projects)
      .where(eq(projects.id, workflow.projectId));
    projectName = project?.name ?? null;
  }

  return (
    <PageShell
      backHref="/workflows"
      backLabel="Back to Workflows"
      actions={
        workflow.projectId && projectName ? (
          <Link href={`/projects/${workflow.projectId}`}>
            <Badge variant="outline" className="gap-1.5 hover:bg-accent">
              <FolderKanban className="h-3 w-3" />
              {projectName}
            </Badge>
          </Link>
        ) : undefined
      }
    >
      <WorkflowStatusView workflowId={id} />
    </PageShell>
  );
}
